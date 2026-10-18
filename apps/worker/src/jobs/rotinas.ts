import { naOrganizacao, novoToken, selar, todasAsOrganizacoes, criarKms } from '@trames/db';
import { apagar, BUCKET_DOCUMENTOS } from '@trames/db/armazenamento';
import { PLANOS } from '@trames/shared';
import { log } from '../log';
import type { Enfileirar } from '../fila';

/*
 * Rotinas agendadas. Passam por todos os escritórios, um de cada vez, sempre
 * dentro da transação com o organizacao_id definido (o RLS vale também aqui).
 */

const kms = criarKms();
const INTERVALO_LEMBRETE_MS = 3 * 86_400_000;

/** Lembra pelo WhatsApp, a cada 3 dias, quem ainda deve documentos. Só nos planos com lembretes. */
export async function lembretes(enfileirar: Enfileirar) {
  let total = 0;
  for (const org of await todasAsOrganizacoes()) {
    const devidos = await naOrganizacao(org, async (tx) => {
      const a = await tx.assinatura.findFirst({ where: { status: 'ativa' }, orderBy: { inicioEm: 'desc' } });
      if (!PLANOS[a?.plano ?? 'gratis'].recursos.lembretes) return [];
      const balcoes = await tx.balcao.findMany({
        where: {
          concluidoEm: null,
          lembrete: true,
          OR: [{ ultimoLembreteEm: null }, { ultimoLembreteEm: { lt: new Date(Date.now() - INTERVALO_LEMBRETE_MS) } }],
          itens: { some: { status: { in: ['pendente', 'recusado'] }, obrigatorio: true } },
        },
      });
      const envios = [];
      for (const b of balcoes) {
        // O link só existe em hash: o lembrete leva um link novo e o anterior é revogado.
        await tx.linkAcesso.updateMany({ where: { balcaoId: b.id, revogadoEm: null }, data: { revogadoEm: new Date() } });
        const { token, hash } = novoToken();
        const fim = Math.max(b.prazo.getTime(), Date.now()) + 30 * 86_400_000;
        await tx.linkAcesso.create({ data: { organizacaoId: org, balcaoId: b.id, tokenHash: hash, expiraEm: new Date(fim) } });
        await tx.balcao.update({ where: { id: b.id }, data: { ultimoLembreteEm: new Date() } });
        await tx.eventoAuditoria.create({ data: { organizacaoId: org, atorTipo: 'sistema', acao: 'lembrete.enviado', alvoTipo: 'balcao', alvoId: b.id } });
        envios.push({ balcaoId: b.id, url: `${process.env.URL_BALCAO}/#${token}` });
      }
      return envios;
    });
    for (const e of devidos) {
      const selado = (await selar(kms, JSON.stringify({ url: e.url }), `fila:${org}`)).toString('base64');
      await enfileirar('enviar-mensagem', { organizacaoId: org, balcaoId: e.balcaoId, tipo: 'lembrete', canal: 'whatsapp', selado });
    }
    total += devidos.length;
  }
  log.info({ total }, 'lembretes enfileirados');
}

/** Revoga links vencidos e limpa códigos e sessões que já não valem. */
export async function expirar() {
  const agora = new Date();
  for (const org of await todasAsOrganizacoes()) {
    await naOrganizacao(org, async (tx) => {
      await tx.linkAcesso.updateMany({ where: { revogadoEm: null, expiraEm: { lt: agora } }, data: { revogadoEm: agora } });
      await tx.codigoAcesso.deleteMany({ where: { expiraEm: { lt: new Date(agora.getTime() - 86_400_000) } } });
      await tx.sessaoCliente.deleteMany({ where: { expiraEm: { lt: agora } } });
      await tx.sessao.deleteMany({ where: { expiraEm: { lt: agora } } });
      await tx.caixaSaidaDev.deleteMany({ where: { criadaEm: { lt: new Date(agora.getTime() - 86_400_000) } } });
    });
  }
}

/**
 * Retenção: balcão concluído há mais de N dias (configurável por escritório)
 * tem os arquivos apagados do storage. Os metadados ficam, marcados como apagados.
 */
export async function retencao() {
  let arquivos = 0;
  for (const org of await todasAsOrganizacoes()) {
    const docs = await naOrganizacao(org, async (tx) => {
      const o = await tx.organizacao.findUniqueOrThrow({ where: { id: org } });
      const limite = new Date(Date.now() - o.diasRetencao * 86_400_000);
      const balcoes = await tx.balcao.findMany({ where: { concluidoEm: { lt: limite }, arquivosApagadosEm: null }, select: { id: true } });
      if (!balcoes.length) return [];
      return tx.documento.findMany({ where: { balcaoId: { in: balcoes.map((b) => b.id) }, status: { not: 'apagado' } } }).then((d) => ({ balcoes, d }));
    });
    if (!('d' in docs)) continue;
    for (const d of docs.d) {
      await apagar(BUCKET_DOCUMENTOS, d.chave);
      if (d.chaveMiniatura) await apagar(BUCKET_DOCUMENTOS, d.chaveMiniatura);
    }
    await naOrganizacao(org, async (tx) => {
      await tx.documento.updateMany({ where: { id: { in: docs.d.map((d) => d.id) } }, data: { status: 'apagado', apagadoEm: new Date() } });
      for (const b of docs.balcoes) {
        await tx.balcao.update({ where: { id: b.id }, data: { arquivosApagadosEm: new Date() } });
        await tx.eventoAuditoria.create({ data: { organizacaoId: org, atorTipo: 'sistema', acao: 'retencao.apagou', alvoTipo: 'balcao', alvoId: b.id } });
      }
    });
    arquivos += docs.d.length;
  }
  log.info({ arquivos }, 'retenção aplicada');
}
