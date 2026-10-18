import { randomUUID } from 'node:crypto';
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
import { BUCKET_QUARENTENA, chaveDocumento, existe, urlDeUpload } from '@trames/db/armazenamento';
import {
  EntrarClienteEntrada,
  IniciarUploadEntrada,
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
 *  1. o link (token no cabeçalho x-link; o banco só tem o hash) mostra para quem é o balcão;
 *  2. o código de 6 dígitos, enviado por WhatsApp ou e-mail, abre uma sessão curta.
 */

const VALIDADE_SESSAO_CLIENTE_MS = 2 * 60 * 60 * 1000;
const hashCodigo = (linkId: string, codigo: string) => hmacBusca(config.CHAVE_HMAC, linkId, codigo);

async function linkValido(req: Request) {
  const token = req.get('x-link');
  if (!token || token.length < 30 || token.length > 100) throw new ErroHttp(404, 'Link não encontrado.', 'link_invalido');
  const l = await linkPorToken(hashToken(token));
  if (!l) throw new ErroHttp(404, 'Link não encontrado.', 'link_invalido');
  if (l.revogado_em || l.expira_em < new Date()) throw new ErroHttp(410, 'Este link foi substituído por um mais novo ou não vale mais. Use o link da mensagem mais recente do escritório.', 'link_vencido');
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
      const b = await tx.balcao.findUniqueOrThrow({ where: { id: l.balcao_id }, include: { cliente: true, _count: { select: { itens: true } } } });
      return {
        organizacao: await marca(tx, l.organizacao_id),
        clientePrimeiroNome: primeiroNome(b.cliente.nome),
        whatsappFinal: b.cliente.telefoneFinal,
        temEmail: !!b.cliente.email,
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
    const { canal } = validar(PedirCodigoEntrada, req.body ?? {});
    const codigo = novoCodigoSeisDigitos();
    await naOrganizacao(l.organizacao_id, async (tx) => {
      // Um código novo invalida os anteriores deste link.
      await tx.codigoAcesso.updateMany({ where: { linkId: l.id, usadoEm: null }, data: { expiraEm: new Date() } });
      await tx.codigoAcesso.create({
        data: { organizacaoId: l.organizacao_id, linkId: l.id, codigoHash: hashCodigo(l.id, codigo), canal, expiraEm: new Date(Date.now() + VALIDADE_CODIGO_MINUTOS * 60_000) },
      });
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
      definirCookie(res, COOKIE_CLIENTE, token, VALIDADE_SESSAO_CLIENTE_MS);
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

export async function exigirCliente(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_CLIENTE];
    const s = typeof token === 'string' && token ? await sessaoClientePorToken(hashToken(token)) : null;
    if (!s) throw new ErroHttp(401, 'Abra o link de novo e digite o código.', 'sem_sessao');
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
        where: { balcaoId },
        orderBy: { ordem: 'asc' },
        include: { documentos: { where: { status: 'quarentena' }, select: { id: true }, take: 1 } },
      });
      return {
        organizacao: await marca(tx, organizacaoId),
        clientePrimeiroNome: primeiroNome(b.cliente.nome),
        tipo: b.tipo,
        prazo: b.prazo.toISOString().slice(0, 10),
        concluido: !!b.concluidoEm,
        itens: itens.map((i) => ({ id: i.id, nome: i.nome, detalhe: i.detalhe, obrigatorio: i.obrigatorio, status: i.status, motivo: i.motivoRecusa, verificando: i.documentos.length > 0 })),
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
      const item = await tx.itemBalcao.findFirst({ where: { id: req.params.id, balcaoId }, include: { balcao: { select: { concluidoEm: true } } } });
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

rotasCliente.post(
  '/sair',
  rota(async (req, res) => {
    const { organizacaoId, sessaoId } = req.cliente!;
    await naOrganizacao(organizacaoId, (tx) => tx.sessaoCliente.delete({ where: { id: sessaoId } }));
    limparCookie(res, COOKIE_CLIENTE);
    res.status(204).end();
  }),
);
