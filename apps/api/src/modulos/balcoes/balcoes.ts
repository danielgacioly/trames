import { Router, type Request } from 'express';
import { contarBalcaoCriado, marcarAviso, naOrganizacao, type Tx } from '@trames/db';
import { BUCKET_DOCUMENTOS, urlDeDownload } from '@trames/db/armazenamento';
import {
  AdicionarItensEntrada,
  AVISO_BALCOES_NO_MES,
  ConfigBalcaoEntrada,
  CriarBalcaoEntrada,
  diasRetencao,
  EditarItemEntrada,
  EnviarLinkEntrada,
  mesDe,
  MoverParaPastaEntrada,
  PRECO_EXCEDENTE_CENTAVOS,
  RecusarEntrada,
  RegistrarEnvioEntrada,
  ReordenarEntrada,
  type BalcaoDetalhe,
  type BalcaoResumo,
  type Contagem,
  type DocumentoDto,
  type ItemDetalhe,
  type LinkGerado,
} from '@trames/shared';
import { ErroHttp, naoEncontrado } from '../../infra/erros';
import { enfileirar } from '../../infra/fila';
import { rota, validar } from '../../infra/http';
import { criarLink, emitirLink, linkDaUrl, selarConteudo } from '../acesso-cliente/links';
import { auditar } from '../auditoria/auditoria';
import { exigirMontar, exigirRecurso, plano } from '../auth/permissoes';
import { cifrarDadosCliente, decifrarDadosCliente, hmac } from '../clientes/cifra';
import { agendarAvisoMudanca, avisarAdmins } from '../organizacoes/avisos';

const dataISO = (d: Date) => d.toISOString().slice(0, 10);

/** Itens removidos da lista não aparecem nem contam no progresso. */
const ATIVOS = { removidoEm: null };

type BalcaoComItens = Awaited<ReturnType<typeof buscarBalcoes>>[number];

async function buscarBalcoes(tx: Tx, where: { id?: string; concluidoEm?: null } = {}) {
  const lista = await tx.balcao.findMany({
    where,
    include: { cliente: { select: { id: true, nome: true, email: true, telefoneFinal: true } }, itens: { where: ATIVOS, select: { status: true } } },
    orderBy: { prazo: 'asc' },
  });
  // Quem abriu cada balcão (para as pastas por pessoa). Pessoa removida da conta fica sem nome.
  const ids = [...new Set(lista.map((b) => b.criadoPorId).filter((x): x is string => !!x))];
  const pessoas = new Map((ids.length ? await tx.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }) : []).map((u) => [u.id, u]));
  return lista.map((b) => ({ ...b, responsavel: (b.criadoPorId && pessoas.get(b.criadoPorId)) || null }));
}

/** Confere que a pasta é do escritório. A FK não passa pelo RLS, então a checagem é aqui. */
export async function exigirPasta(tx: Tx, pastaId: string | null) {
  if (pastaId && !(await tx.pasta.findUnique({ where: { id: pastaId }, select: { id: true } }))) throw naoEncontrado('Pasta não encontrada.');
}

export function contar(itens: { status: keyof Omit<Contagem, 'total'> }[]): Contagem {
  const c = { pendente: 0, analise: 0, aprovado: 0, recusado: 0, total: itens.length };
  itens.forEach((i) => c[i.status]++);
  return c;
}

export function resumo(b: BalcaoComItens): BalcaoResumo {
  return {
    id: b.id,
    protocolo: b.protocolo,
    tipo: b.tipo,
    clienteNome: b.cliente.nome,
    prazo: dataISO(b.prazo),
    criadoEm: b.criadoEm.toISOString(),
    lembrete: b.lembrete,
    canalLembrete: b.canalLembrete as 'email' | 'whatsapp',
    canalCodigo: b.canalCodigo as 'email' | 'whatsapp',
    concluidoEm: b.concluidoEm?.toISOString() ?? null,
    arquivadoEm: b.arquivadoEm?.toISOString() ?? null,
    apagarArquivosEm: b.apagarArquivosEm?.toISOString() ?? null,
    arquivosApagadosEm: b.arquivosApagadosEm?.toISOString() ?? null,
    contagem: contar(b.itens),
    pastaId: b.pastaId,
    responsavel: b.responsavel,
  };
}

export async function balcoesAtivos(tx: Tx) {
  return tx.balcao.count({ where: { concluidoEm: null } });
}

async function exigirLimite(tx: Tx, limite: number | null) {
  if (limite !== null && (await balcoesAtivos(tx)) >= limite) {
    throw new ErroHttp(402, `Seu plano permite ${limite} balcões ativos. Conclua um balcão que já terminou ou mude de plano.`, 'limite_balcoes');
  }
}

/** WhatsApp (código e lembretes) é do Pro e do Ultra; e-mail precisa do e-mail do cliente. */
function conferirCanais(req: Request, canais: (string | undefined)[], emailCliente: string) {
  if (canais.includes('whatsapp')) exigirRecurso(req, 'whatsapp');
  if (canais.includes('email') && !emailCliente) throw new ErroHttp(400, 'Este cliente não tem e-mail. Cadastre o e-mail ou escolha o WhatsApp.');
}

const doc = (d: {
  id: string;
  nomeArquivo: string;
  tipoReal: string | null;
  tipoDeclarado: string;
  tamanho: number;
  status: DocumentoDto['status'];
  motivo: string | null;
  enviadoEm: Date;
  chaveMiniatura: string | null;
}): DocumentoDto => ({
  id: d.id,
  nomeArquivo: d.nomeArquivo,
  tipo: d.tipoReal ?? d.tipoDeclarado,
  tamanho: d.tamanho,
  status: d.status,
  motivo: d.motivo,
  enviadoEm: d.enviadoEm.toISOString(),
  temMiniatura: !!d.chaveMiniatura,
});

async function detalhe(tx: Tx, id: string): Promise<BalcaoDetalhe> {
  const b = (await buscarBalcoes(tx, { id }))[0];
  if (!b) throw naoEncontrado('Balcão não encontrado.');
  const agora = new Date();
  const itens = await tx.itemBalcao.findMany({
    where: { balcaoId: id, ...ATIVOS },
    orderBy: { ordem: 'asc' },
    include: { documentos: { where: { status: { not: 'apagado' }, OR: [{ motivo: null }, { motivo: { not: 'substituido' } }] }, orderBy: { enviadoEm: 'desc' } } },
  });
  const link = await tx.linkAcesso.findFirst({ where: { balcaoId: id, revogadoEm: null, expiraEm: { gt: agora } }, orderBy: { criadoEm: 'desc' } });
  const sessoesCliente = link ? await tx.sessaoCliente.count({ where: { balcaoId: id, expiraEm: { gt: agora } } }) : 0;
  const exp = await tx.exportacao.findFirst({ where: { balcaoId: id, OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }] }, orderBy: { criadaEm: 'desc' } });
  return {
    ...resumo(b),
    cliente: { id: b.cliente.id, nome: b.cliente.nome, email: b.cliente.email, whatsappFinal: b.cliente.telefoneFinal },
    link: link ? { criadoEm: link.criadoEm.toISOString(), expiraEm: link.expiraEm.toISOString() } : null,
    sessoesCliente,
    exportacao: exp ? { id: exp.id, status: exp.status, criadaEm: exp.criadaEm.toISOString(), expiraEm: exp.expiraEm?.toISOString() ?? null } : null,
    itens: itens.map((i): ItemDetalhe => {
      // Depois de "pedir de novo", os arquivos anteriores ficam só no histórico do item.
      const corte = i.pedidoDeNovoEm?.getTime() ?? 0;
      const atual = i.documentos.find((d) => d.enviadoEm.getTime() > corte) ?? null;
      return {
        id: i.id,
        nome: i.nome,
        detalhe: i.detalhe,
        obrigatorio: i.obrigatorio,
        status: i.status,
        motivo: i.motivoRecusa,
        documento: atual ? doc(atual) : null,
        historico: i.documentos.filter((d) => d !== atual && d.status === 'disponivel').map(doc),
      };
    }),
  };
}

async function proximoProtocolo(tx: Tx) {
  const n = (await tx.balcao.count()) + 1;
  for (let k = n; ; k++) {
    const protocolo = `TRM-${new Date().getFullYear()}-${String(k).padStart(5, '0')}`;
    if (!(await tx.balcao.findFirst({ where: { protocolo }, select: { id: true } }))) return protocolo;
  }
}

async function balcaoAberto(tx: Tx, id: string) {
  const b = await tx.balcao.findUnique({ where: { id }, include: { cliente: true } });
  if (!b) throw naoEncontrado('Balcão não encontrado.');
  if (b.concluidoEm) throw new ErroHttp(409, 'Este balcão está concluído. Reabra para mexer nele.', 'balcao_concluido');
  return b;
}

/**
 * Conclui ou arquiva: revoga os links e derruba as sessões do cliente. Só a conclusão
 * agenda a exclusão dos arquivos; um balcão arquivado guarda os arquivos até ser reaberto e concluído.
 */
export async function encerrar(tx: Tx, balcaoId: string, diasRet: number, arquivar: boolean) {
  const agora = new Date();
  await tx.balcao.update({
    where: { id: balcaoId },
    data: { concluidoEm: agora, arquivadoEm: arquivar ? agora : null, apagarArquivosEm: arquivar ? null : new Date(agora.getTime() + diasRet * 86_400_000), avisoRetencaoEm: null },
  });
  await tx.linkAcesso.updateMany({ where: { balcaoId, revogadoEm: null }, data: { revogadoEm: agora } });
  await tx.sessaoCliente.deleteMany({ where: { balcaoId } });
}

/**
 * Quando a retenção diminui (plano mais barato ou escolha menor no Ultra), os
 * balcões já encerrados passam a seguir o prazo novo, nunca menos de 7 dias a
 * partir de agora, para o aviso por e-mail ainda sair. Quando aumenta, nada muda.
 */
export async function limitarRetencao(tx: Tx, diasRet: number) {
  return tx.$executeRaw`
    UPDATE balcoes SET
      apagar_arquivos_em = GREATEST(concluido_em + make_interval(days => ${diasRet}::int), now() + interval '7 days'),
      aviso_retencao_em = NULL
    WHERE concluido_em IS NOT NULL AND arquivado_em IS NULL AND arquivos_apagados_em IS NULL
      AND apagar_arquivos_em > GREATEST(concluido_em + make_interval(days => ${diasRet}::int), now() + interval '7 days')`;
}

const reais = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const rotasBalcoes = Router();

rotasBalcoes.get(
  '/',
  rota(async (req, res) => {
    const lista = await naOrganizacao(req.empresa!.organizacao.id, (tx) => buscarBalcoes(tx));
    res.json(lista.map(resumo));
  }),
);

rotasBalcoes.post(
  '/',
  rota(async (req, res) => {
    exigirMontar(req);
    const d = validar(CriarBalcaoEntrada, req.body);
    const p = plano(req);
    const org = req.empresa!.organizacao.id;
    conferirCanais(req, [d.canalCodigo, d.lembrete ? d.canalLembrete : undefined], d.cliente.email);
    const cifrado = await cifrarDadosCliente(org, d.cliente.cpf, d.cliente.whatsapp);
    const r = await naOrganizacao(org, async (tx) => {
      await exigirLimite(tx, p.limiteBalcoes);
      await exigirPasta(tx, d.pastaId);
      // Mesmo cliente (pelo HMAC do telefone) reaproveita o cadastro.
      const existente = await tx.cliente.findFirst({ where: { telefoneHmac: hmac(org, d.cliente.whatsapp) } });
      const cliente = existente
        ? await tx.cliente.update({ where: { id: existente.id }, data: { nome: d.cliente.nome, email: d.cliente.email || existente.email, ...(d.cliente.cpf ? cifrado : {}) } })
        : await tx.cliente.create({ data: { organizacaoId: org, nome: d.cliente.nome, email: d.cliente.email, ...cifrado } });
      const prazo = new Date(`${d.prazo}T00:00:00Z`);
      const b = await tx.balcao.create({
        data: {
          organizacaoId: org,
          clienteId: cliente.id,
          protocolo: await proximoProtocolo(tx),
          tipo: d.tipo,
          prazo,
          canalCodigo: d.canalCodigo,
          lembrete: d.lembrete,
          canalLembrete: d.canalLembrete,
          criadoPorId: req.empresa!.usuario.id,
          pastaId: d.pastaId,
          itens: { create: d.itens.map((it, k) => ({ ...it, ordem: k, organizacaoId: org })) },
        },
      });
      const link = await criarLink(tx, org, b.id, prazo);
      await auditar(tx, req, { acao: 'balcao.criado', alvoTipo: 'balcao', alvoId: b.id, detalhes: { itens: d.itens.length } });
      await auditar(tx, req, { acao: 'link.criado', alvoTipo: 'link', alvoId: link.linkId, detalhes: { balcaoId: b.id } });

      // Contador do mês (criado_em, fuso de Brasília). Apagar o balcão depois não devolve a vaga.
      const mes = mesDe();
      const noMes = await contarBalcaoCriado(tx, org, mes);
      const incluidos = p.balcoesNoMes;
      let excedente = false;
      const avisos: [string, string][] = [];
      if (incluidos !== null) {
        if (noMes > incluidos) {
          excedente = true;
          await tx.itemCobranca.create({
            data: { organizacaoId: org, mesReferencia: mes, tipo: 'balcao_excedente', descricao: `Balcão ${b.protocolo} (excedente de ${mes})`, valorCentavos: PRECO_EXCEDENTE_CENTAVOS, balcaoId: b.id },
          });
          await auditar(tx, req, { acao: 'cobranca.excedente', alvoTipo: 'balcao', alvoId: b.id, detalhes: { mes, valorCentavos: PRECO_EXCEDENTE_CENTAVOS } });
          if (await marcarAviso(tx, org, 'aviso_200_em', mes)) {
            avisos.push([
              `Você passou dos ${incluidos} balcões do mês`,
              `A conta ${req.empresa!.organizacao.nome} criou mais de ${incluidos} balcões em ${mes}. Cada balcão novo a partir de agora custa ${reais(PRECO_EXCEDENTE_CENTAVOS)} e entra na próxima fatura. Nada foi bloqueado.`,
            ]);
          }
        } else if (noMes >= AVISO_BALCOES_NO_MES && (await marcarAviso(tx, org, 'aviso_180_em', mes))) {
          avisos.push([
            `${noMes} de ${incluidos} balcões do mês`,
            `A conta ${req.empresa!.organizacao.nome} já criou ${noMes} dos ${incluidos} balcões incluídos no plano em ${mes}. Depois disso, cada balcão novo custa ${reais(PRECO_EXCEDENTE_CENTAVOS)}, somado à próxima fatura.`,
          ]);
        }
      }
      return { id: b.id, link: { url: link.url, expiraEm: link.expiraEm } satisfies LinkGerado, excedente, avisos };
    });
    for (const [assunto, texto] of r.avisos) await avisarAdmins(org, assunto, texto);
    res.status(201).json({ id: r.id, link: r.link, excedente: r.excedente });
  }),
);

rotasBalcoes.get(
  '/:id',
  rota(async (req, res) => {
    res.json(await naOrganizacao(req.empresa!.organizacao.id, (tx) => detalhe(tx, req.params.id)));
  }),
);

/** Prazo, lembretes e canal do código. Mudar o prazo recomeça a cadência dos lembretes. */
rotasBalcoes.patch(
  '/:id',
  rota(async (req, res) => {
    exigirMontar(req);
    const d = validar(ConfigBalcaoEntrada, req.body);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const b = await balcaoAberto(tx, req.params.id);
      const lembrete = d.lembrete ?? b.lembrete;
      conferirCanais(req, [d.canalCodigo, lembrete ? d.canalLembrete : undefined], b.cliente.email);
      const prazo = d.prazo ? new Date(`${d.prazo}T00:00:00Z`) : undefined;
      const mudouPrazo = prazo && prazo.getTime() !== b.prazo.getTime();
      await tx.balcao.update({
        where: { id: b.id },
        data: { prazo, lembrete: d.lembrete, canalLembrete: d.canalLembrete, canalCodigo: d.canalCodigo, ...(mudouPrazo ? { lembretesEnviados: [], avisoArquivoEm: null } : {}) },
      });
      const antes = { prazo: dataISO(b.prazo), lembrete: b.lembrete, canalLembrete: b.canalLembrete, canalCodigo: b.canalCodigo };
      await auditar(tx, req, { acao: 'balcao.alterado', alvoTipo: 'balcao', alvoId: b.id, detalhes: { antes, depois: { ...antes, ...d } } });
    });
    res.status(204).end();
  }),
);

/** Põe o balcão numa pasta do escritório ou tira dele (vale também para balcões encerrados). */
rotasBalcoes.put(
  '/:id/pasta',
  rota(async (req, res) => {
    exigirMontar(req);
    const { pastaId } = validar(MoverParaPastaEntrada, req.body);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const b = await tx.balcao.findUnique({ where: { id: req.params.id }, select: { id: true, pastaId: true } });
      if (!b) throw naoEncontrado('Balcão não encontrado.');
      await exigirPasta(tx, pastaId);
      await tx.balcao.update({ where: { id: b.id }, data: { pastaId } });
      await auditar(tx, req, { acao: 'balcao.pasta', alvoTipo: 'balcao', alvoId: b.id, detalhes: { de: b.pastaId, para: pastaId } });
    });
    res.status(204).end();
  }),
);

/**
 * Emite um link para o escritório mandar (o banco só guarda o hash, então não dá
 * para mostrar um link antigo de novo). Os links anteriores continuam valendo.
 */
rotasBalcoes.post(
  '/:id/links',
  rota(async (req, res) => {
    exigirMontar(req);
    const r = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const b = await balcaoAberto(tx, req.params.id);
      const l = await emitirLink(tx, b.organizacaoId, b.id, b.prazo);
      await auditar(tx, req, { acao: 'link.criado', alvoTipo: 'link', alvoId: l.linkId, detalhes: { balcaoId: b.id } });
      return { url: l.url, expiraEm: l.expiraEm } satisfies LinkGerado;
    });
    res.json(r);
  }),
);

/** Gera um link novo e revoga todos os anteriores (e com eles as sessões abertas do cliente). */
rotasBalcoes.post(
  '/:id/link',
  rota(async (req, res) => {
    exigirMontar(req);
    const r = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const b = await tx.balcao.findUnique({ where: { id: req.params.id } });
      if (!b || b.concluidoEm) throw naoEncontrado('Balcão não encontrado ou já concluído.');
      const link = await criarLink(tx, b.organizacaoId, b.id, b.prazo);
      await auditar(tx, req, { acao: 'link.criado', alvoTipo: 'link', alvoId: link.linkId, detalhes: { balcaoId: b.id, renovado: true } });
      return { url: link.url, expiraEm: link.expiraEm } satisfies LinkGerado;
    });
    res.json(r);
  }),
);

rotasBalcoes.delete(
  '/:id/link',
  rota(async (req, res) => {
    exigirMontar(req);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const n = await tx.linkAcesso.updateMany({ where: { balcaoId: req.params.id, revogadoEm: null }, data: { revogadoEm: new Date() } });
      await tx.sessaoCliente.deleteMany({ where: { balcaoId: req.params.id } });
      if (n.count) await auditar(tx, req, { acao: 'link.revogado', alvoTipo: 'balcao', alvoId: req.params.id });
    });
    res.status(204).end();
  }),
);

/** Encerra o acesso do cliente em todos os aparelhos. O link continua valendo, com código novo. */
rotasBalcoes.delete(
  '/:id/sessoes',
  rota(async (req, res) => {
    exigirMontar(req);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const n = await tx.sessaoCliente.deleteMany({ where: { balcaoId: req.params.id } });
      await auditar(tx, req, { acao: 'cliente.acesso_encerrado', alvoTipo: 'balcao', alvoId: req.params.id, detalhes: { sessoes: n.count } });
    });
    res.status(204).end();
  }),
);

/** O escritório copiou o link: fica na auditoria. */
rotasBalcoes.post(
  '/:id/registrar-envio',
  rota(async (req, res) => {
    const { canal } = validar(RegistrarEnvioEntrada, req.body);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      if (!(await tx.balcao.findUnique({ where: { id: req.params.id }, select: { id: true } }))) throw naoEncontrado('Balcão não encontrado.');
      await auditar(tx, req, { acao: canal === 'copiado' ? 'link.copiado' : 'link.aberto_whatsapp', alvoTipo: 'balcao', alvoId: req.params.id, detalhes: { canal } });
    });
    res.status(204).end();
  }),
);

/**
 * Monta o endereço wa.me com o telefone do cliente e a mensagem com o link. Quem
 * envia é o WhatsApp do próprio escritório: a Trames não manda essa mensagem.
 */
rotasBalcoes.post(
  '/:id/whatsapp',
  rota(async (req, res) => {
    exigirMontar(req);
    const { mensagem, url } = validar(EnviarLinkEntrada, req.body);
    const org = req.empresa!.organizacao.id;
    const r = await naOrganizacao(org, async (tx) => {
      const b = await balcaoAberto(tx, req.params.id);
      const l = await linkDaUrl(tx, b.id, url);
      if (!l) throw new ErroHttp(400, 'Este link não vale mais. Gere um novo.');
      const { telefone } = await decifrarDadosCliente(b.cliente);
      const numero = telefone.length <= 11 ? `55${telefone}` : telefone;
      await auditar(tx, req, { acao: 'link.aberto_whatsapp', alvoTipo: 'link', alvoId: l.id, detalhes: { balcaoId: b.id, canal: 'whatsapp' } });
      return { url: `https://wa.me/${numero}?text=${encodeURIComponent(`${mensagem.trim()} ${url}`.trim())}` };
    });
    res.json(r);
  }),
);

/** Manda o link por e-mail, pela Trames (SES). */
rotasBalcoes.post(
  '/:id/enviar-link',
  rota(async (req, res) => {
    exigirMontar(req);
    const d = validar(EnviarLinkEntrada, req.body);
    const org = req.empresa!.organizacao.id;
    await naOrganizacao(org, async (tx) => {
      const b = await balcaoAberto(tx, req.params.id);
      if (!b.cliente.email) throw new ErroHttp(400, 'Este cliente não tem e-mail cadastrado.');
      const l = await linkDaUrl(tx, b.id, d.url);
      if (!l) throw new ErroHttp(400, 'Este link não vale mais. Gere um novo.');
      await auditar(tx, req, { acao: 'link.enviado', alvoTipo: 'link', alvoId: l.id, detalhes: { balcaoId: b.id, canal: 'email' } });
    });
    await enfileirar('enviar-mensagem', { organizacaoId: org, balcaoId: req.params.id, tipo: 'link', canal: 'email', selado: await selarConteudo(org, { url: d.url, texto: d.mensagem }) });
    res.status(202).json({ ok: true });
  }),
);

/** Lembrete manual, pelo canal escolhido no balcão. Leva um link novo; os anteriores e a sessão do cliente continuam. */
rotasBalcoes.post(
  '/:id/lembrar',
  rota(async (req, res) => {
    exigirMontar(req);
    const org = req.empresa!.organizacao.id;
    const r = await naOrganizacao(org, async (tx) => {
      const b = await balcaoAberto(tx, req.params.id);
      const l = await emitirLink(tx, org, b.id, b.prazo);
      await tx.balcao.update({ where: { id: b.id }, data: { ultimoLembreteEm: new Date() } });
      await auditar(tx, req, { acao: 'lembrete.enviado', alvoTipo: 'balcao', alvoId: b.id, detalhes: { manual: true, canal: b.canalLembrete } });
      return { url: l.url, canal: b.canalLembrete === 'whatsapp' && plano(req).recursos.whatsapp ? ('whatsapp' as const) : ('email' as const) };
    });
    await enfileirar('enviar-mensagem', { organizacaoId: org, balcaoId: req.params.id, tipo: 'lembrete', canal: r.canal, selado: await selarConteudo(org, { url: r.url, etapa: 'manual' }) });
    res.status(202).json({ canal: r.canal });
  }),
);

/** Conclui o balcão: o link e as sessões do cliente caem, e a exclusão dos arquivos fica agendada. */
rotasBalcoes.post(
  '/:id/concluir',
  rota(async (req, res) => {
    exigirMontar(req);
    const dias = diasRetencao(req.empresa!.plano, req.empresa!.organizacao.diasRetencao);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const b = await balcaoAberto(tx, req.params.id);
      const itens = await tx.itemBalcao.findMany({ where: { balcaoId: b.id, ...ATIVOS } });
      if (itens.some((i) => i.obrigatorio && i.status !== 'aprovado')) throw new ErroHttp(400, 'Aprove todos os documentos obrigatórios antes de concluir.');
      await encerrar(tx, b.id, dias, false);
      await auditar(tx, req, { acao: 'balcao.concluido', alvoTipo: 'balcao', alvoId: b.id, detalhes: { diasRetencao: dias } });
    });
    res.status(204).end();
  }),
);

/**
 * Arquiva um balcão que não vai ser concluído (o cliente desistiu, o caso parou).
 * Para de contar como ativo e o acesso do cliente cai. Os arquivos não são apagados:
 * a retenção só vale para balcões concluídos. O worker também arquiva sozinho 30 dias depois do prazo.
 */
rotasBalcoes.post(
  '/:id/arquivar',
  rota(async (req, res) => {
    exigirMontar(req);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const b = await balcaoAberto(tx, req.params.id);
      await encerrar(tx, b.id, 0, true);
      await auditar(tx, req, { acao: 'balcao.arquivado', alvoTipo: 'balcao', alvoId: b.id, detalhes: { automatico: false } });
    });
    res.status(204).end();
  }),
);

rotasBalcoes.post(
  '/:id/reabrir',
  rota(async (req, res) => {
    exigirMontar(req);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const b = await tx.balcao.findUnique({ where: { id: req.params.id } });
      if (!b) throw naoEncontrado('Balcão não encontrado.');
      if (b.arquivosApagadosEm) throw new ErroHttp(400, 'Os arquivos deste balcão já foram apagados pela política de retenção.');
      await exigirLimite(tx, plano(req).limiteBalcoes);
      await tx.balcao.update({ where: { id: b.id }, data: { concluidoEm: null, arquivadoEm: null, apagarArquivosEm: null, avisoRetencaoEm: null, avisoArquivoEm: null } });
      await auditar(tx, req, { acao: 'balcao.reaberto', alvoTipo: 'balcao', alvoId: b.id });
    });
    res.status(204).end();
  }),
);

/* ---------- Editar a lista de um balcão aberto ---------- */

/** Adiciona documentos (escritos na hora ou puxados de um modelo). Entram como pendentes. */
rotasBalcoes.post(
  '/:id/itens',
  rota(async (req, res) => {
    exigirMontar(req);
    const { itens } = validar(AdicionarItensEntrada, req.body);
    const org = req.empresa!.organizacao.id;
    const ids = await naOrganizacao(org, async (tx) => {
      const b = await balcaoAberto(tx, req.params.id);
      const ativos = await tx.itemBalcao.count({ where: { balcaoId: b.id, ...ATIVOS } });
      if (ativos + itens.length > 60) throw new ErroHttp(400, 'Um balcão pode ter até 60 documentos.');
      const ultimo = await tx.itemBalcao.aggregate({ where: { balcaoId: b.id }, _max: { ordem: true } });
      const base = (ultimo._max.ordem ?? -1) + 1;
      const criados: string[] = [];
      for (const [k, it] of itens.entries()) {
        const novo = await tx.itemBalcao.create({ data: { ...it, organizacaoId: org, balcaoId: b.id, ordem: base + k } });
        await auditar(tx, req, { acao: 'item.adicionado', alvoTipo: 'item', alvoId: novo.id, detalhes: { balcaoId: b.id, depois: it } });
        criados.push(novo.id);
      }
      return criados;
    });
    await agendarAvisoMudanca(org, req.params.id);
    res.status(201).json({ ids });
  }),
);

/** Muda a ordem em que o cliente vê os itens. Recebe todos os itens da lista, na ordem nova. */
rotasBalcoes.put(
  '/:id/ordem',
  rota(async (req, res) => {
    exigirMontar(req);
    const { ids } = validar(ReordenarEntrada, req.body);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const b = await balcaoAberto(tx, req.params.id);
      const atuais = await tx.itemBalcao.findMany({ where: { balcaoId: b.id, ...ATIVOS }, orderBy: { ordem: 'asc' }, select: { id: true } });
      const mesmos = atuais.length === ids.length && new Set(ids).size === ids.length && atuais.every((i) => ids.includes(i.id));
      if (!mesmos) throw new ErroHttp(400, 'A lista mudou enquanto você reordenava. Recarregue e tente de novo.');
      for (const [k, id] of ids.entries()) await tx.itemBalcao.update({ where: { id }, data: { ordem: k } });
      await auditar(tx, req, { acao: 'itens.reordenados', alvoTipo: 'balcao', alvoId: b.id, detalhes: { antes: atuais.map((i) => i.id), depois: ids } });
    });
    res.status(204).end();
  }),
);

/* ---------- Exportação em ZIP ---------- */

rotasBalcoes.post(
  '/:id/exportar',
  rota(async (req, res) => {
    exigirMontar(req);
    const org = req.empresa!.organizacao.id;
    const id = await naOrganizacao(org, async (tx) => {
      const b = await tx.balcao.findUnique({ where: { id: req.params.id } });
      if (!b) throw naoEncontrado('Balcão não encontrado.');
      if (b.arquivosApagadosEm) throw new ErroHttp(400, 'Os arquivos deste balcão já foram apagados pela política de retenção.');
      const andamento = await tx.exportacao.findFirst({ where: { balcaoId: b.id, status: 'pendente' } });
      if (andamento) return andamento.id;
      const e = await tx.exportacao.create({ data: { organizacaoId: org, balcaoId: b.id, pedidaPorId: req.empresa!.usuario.id } });
      await auditar(tx, req, { acao: 'exportacao.pedida', alvoTipo: 'balcao', alvoId: b.id, detalhes: { exportacaoId: e.id } });
      return e.id;
    });
    await enfileirar('exportar', { organizacaoId: org, exportacaoId: id });
    res.status(202).json({ id });
  }),
);

rotasBalcoes.get(
  '/:id/exportacao/url',
  rota(async (req, res) => {
    const url = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const e = await tx.exportacao.findFirst({ where: { balcaoId: req.params.id, status: 'pronta', expiraEm: { gt: new Date() } }, orderBy: { criadaEm: 'desc' }, include: { balcao: { select: { protocolo: true } } } });
      if (!e?.chave) throw naoEncontrado('A exportação ainda não está pronta.');
      await auditar(tx, req, { acao: 'exportacao.baixou', alvoTipo: 'balcao', alvoId: req.params.id, detalhes: { exportacaoId: e.id } });
      return urlDeDownload(BUCKET_DOCUMENTOS, e.chave, `${e.balcao.protocolo}.zip`, 'application/zip', true);
    });
    res.json({ url });
  }),
);

/* ---------- Itens: conferir e editar ---------- */

export const rotasItens = Router();

rotasItens.post(
  '/:id/aprovar',
  rota(async (req, res) => {
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const item = await tx.itemBalcao.findUnique({ where: { id: req.params.id }, include: { documentos: { where: { status: 'disponivel' }, orderBy: { enviadoEm: 'desc' }, take: 1 } } });
      if (!item || item.removidoEm || item.status !== 'analise' || !item.documentos[0]) throw new ErroHttp(400, 'Este documento não está esperando conferência.');
      await tx.itemBalcao.update({ where: { id: item.id }, data: { status: 'aprovado', motivoRecusa: null } });
      await auditar(tx, req, { acao: 'documento.aprovou', alvoTipo: 'documento', alvoId: item.documentos[0].id, detalhes: { balcaoId: item.balcaoId, itemId: item.id } });
    });
    res.status(204).end();
  }),
);

rotasItens.post(
  '/:id/recusar',
  rota(async (req, res) => {
    const { motivo } = validar(RecusarEntrada, req.body);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const item = await tx.itemBalcao.findUnique({ where: { id: req.params.id }, include: { documentos: { where: { status: 'disponivel' }, orderBy: { enviadoEm: 'desc' }, take: 1 } } });
      if (!item || item.removidoEm || item.status !== 'analise' || !item.documentos[0]) throw new ErroHttp(400, 'Este documento não está esperando conferência.');
      await tx.itemBalcao.update({ where: { id: item.id }, data: { status: 'recusado', motivoRecusa: motivo } });
      await auditar(tx, req, { acao: 'documento.recusou', alvoTipo: 'documento', alvoId: item.documentos[0].id, detalhes: { balcaoId: item.balcaoId, itemId: item.id } });
    });
    res.status(204).end();
  }),
);

async function itemDeBalcaoAberto(tx: Tx, id: string) {
  const item = await tx.itemBalcao.findUnique({ where: { id }, include: { balcao: { select: { id: true, concluidoEm: true } } } });
  if (!item || item.removidoEm) throw naoEncontrado('Documento não encontrado.');
  if (item.balcao.concluidoEm) throw new ErroHttp(409, 'Este balcão está concluído. Reabra para mexer nele.', 'balcao_concluido');
  return item;
}

/**
 * Edita nome, explicação ou obrigatoriedade. Sem "pedir de novo", o status fica
 * como está (inclusive aprovado). Com "pedir de novo", o item volta a pendente e
 * os arquivos anteriores vão para o histórico dele.
 */
rotasItens.patch(
  '/:id',
  rota(async (req, res) => {
    exigirMontar(req);
    const d = validar(EditarItemEntrada, req.body);
    const org = req.empresa!.organizacao.id;
    const balcaoId = await naOrganizacao(org, async (tx) => {
      const item = await itemDeBalcaoAberto(tx, req.params.id);
      const antes = { nome: item.nome, detalhe: item.detalhe, obrigatorio: item.obrigatorio, status: item.status };
      const depois = {
        nome: d.nome ?? item.nome,
        detalhe: d.detalhe ?? item.detalhe,
        obrigatorio: d.obrigatorio ?? item.obrigatorio,
        status: d.pedirDeNovo ? ('pendente' as const) : item.status,
      };
      await tx.itemBalcao.update({
        where: { id: item.id },
        data: { nome: depois.nome, detalhe: depois.detalhe, obrigatorio: depois.obrigatorio, ...(d.pedirDeNovo ? { status: 'pendente', motivoRecusa: null, pedidoDeNovoEm: new Date() } : {}) },
      });
      if (d.pedirDeNovo) {
        // Envio ainda na verificação também fica para trás.
        await tx.documento.updateMany({ where: { itemId: item.id, status: 'quarentena' }, data: { status: 'rejeitado', motivo: 'substituido' } });
      }
      await auditar(tx, req, { acao: d.pedirDeNovo ? 'item.pedido_de_novo' : 'item.editado', alvoTipo: 'item', alvoId: item.id, detalhes: { balcaoId: item.balcaoId, antes, depois } });
      return d.pedirDeNovo ? item.balcaoId : null;
    });
    if (balcaoId) await agendarAvisoMudanca(org, balcaoId);
    res.status(204).end();
  }),
);

/**
 * Remove da lista. Se já há arquivo enviado, pede confirmação (?confirmar=1). Os
 * arquivos não são apagados na hora: saem da lista do cliente e seguem a retenção do balcão.
 */
rotasItens.delete(
  '/:id',
  rota(async (req, res) => {
    exigirMontar(req);
    const confirmado = req.query.confirmar === '1';
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const item = await itemDeBalcaoAberto(tx, req.params.id);
      const ativos = await tx.itemBalcao.count({ where: { balcaoId: item.balcaoId, ...ATIVOS } });
      if (ativos <= 1) throw new ErroHttp(400, 'O balcão precisa de pelo menos um documento.', 'ultimo_item');
      const arquivos = await tx.documento.count({ where: { itemId: item.id, status: { in: ['disponivel', 'quarentena'] } } });
      if (arquivos && !confirmado) throw new ErroHttp(409, `"${item.nome}" já tem arquivo enviado. Confirme para tirar da lista; o arquivo fica guardado até a retenção do balcão.`, 'confirmar');
      await tx.itemBalcao.update({ where: { id: item.id }, data: { removidoEm: new Date() } });
      await auditar(tx, req, { acao: 'item.removido', alvoTipo: 'item', alvoId: item.id, detalhes: { balcaoId: item.balcaoId, antes: { nome: item.nome, status: item.status }, arquivos } });
    });
    res.status(204).end();
  }),
);

/* ---------- Relatório (Ultra) ---------- */

export const rotasRelatorio = Router();

rotasRelatorio.get(
  '/',
  rota(async (req, res) => {
    exigirRecurso(req, 'relatorio');
    const lista = await naOrganizacao(req.empresa!.organizacao.id, (tx) => buscarBalcoes(tx, { concluidoEm: null }));
    res.json(lista.map(resumo));
  }),
);
