import { criarKms, naOrganizacao, selar, todasAsOrganizacoes } from '@trames/db';
import { apagar, BUCKET_DOCUMENTOS, BUCKET_QUARENTENA } from '@trames/db/armazenamento';
import { log } from '../log';
import type { Enfileirar } from '../fila';
import { emitirLink } from '../links';
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

/** Etapas da cadência: 3 dias antes do prazo e no dia. Depois do prazo, não sai lembrete automático. */
const ETAPAS = ['antes', 'dia'] as const;
function etapaDoDia(prazo: Date, hoje: Date) {
  const dias = Math.round((prazo.getTime() - hoje.getTime()) / DIA_MS);
  // Um dia de folga, se o worker ficou parado no dia do prazo.
  if (dias < -1) return null;
  if (dias <= 0) return 'dia';
  if (dias <= 3) return 'antes';
  return null;
}

/**
 * Lembretes automáticos em todos os planos, pelo canal do balcão (e-mail, ou
 * WhatsApp no Pro e no Ultra, dentro da cota). Cada etapa sai uma vez; se o
 * worker ficou parado, sai só a etapa mais recente. Cada lembrete leva um link
 * novo; os anteriores continuam valendo.
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
        const url = await emitirLink(tx, org, b.id, b.prazo);
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
      // Cada mensagem emite um link: os vencidos há mais de 90 dias saem (com códigos e sessões, em cascata).
      await tx.linkAcesso.deleteMany({ where: { expiraEm: { lt: new Date(agora.getTime() - 90 * DIA_MS) } } });
      return tx.exportacao.findMany({ where: { expiraEm: { lt: agora }, chave: { not: null } } });
    });
    for (const z of zips) await apagar(BUCKET_DOCUMENTOS, z.chave!);
    if (zips.length) await naOrganizacao(org, (tx) => tx.exportacao.updateMany({ where: { id: { in: zips.map((z) => z.id) } }, data: { chave: null } }));
  }
}

/** Balcão aberto esquecido é arquivado sozinho 30 dias depois do prazo (quando o link também vence). */
const DIAS_PARA_ARQUIVAR = 30;

/**
 * Arquivamento automático. Sem isso, um balcão nunca concluído não entraria na
 * retenção e os arquivos ficariam guardados para sempre. 7 dias antes, quem
 * administra recebe um e-mail (dá para mudar o prazo ou concluir). Arquivado,
 * ele para de contar como ativo, o acesso do cliente cai e a retenção começa.
 */
export async function arquivar() {
  const hoje = hojeEmBrasilia();
  const limite = new Date(hoje.getTime() - DIAS_PARA_ARQUIVAR * DIA_MS);
  let total = 0;
  for (const org of await todasAsOrganizacoes()) {
    await naOrganizacao(org, async (tx) => {
      const avisar = await tx.balcao.findMany({
        where: { concluidoEm: null, avisoArquivoEm: null, prazo: { lt: new Date(limite.getTime() + 7 * DIA_MS) } },
        include: { cliente: { select: { nome: true } } },
        orderBy: { prazo: 'asc' },
      });
      if (avisar.length) {
        const linhas = avisar.map((b) => `- ${b.protocolo} (${b.cliente.nome.split(' ')[0]}): prazo era ${b.prazo.toISOString().slice(0, 10)}`);
        await avisarAdmins(
          tx,
          org,
          `${avisar.length} ${avisar.length === 1 ? 'balcão será arquivado' : 'balcões serão arquivados'} em 7 dias`,
          `Estes balcões estão abertos e com o prazo vencido há semanas:\n${linhas.join('\n')}\n\nEm 7 dias eles serão arquivados: o link do cliente para de valer. Os arquivos continuam guardados; eles só são apagados depois que o balcão é concluído. Para evitar, mude o prazo ou conclua o balcão.`,
        );
        await tx.balcao.updateMany({ where: { id: { in: avisar.map((b) => b.id) } }, data: { avisoArquivoEm: new Date() } });
      }

      // Só arquiva quem já recebeu o aviso há 7 dias: nenhum balcão é arquivado sem aviso.
      const vencidos = await tx.balcao.findMany({ where: { concluidoEm: null, prazo: { lt: limite }, avisoArquivoEm: { lte: new Date(Date.now() - 7 * DIA_MS) } }, select: { id: true } });
      if (!vencidos.length) return;
      const agora = new Date();
      const ids = vencidos.map((b) => b.id);
      await tx.balcao.updateMany({ where: { id: { in: ids } }, data: { concluidoEm: agora, arquivadoEm: agora, apagarArquivosEm: null, avisoRetencaoEm: null } });
      await tx.linkAcesso.updateMany({ where: { balcaoId: { in: ids }, revogadoEm: null }, data: { revogadoEm: agora } });
      await tx.sessaoCliente.deleteMany({ where: { balcaoId: { in: ids } } });
      for (const id of ids) {
        await tx.eventoAuditoria.create({ data: { organizacaoId: org, atorTipo: 'sistema', acao: 'balcao.arquivado', alvoTipo: 'balcao', alvoId: id, detalhes: { automatico: true } } });
      }
      total += ids.length;
    });
  }
  log.info({ total }, 'balcões arquivados');
}

/**
 * Retenção. Ao concluir, o balcão ganha a data de exclusão pela regra do plano.
 * 7 dias antes, quem administra recebe um e-mail (dá para exportar o ZIP antes).
 * No dia, os originais e as miniaturas saem do storage; os registros ficam
 * marcados como apagados e a auditoria guarda só qual documento, de qual balcão
 * e quando, nunca o arquivo.
 */
export async function retencao() {
  await arquivar();
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
