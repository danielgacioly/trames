import { Router } from 'express';
import { z } from 'zod';
import { hashToken, naOrganizacao, type Tx } from '@trames/db';
import {
  CriarBalcaoEntrada,
  EnviarLinkEntrada,
  RecusarEntrada,
  type BalcaoDetalhe,
  type BalcaoResumo,
  type Contagem,
  type ItemDetalhe,
  type LinkGerado,
} from '@trames/shared';
import { ErroHttp, naoEncontrado } from '../../infra/erros';
import { enfileirar } from '../../infra/fila';
import { rota, validar } from '../../infra/http';
import { criarLink, selarConteudo, tokenDaUrl } from '../acesso-cliente/links';
import { auditar } from '../auditoria/auditoria';
import { exigirMontar, exigirRecurso, plano } from '../auth/permissoes';
import { cifrarDadosCliente, hmac } from '../clientes/cifra';

const dataISO = (d: Date) => d.toISOString().slice(0, 10);

type BalcaoComItens = Awaited<ReturnType<typeof buscarBalcoes>>[number];

function buscarBalcoes(tx: Tx, where: { id?: string; concluidoEm?: null } = {}) {
  return tx.balcao.findMany({
    where,
    include: { cliente: { select: { id: true, nome: true, email: true, telefoneFinal: true } }, itens: { select: { status: true } } },
    orderBy: { prazo: 'asc' },
  });
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
    lembrete: b.lembrete,
    concluidoEm: b.concluidoEm?.toISOString() ?? null,
    arquivosApagadosEm: b.arquivosApagadosEm?.toISOString() ?? null,
    contagem: contar(b.itens),
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

async function detalhe(tx: Tx, id: string): Promise<BalcaoDetalhe> {
  const b = (await buscarBalcoes(tx, { id }))[0];
  if (!b) throw naoEncontrado('Balcão não encontrado.');
  const itens = await tx.itemBalcao.findMany({
    where: { balcaoId: id },
    orderBy: { ordem: 'asc' },
    include: { documentos: { where: { status: { not: 'apagado' } }, orderBy: { enviadoEm: 'desc' }, take: 1 } },
  });
  const link = await tx.linkAcesso.findFirst({ where: { balcaoId: id, revogadoEm: null, expiraEm: { gt: new Date() } }, orderBy: { criadoEm: 'desc' } });
  return {
    ...resumo(b),
    cliente: { id: b.cliente.id, nome: b.cliente.nome, email: b.cliente.email, whatsappFinal: b.cliente.telefoneFinal },
    link: link ? { criadoEm: link.criadoEm.toISOString(), expiraEm: link.expiraEm.toISOString() } : null,
    itens: itens.map(
      (i): ItemDetalhe => ({
        id: i.id,
        nome: i.nome,
        detalhe: i.detalhe,
        obrigatorio: i.obrigatorio,
        status: i.status,
        motivo: i.motivoRecusa,
        documento: i.documentos[0]
          ? {
              id: i.documentos[0].id,
              nomeArquivo: i.documentos[0].nomeArquivo,
              tipo: i.documentos[0].tipoReal ?? i.documentos[0].tipoDeclarado,
              tamanho: i.documentos[0].tamanho,
              status: i.documentos[0].status,
              motivo: i.documentos[0].motivo,
              enviadoEm: i.documentos[0].enviadoEm.toISOString(),
              temMiniatura: !!i.documentos[0].chaveMiniatura,
            }
          : null,
      }),
    ),
  };
}

async function proximoProtocolo(tx: Tx) {
  const n = (await tx.balcao.count()) + 1;
  for (let k = n; ; k++) {
    const protocolo = `TRM-${new Date().getFullYear()}-${String(k).padStart(5, '0')}`;
    if (!(await tx.balcao.findFirst({ where: { protocolo }, select: { id: true } }))) return protocolo;
  }
}

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
    const lembrete = d.lembrete && p.recursos.lembretes;
    const cifrado = await cifrarDadosCliente(org, d.cliente.cpf, d.cliente.whatsapp);
    const r = await naOrganizacao(org, async (tx) => {
      await exigirLimite(tx, p.limiteBalcoes);
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
          lembrete,
          criadoPorId: req.empresa!.usuario.id,
          itens: { create: d.itens.map((it, k) => ({ ...it, ordem: k, organizacaoId: org })) },
        },
      });
      const link = await criarLink(tx, org, b.id, prazo);
      await auditar(tx, req, { acao: 'balcao.criado', alvoTipo: 'balcao', alvoId: b.id, detalhes: { itens: d.itens.length } });
      await auditar(tx, req, { acao: 'link.criado', alvoTipo: 'link', alvoId: link.linkId, detalhes: { balcaoId: b.id } });
      return { id: b.id, link: { url: link.url, expiraEm: link.expiraEm } satisfies LinkGerado };
    });
    res.status(201).json(r);
  }),
);

rotasBalcoes.get(
  '/:id',
  rota(async (req, res) => {
    res.json(await naOrganizacao(req.empresa!.organizacao.id, (tx) => detalhe(tx, req.params.id)));
  }),
);

/** Gera um link novo e revoga o anterior. O token só existe nesta resposta. */
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
      if (n.count) await auditar(tx, req, { acao: 'link.revogado', alvoTipo: 'balcao', alvoId: req.params.id });
    });
    res.status(204).end();
  }),
);

/**
 * Manda o link pelo worker (WhatsApp ou e-mail). O front devolve a URL que
 * recebeu ao criar o link; conferimos que ela é o link ativo deste balcão.
 */
rotasBalcoes.post(
  '/:id/enviar-link',
  rota(async (req, res) => {
    exigirMontar(req);
    const d = validar(EnviarLinkEntrada.extend({ url: z.string().url().max(500) }), req.body);
    const org = req.empresa!.organizacao.id;
    await naOrganizacao(org, async (tx) => {
      const link = await tx.linkAcesso.findFirst({ where: { balcaoId: req.params.id, tokenHash: hashToken(tokenDaUrl(d.url)), revogadoEm: null } });
      if (!link) throw new ErroHttp(400, 'Este link não vale mais. Gere um novo.');
      await auditar(tx, req, { acao: 'link.enviado', alvoTipo: 'balcao', alvoId: req.params.id, detalhes: { canal: d.canal } });
    });
    await enfileirar('enviar-mensagem', {
      organizacaoId: org,
      balcaoId: req.params.id,
      tipo: 'link',
      canal: d.canal,
      selado: await selarConteudo(org, { url: d.url, texto: d.mensagem }),
    });
    res.status(202).json({ ok: true });
  }),
);

/** Lembrete manual: como o link só existe em hash, o lembrete leva um link novo e o anterior deixa de valer. */
rotasBalcoes.post(
  '/:id/lembrar',
  rota(async (req, res) => {
    exigirMontar(req);
    const org = req.empresa!.organizacao.id;
    const link = await naOrganizacao(org, async (tx) => {
      const b = await tx.balcao.findUnique({ where: { id: req.params.id } });
      if (!b || b.concluidoEm) throw naoEncontrado('Balcão não encontrado ou já concluído.');
      const l = await criarLink(tx, org, b.id, b.prazo);
      await tx.balcao.update({ where: { id: b.id }, data: { ultimoLembreteEm: new Date() } });
      await auditar(tx, req, { acao: 'lembrete.enviado', alvoTipo: 'balcao', alvoId: b.id, detalhes: { manual: true } });
      return l;
    });
    await enfileirar('enviar-mensagem', { organizacaoId: org, balcaoId: req.params.id, tipo: 'lembrete', canal: 'whatsapp', selado: await selarConteudo(org, { url: link.url }) });
    res.status(202).json({ ok: true });
  }),
);

rotasBalcoes.post(
  '/:id/concluir',
  rota(async (req, res) => {
    exigirMontar(req);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const itens = await tx.itemBalcao.findMany({ where: { balcaoId: req.params.id } });
      if (!itens.length) throw naoEncontrado('Balcão não encontrado.');
      if (itens.some((i) => i.obrigatorio && i.status !== 'aprovado')) throw new ErroHttp(400, 'Aprove todos os documentos obrigatórios antes de concluir.');
      await tx.balcao.update({ where: { id: req.params.id }, data: { concluidoEm: new Date() } });
      await tx.linkAcesso.updateMany({ where: { balcaoId: req.params.id, revogadoEm: null }, data: { revogadoEm: new Date() } });
      await auditar(tx, req, { acao: 'balcao.concluido', alvoTipo: 'balcao', alvoId: req.params.id });
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
      await tx.balcao.update({ where: { id: b.id }, data: { concluidoEm: null } });
      await auditar(tx, req, { acao: 'balcao.reaberto', alvoTipo: 'balcao', alvoId: b.id });
    });
    res.status(204).end();
  }),
);

/* ---------- Aprovar / recusar itens ---------- */

export const rotasItens = Router();

rotasItens.post(
  '/:id/aprovar',
  rota(async (req, res) => {
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const item = await tx.itemBalcao.findUnique({ where: { id: req.params.id }, include: { documentos: { where: { status: 'disponivel' }, orderBy: { enviadoEm: 'desc' }, take: 1 } } });
      if (!item || item.status !== 'analise' || !item.documentos[0]) throw new ErroHttp(400, 'Este documento não está esperando conferência.');
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
      if (!item || item.status !== 'analise' || !item.documentos[0]) throw new ErroHttp(400, 'Este documento não está esperando conferência.');
      await tx.itemBalcao.update({ where: { id: item.id }, data: { status: 'recusado', motivoRecusa: motivo } });
      await auditar(tx, req, { acao: 'documento.recusou', alvoTipo: 'documento', alvoId: item.documentos[0].id, detalhes: { balcaoId: item.balcaoId, itemId: item.id } });
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
