import { criarKms, naOrganizacao, selar, todasAsOrganizacoes } from '@trames/db';
import { apagar, BUCKET_DOCUMENTOS, BUCKET_QUARENTENA } from '@trames/db/armazenamento';
import { log } from '../log';
import type { Enfileirar } from '../fila';
import { urlDoLinkAtivo } from '../links';
import { avisarAdmins } from '../mensagens';

/*
 * Rotinas agendadas. Passam por todos os escritórios, um de cada vez, sempre
 * dentro da transação com o organizacao_id definido (o RLS vale também aqui).
 */

const kms = criarKms();
const DIA_MS = 86_400_000;

/** Hoje em Brasília, como data (meia-noite UTC), para comparar com o prazo (coluna date). */
function hojeEmBrasilia() {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return new Date(`${iso}T00:00:00Z`);
}

/** Etapas da cadência: 3 dias antes do prazo, no dia e 2 dias depois. */
const ETAPAS = ['antes', 'dia', 'depois'] as const;
function etapaDoDia(prazo: Date, hoje: Date) {
  const dias = Math.round((prazo.getTime() - hoje.getTime()) / DIA_MS);
  if (dias <= -2) return 'depois';
  if (dias <= 0) return 'dia';
  if (dias <= 3) return 'antes';
  return null;
}

/**
 * Lembretes automáticos em todos os planos, pelo canal do balcão (e-mail, ou
 * WhatsApp no Pro e no Ultra, dentro da cota). Cada etapa sai uma vez; se o
 * worker ficou parado, sai só a etapa mais recente. O lembrete leva o mesmo
 * link: a sessão de 30 dias do cliente continua valendo.
 */
export async function lembretes(enfileirar: Enfileirar) {
  const hoje = hojeEmBrasilia();
  let total = 0;
  for (const org of await todasAsOrganizacoes()) {
    const devidos = await naOrganizacao(org, async (tx) => {
      const balcoes = await tx.balcao.findMany({
        where: { concluidoEm: null, lembrete: true, itens: { some: { removidoEm: null, obrigatorio: true, status: { in: ['pendente', 'recusado'] } } } },
      });
      const envios = [];
      for (const b of balcoes) {
        const etapa = etapaDoDia(b.prazo, hoje);
        if (!etapa || b.lembretesEnviados.includes(etapa)) continue;
        const url = await urlDoLinkAtivo(tx, org, b.id);
        if (!url) continue; // sem link ativo: o escritório precisa gerar um novo
        const ate = ETAPAS.slice(0, ETAPAS.indexOf(etapa) + 1);
        await tx.balcao.update({ where: { id: b.id }, data: { lembretesEnviados: [...new Set([...b.lembretesEnviados, ...ate])], ultimoLembreteEm: new Date() } });
        await tx.eventoAuditoria.create({ data: { organizacaoId: org, atorTipo: 'sistema', acao: 'lembrete.enviado', alvoTipo: 'balcao', alvoId: b.id, detalhes: { etapa, canal: b.canalLembrete } } });
        envios.push({ balcaoId: b.id, url, etapa, canal: b.canalLembrete as 'email' | 'whatsapp' });
      }
      return envios;
    });
    for (const e of devidos) {
      const selado = (await selar(kms, JSON.stringify({ url: e.url, etapa: e.etapa }), `fila:${org}`)).toString('base64');
      await enfileirar('enviar-mensagem', { organizacaoId: org, balcaoId: e.balcaoId, tipo: 'lembrete', canal: e.canal, selado });
    }
    total += devidos.length;
  }
  log.info({ total }, 'lembretes enfileirados');
}

/** Revoga links vencidos, limpa códigos e sessões que já não valem e apaga ZIPs vencidos. */
export async function expirar() {
  const agora = new Date();
  for (const org of await todasAsOrganizacoes()) {
    const zips = await naOrganizacao(org, async (tx) => {
      await tx.linkAcesso.updateMany({ where: { revogadoEm: null, expiraEm: { lt: agora } }, data: { revogadoEm: agora } });
      await tx.codigoAcesso.deleteMany({ where: { expiraEm: { lt: new Date(agora.getTime() - DIA_MS) } } });
      await tx.sessaoCliente.deleteMany({ where: { expiraEm: { lt: agora } } });
      await tx.sessao.deleteMany({ where: { expiraEm: { lt: agora } } });
      await tx.caixaSaidaDev.deleteMany({ where: { criadaEm: { lt: new Date(agora.getTime() - DIA_MS) } } });
      return tx.exportacao.findMany({ where: { expiraEm: { lt: agora }, chave: { not: null } } });
    });
    for (const z of zips) await apagar(BUCKET_DOCUMENTOS, z.chave!);
    if (zips.length) await naOrganizacao(org, (tx) => tx.exportacao.updateMany({ where: { id: { in: zips.map((z) => z.id) } }, data: { chave: null } }));
  }
}

/**
 * Retenção. Ao concluir, o balcão ganha a data de exclusão pela regra do plano.
 * 7 dias antes, quem administra recebe um e-mail (dá para exportar o ZIP antes).
 * No dia, os originais e as miniaturas saem do storage; os registros ficam
 * marcados como apagados e a auditoria guarda só qual documento, de qual balcão
 * e quando, nunca o arquivo.
 */
export async function retencao() {
  const agora = new Date();
  let arquivos = 0;
  for (const org of await todasAsOrganizacoes()) {
    await naOrganizacao(org, async (tx) => {
      const proximos = await tx.balcao.findMany({
        where: { arquivosApagadosEm: null, avisoRetencaoEm: null, apagarArquivosEm: { gt: agora, lte: new Date(agora.getTime() + 7 * DIA_MS) } },
        include: { cliente: { select: { nome: true } } },
        orderBy: { apagarArquivosEm: 'asc' },
      });
      if (!proximos.length) return;
      const linhas = proximos.map((b) => `- ${b.protocolo} (${b.cliente.nome.split(' ')[0]}): ${b.apagarArquivosEm!.toISOString().slice(0, 10)}`);
      await avisarAdmins(
        tx,
        org,
        `Arquivos de ${proximos.length} ${proximos.length === 1 ? 'balcão' : 'balcões'} serão apagados nos próximos 7 dias`,
        `Pela política de retenção da conta, os arquivos destes balcões concluídos serão apagados:\n${linhas.join('\n')}\n\nSe precisar guardar, baixe o ZIP na tela do balcão antes dessa data.`,
      );
      await tx.balcao.updateMany({ where: { id: { in: proximos.map((b) => b.id) } }, data: { avisoRetencaoEm: agora } });
    });

    const vencidos = await naOrganizacao(org, async (tx) => {
      const balcoes = await tx.balcao.findMany({ where: { arquivosApagadosEm: null, apagarArquivosEm: { lte: agora } }, select: { id: true } });
      if (!balcoes.length) return null;
      const ids = balcoes.map((b) => b.id);
      const docs = await tx.documento.findMany({ where: { balcaoId: { in: ids }, status: { not: 'apagado' } }, include: { item: { select: { nome: true } } } });
      const zips = await tx.exportacao.findMany({ where: { balcaoId: { in: ids }, chave: { not: null } } });
      return { ids, docs, zips };
    });
    if (!vencidos) continue;
    for (const d of vencidos.docs) {
      await apagar(d.status === 'quarentena' ? BUCKET_QUARENTENA : BUCKET_DOCUMENTOS, d.chave);
      if (d.chaveMiniatura) await apagar(BUCKET_DOCUMENTOS, d.chaveMiniatura);
    }
    for (const z of vencidos.zips) await apagar(BUCKET_DOCUMENTOS, z.chave!);
    await naOrganizacao(org, async (tx) => {
      await tx.documento.updateMany({ where: { id: { in: vencidos.docs.map((d) => d.id) } }, data: { status: 'apagado', apagadoEm: agora } });
      await tx.exportacao.updateMany({ where: { id: { in: vencidos.zips.map((z) => z.id) } }, data: { chave: null } });
      for (const d of vencidos.docs) {
        await tx.eventoAuditoria.create({
          data: { organizacaoId: org, atorTipo: 'sistema', acao: 'retencao.apagou_documento', alvoTipo: 'documento', alvoId: d.id, detalhes: { balcaoId: d.balcaoId, item: d.item.nome } },
        });
      }
      for (const id of vencidos.ids) {
        await tx.balcao.update({ where: { id }, data: { arquivosApagadosEm: agora } });
        await tx.eventoAuditoria.create({ data: { organizacaoId: org, atorTipo: 'sistema', acao: 'retencao.apagou', alvoTipo: 'balcao', alvoId: id } });
      }
    }, { timeout: 60_000 });
    arquivos += vencidos.docs.length;
  }
  log.info({ arquivos }, 'retenção aplicada');
}
