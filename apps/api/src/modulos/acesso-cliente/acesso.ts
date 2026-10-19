import { createHash, randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  hashToken,
  hmacBusca,
  iguais,
  linkPorToken,
  naOrganizacao,
  novoCodigoSeisDigitos,
  novoToken,
  sessaoClientePorToken,
  type Tx,
} from '@trames/db';
import { BUCKET_DOCUMENTOS, BUCKET_QUARENTENA, chaveDocumento, existe, urlDeDownload, urlDeUpload } from '@trames/db/armazenamento';
import {
  EntrarClienteEntrada,
  IniciarUploadEntrada,
  mesDe,
  PedirCodigoEntrada,
  PLANOS,
  TAMANHO_MAXIMO_ARQUIVO,
  TENTATIVAS_CODIGO,
  VALIDADE_CODIGO_MINUTOS,
  type AcessoInfo,
  type BalcaoCliente,
  type MarcaDto,
  type UploadIniciado,
} from '@trames/shared';
import { config, emDesenvolvimento } from '../../infra/config';
import { COOKIE_CLIENTE, definirCookie, limparCookie } from '../../infra/cookies';
import { ErroHttp, naoEncontrado } from '../../infra/erros';
import { enfileirar } from '../../infra/fila';
import { ipDe, limites, rota, validar } from '../../infra/http';
import { auditar, auditarComo } from '../auditoria/auditoria';
import { planoAtual } from '../auth/auth';
import { selarConteudo } from './links';

/*
 * Acesso do cliente, em duas etapas:
 *  1. o link (token no cabeçalho x-link; a busca é pelo hash) mostra para quem é o balcão;
 *  2. o código de 6 dígitos, por e-mail (ou WhatsApp, se o escritório escolheu no Pro/Ultra),
 *     abre uma sessão de 30 dias naquele aparelho, só para aquele balcão.
 * A sessão cai antes se o balcão for concluído, o link for revogado ou o escritório
 * encerrar o acesso (a função acesso_sessao_cliente confere tudo isso a cada pedido).
 */

const VALIDADE_SESSAO_CLIENTE_MS = 30 * 86_400_000;
/** Limites por balcão, contados no banco (somam todos os links e todas as instâncias). */
const CODIGOS_POR_HORA = 10;
const ERROS_POR_15_MIN = 15;

/** Um cookie por balcão: o mesmo aparelho pode ter balcões de escritórios diferentes. */
const cookieDoBalcao = (balcaoId: string) => `${COOKIE_CLIENTE}_${createHash('sha256').update(balcaoId).digest('hex').slice(0, 16)}`;

const mascararEmail = (email: string) => email.replace(/^(.)[^@]*(@.).*(\.[^.]+)$/, '$1***$2***$3');

/** Canal do código: o do balcão, se o plano ainda permite e a cota de WhatsApp não acabou. */
async function canalDoCodigo(tx: Tx, organizacaoId: string, canal: string, temEmail: boolean) {
  if (canal !== 'whatsapp') return 'email' as const;
  const p = PLANOS[await planoAtual(tx, organizacaoId)];
  if (!p.recursos.whatsapp) return 'email' as const;
  const uso = await tx.usoMensal.findUnique({ where: { organizacaoId_mes: { organizacaoId, mes: mesDe() } } });
  if ((uso?.whatsappEnviados ?? 0) >= p.cotaWhatsapp && temEmail) return 'email' as const;
  return 'whatsapp' as const;
}
const hashCodigo = (linkId: string, codigo: string) => hmacBusca(config.CHAVE_HMAC, linkId, codigo);

async function linkValido(req: Request) {
  const token = req.get('x-link');
  if (!token || token.length < 30 || token.length > 100) throw new ErroHttp(404, 'Link não encontrado.', 'link_invalido');
  const l = await linkPorToken(hashToken(token));
  if (!l) throw new ErroHttp(404, 'Link não encontrado.', 'link_invalido');
  if (l.revogado_em || l.expira_em < new Date()) {
    const b = await naOrganizacao(l.organizacao_id, (tx) => tx.balcao.findUnique({ where: { id: l.balcao_id }, select: { concluidoEm: true } }));
    if (b?.concluidoEm) throw new ErroHttp(410, 'O escritório já encerrou este balcão. Se precisar mandar mais alguma coisa, fale com ele.', 'balcao_concluido');
    throw new ErroHttp(410, 'Este link foi substituído por um mais novo ou não vale mais. Use o link da mensagem mais recente do escritório.', 'link_vencido');
  }
  return l;
}

async function marca(tx: Tx, organizacaoId: string): Promise<MarcaDto> {
  const o = await tx.organizacao.findUniqueOrThrow({ where: { id: organizacaoId } });
  return { nome: o.nome, sigla: o.sigla, cor: o.cor, comMarca: PLANOS[await planoAtual(tx, organizacaoId)].recursos.marca };
}

const primeiroNome = (nome: string) => nome.split(/\s+/)[0];

export const rotasAcesso = Router();

rotasAcesso.get(
  '/',
  rota(async (req, res) => {
    const l = await linkValido(req);
    const info = await naOrganizacao(l.organizacao_id, async (tx): Promise<AcessoInfo> => {
      const b = await tx.balcao.findUniqueOrThrow({ where: { id: l.balcao_id }, include: { cliente: true, _count: { select: { itens: { where: { removidoEm: null } } } } } });
      return {
        organizacao: await marca(tx, l.organizacao_id),
        clientePrimeiroNome: primeiroNome(b.cliente.nome),
        canal: await canalDoCodigo(tx, l.organizacao_id, b.canalCodigo, !!b.cliente.email),
        whatsappFinal: b.cliente.telefoneFinal,
        emailMascarado: b.cliente.email ? mascararEmail(b.cliente.email) : '',
        tipo: b.tipo,
        totalItens: b._count.itens,
      };
    });
    res.json(info);
  }),
);

rotasAcesso.post(
  '/codigo',
  limites.pedirCodigo,
  rota(async (req, res) => {
    const l = await linkValido(req);
    validar(PedirCodigoEntrada, req.body ?? {});
    const codigo = novoCodigoSeisDigitos();
    const canal = await naOrganizacao(l.organizacao_id, async (tx) => {
      const b = await tx.balcao.findUniqueOrThrow({ where: { id: l.balcao_id }, include: { cliente: { select: { email: true } } } });
      // Limite por balcão, no banco: vale para todos os links do balcão e entre instâncias da API.
      const recentes = await tx.codigoAcesso.count({ where: { link: { balcaoId: l.balcao_id }, criadoEm: { gt: new Date(Date.now() - 3_600_000) } } });
      if (recentes >= CODIGOS_POR_HORA) throw new ErroHttp(429, 'Muitos códigos pedidos para este balcão. Espere um pouco e tente de novo.', 'limite');
      const c = await canalDoCodigo(tx, l.organizacao_id, b.canalCodigo, !!b.cliente.email);
      // Um código novo invalida os anteriores do balcão, de qualquer link.
      await tx.codigoAcesso.updateMany({ where: { link: { balcaoId: l.balcao_id }, usadoEm: null }, data: { expiraEm: new Date() } });
      await tx.codigoAcesso.create({
        data: { organizacaoId: l.organizacao_id, linkId: l.id, codigoHash: hashCodigo(l.id, codigo), canal: c, expiraEm: new Date(Date.now() + VALIDADE_CODIGO_MINUTOS * 60_000) },
      });
      return c;
    });
    await enfileirar('enviar-mensagem', { organizacaoId: l.organizacao_id, balcaoId: l.balcao_id, tipo: 'codigo', canal, selado: await selarConteudo(l.organizacao_id, { codigo }) });
    res.status(202).json({ canal });
  }),
);

rotasAcesso.post(
  '/entrar',
  limites.entrarCliente,
  rota(async (req, res) => {
    const l = await linkValido(req);
    const { codigo } = validar(EntrarClienteEntrada, req.body);
    const ok = await naOrganizacao(l.organizacao_id, async (tx) => {
      const erros = await tx.eventoAuditoria.count({ where: { acao: 'cliente.codigo_errado', alvoTipo: 'balcao', alvoId: l.balcao_id, criadoEm: { gt: new Date(Date.now() - 15 * 60_000) } } });
      if (erros >= ERROS_POR_15_MIN) throw new ErroHttp(429, 'Muitas tentativas neste balcão. Espere 15 minutos e peça um código novo.', 'limite');
      const c = await tx.codigoAcesso.findFirst({ where: { linkId: l.id, usadoEm: null, expiraEm: { gt: new Date() } }, orderBy: { criadoEm: 'desc' } });
      if (!c || c.tentativas >= TENTATIVAS_CODIGO) throw new ErroHttp(400, 'O código venceu. Peça um novo.', 'codigo_vencido');
      if (!iguais(c.codigoHash, hashCodigo(l.id, codigo))) {
        await tx.codigoAcesso.update({ where: { id: c.id }, data: { tentativas: { increment: 1 } } });
        await auditarComo(tx, l.organizacao_id, 'cliente', null, ipDe(req), { acao: 'cliente.codigo_errado', alvoTipo: 'balcao', alvoId: l.balcao_id });
        return false;
      }
      await tx.codigoAcesso.update({ where: { id: c.id }, data: { usadoEm: new Date() } });
      const { token, hash } = novoToken();
      await tx.sessaoCliente.create({ data: { organizacaoId: l.organizacao_id, linkId: l.id, balcaoId: l.balcao_id, tokenHash: hash, expiraEm: new Date(Date.now() + VALIDADE_SESSAO_CLIENTE_MS) } });
      definirCookie(res, cookieDoBalcao(l.balcao_id), token, VALIDADE_SESSAO_CLIENTE_MS);
      await auditarComo(tx, l.organizacao_id, 'cliente', null, ipDe(req), { acao: 'cliente.entrou', alvoTipo: 'balcao', alvoId: l.balcao_id });
      return true;
    });
    if (!ok) throw new ErroHttp(400, 'Código errado. Confira a mensagem.', 'codigo_errado');
    res.json({ ok: true });
  }),
);

if (emDesenvolvimento) {
  /** Desenvolvimento: o último código "enviado" para este balcão, lido da caixa de saída de dev. */
  rotasAcesso.get(
    '/dev-codigo',
    rota(async (req, res) => {
      const l = await linkValido(req);
      const m = await naOrganizacao(l.organizacao_id, (tx) => tx.caixaSaidaDev.findFirst({ where: { balcaoId: l.balcao_id }, orderBy: { criadaEm: 'desc' } }));
      res.json({ codigo: m?.texto.match(/\b(\d{6})\b/)?.[1] ?? null });
    }),
  );
}

/* ---------- Sessão do cliente ---------- */

/** Exige o link (x-link) e a sessão daquele balcão neste aparelho. */
export async function exigirCliente(req: Request, _res: Response, next: NextFunction) {
  try {
    const l = await linkValido(req);
    const token = req.cookies?.[cookieDoBalcao(l.balcao_id)];
    const s = typeof token === 'string' && token ? await sessaoClientePorToken(hashToken(token)) : null;
    // Qualquer link ativo do balcão serve: lembretes trazem links novos e a sessão continua.
    if (!s || s.balcao_id !== l.balcao_id) throw new ErroHttp(401, 'Digite o código para abrir o balcão.', 'sem_sessao');
    req.cliente = { sessaoId: s.id, organizacaoId: s.organizacao_id, balcaoId: s.balcao_id, linkId: s.link_id };
    next();
  } catch (e) {
    next(e);
  }
}

export const rotasCliente = Router();

rotasCliente.get(
  '/balcao',
  rota(async (req, res) => {
    const { organizacaoId, balcaoId } = req.cliente!;
    const dados = await naOrganizacao(organizacaoId, async (tx): Promise<BalcaoCliente> => {
      const b = await tx.balcao.findUniqueOrThrow({ where: { id: balcaoId }, include: { cliente: { select: { nome: true } } } });
      const itens = await tx.itemBalcao.findMany({
        where: { balcaoId, removidoEm: null },
        orderBy: { ordem: 'asc' },
        include: { documentos: { where: { status: { in: ['quarentena', 'disponivel'] } }, select: { status: true, enviadoEm: true, chaveMiniatura: true }, orderBy: { enviadoEm: 'desc' } } },
      });
      return {
        organizacao: await marca(tx, organizacaoId),
        clientePrimeiroNome: primeiroNome(b.cliente.nome),
        tipo: b.tipo,
        prazo: b.prazo.toISOString().slice(0, 10),
        concluido: !!b.concluidoEm,
        itens: itens.map((i) => {
          // Só conta o que veio depois do último "pedir de novo".
          const docs = i.documentos.filter((d) => d.enviadoEm > (i.pedidoDeNovoEm ?? new Date(0)));
          const ultimo = docs.find((d) => d.status === 'disponivel');
          return {
            id: i.id,
            nome: i.nome,
            detalhe: i.detalhe,
            obrigatorio: i.obrigatorio,
            status: i.status,
            motivo: i.motivoRecusa,
            verificando: docs[0]?.status === 'quarentena',
            temMiniatura: i.status !== 'pendente' && !!ultimo?.chaveMiniatura,
          };
        }),
      };
    });
    res.json(dados);
  }),
);

/** Devolve um POST assinado para o celular mandar o arquivo direto para a quarentena. */
rotasCliente.post(
  '/itens/:id/upload',
  limites.upload,
  rota(async (req, res) => {
    const { organizacaoId, balcaoId } = req.cliente!;
    const d = validar(IniciarUploadEntrada, req.body);
    const r = await naOrganizacao(organizacaoId, async (tx): Promise<UploadIniciado> => {
      const item = await tx.itemBalcao.findFirst({ where: { id: req.params.id, balcaoId, removidoEm: null }, include: { balcao: { select: { concluidoEm: true } } } });
      if (!item || item.balcao.concluidoEm) throw naoEncontrado('Documento não encontrado.');
      if (item.status === 'aprovado' || item.status === 'analise') throw new ErroHttp(409, 'Este documento já foi enviado.');
      // Uploads abandonados deste item saem da frente.
      await tx.documento.updateMany({ where: { itemId: item.id, status: 'quarentena' }, data: { status: 'rejeitado', motivo: 'substituido' } });
      const id = randomUUID();
      const chave = chaveDocumento(organizacaoId, id);
      await tx.documento.create({ data: { id, organizacaoId, balcaoId, itemId: item.id, chave, nomeArquivo: d.nomeArquivo, tipoDeclarado: d.tipo, tamanho: d.tamanho } });
      const post = await urlDeUpload(chave, d.tipo, d.tamanho);
      return { documentoId: id, url: post.url, campos: post.fields };
    });
    res.json(r);
  }),
);

/** O celular avisa que o upload terminou; o worker verifica e só então o arquivo sai da quarentena. */
rotasCliente.post(
  '/documentos/:id/enviado',
  rota(async (req, res) => {
    const { organizacaoId, balcaoId } = req.cliente!;
    await naOrganizacao(organizacaoId, async (tx) => {
      const doc = await tx.documento.findFirst({ where: { id: req.params.id, balcaoId, status: 'quarentena' } });
      if (!doc) throw naoEncontrado('Envio não encontrado.');
      const obj = await existe(BUCKET_QUARENTENA, doc.chave);
      if (!obj) throw new ErroHttp(400, 'O arquivo não chegou. Tente enviar de novo.');
      if (obj.tamanho > TAMANHO_MAXIMO_ARQUIVO) throw new ErroHttp(413, 'O arquivo passa de 10 MB.');
      await tx.documento.update({ where: { id: doc.id }, data: { tamanho: obj.tamanho } });
      await auditar(tx, req, { acao: 'documento.enviado', alvoTipo: 'documento', alvoId: doc.id, detalhes: { balcaoId } });
    });
    await enfileirar('verificar-documento', { organizacaoId, documentoId: req.params.id });
    res.status(202).json({ ok: true });
  }),
);

/** Miniatura do que o cliente enviou. O original não volta para o celular. */
rotasCliente.get(
  '/itens/:id/miniatura',
  rota(async (req, res) => {
    const { organizacaoId, balcaoId } = req.cliente!;
    const url = await naOrganizacao(organizacaoId, async (tx) => {
      const item = await tx.itemBalcao.findFirst({ where: { id: req.params.id, balcaoId, removidoEm: null } });
      if (!item) throw naoEncontrado('Documento não encontrado.');
      const d = await tx.documento.findFirst({
        where: { itemId: item.id, status: 'disponivel', chaveMiniatura: { not: null }, enviadoEm: { gt: item.pedidoDeNovoEm ?? new Date(0) } },
        orderBy: { enviadoEm: 'desc' },
      });
      if (!d?.chaveMiniatura) throw naoEncontrado('Sem miniatura.');
      return urlDeDownload(BUCKET_DOCUMENTOS, d.chaveMiniatura, 'miniatura.webp', 'image/webp', false);
    });
    res.json({ url });
  }),
);

rotasCliente.post(
  '/sair',
  rota(async (req, res) => {
    const { organizacaoId, sessaoId, balcaoId } = req.cliente!;
    await naOrganizacao(organizacaoId, (tx) => tx.sessaoCliente.delete({ where: { id: sessaoId } }));
    limparCookie(res, cookieDoBalcao(balcaoId));
    res.status(204).end();
  }),
);
