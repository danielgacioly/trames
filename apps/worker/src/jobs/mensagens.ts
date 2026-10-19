import { abrir, criarKms, decifrarDadosCliente, marcarAviso, naOrganizacao, planoDe, Prisma, reservarWhatsapp, type Tx } from '@trames/db';
import { mesDe } from '@trames/shared';
import { PLANOS, VALIDADE_CODIGO_MINUTOS, type PayloadFila } from '@trames/shared';
import type { ConteudoSelado } from '@trames/shared/filas';
import { log } from '../log';
import { avisarAdmins, enviar, TEMPLATES, type Template } from '../mensagens';

const kms = criarKms();
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataLonga = (d: Date) => `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;

/**
 * Decide o canal de uma mensagem ao cliente. WhatsApp só no Pro e no Ultra e
 * dentro da cota do mês; acabou a cota, cai para e-mail até o mês virar e quem
 * administra recebe um aviso (uma vez por mês). A reserva da cota fica na mesma
 * transação do envio: se o envio falhar, a mensagem não conta.
 */
async function canalDoCliente(tx: Tx, organizacaoId: string, pedido: 'whatsapp' | 'email') {
  if (pedido !== 'whatsapp') return 'email' as const;
  const plano = await planoDe(tx, organizacaoId);
  if (!PLANOS[plano].recursos.whatsapp) return 'email' as const;
  if (await reservarWhatsapp(tx, organizacaoId, plano)) return 'whatsapp' as const;
  if (await marcarAviso(tx, organizacaoId, 'aviso_cota_whatsapp_em')) {
    await avisarAdmins(
      tx,
      organizacaoId,
      'A cota de WhatsApp do mês acabou',
      `A conta usou as ${PLANOS[plano].cotaWhatsapp} mensagens de WhatsApp do plano ${PLANOS[plano].nome} neste mês. Até o mês virar, códigos e lembretes vão por e-mail.`,
    );
  }
  return 'email' as const;
}

/** Monta e envia a mensagem. O telefone só é decifrado aqui, na hora de mandar. */
export async function enviarMensagem(p: PayloadFila['enviar-mensagem']) {
  const conteudo = JSON.parse(await abrir(kms, Buffer.from(p.selado, 'base64'), `fila:${p.organizacaoId}`)) as ConteudoSelado;

  await naOrganizacao(p.organizacaoId, async (tx) => {
    const org = await tx.organizacao.findUniqueOrThrow({ where: { id: p.organizacaoId } });

    if (p.tipo === 'admin') return avisarAdmins(tx, org.id, conteudo.assunto ?? 'Aviso da Trames', conteudo.texto ?? '');

    if (p.tipo === 'login') {
      const u = await tx.usuario.findUnique({ where: { id: p.usuarioId! } });
      if (!u) return;
      return enviar(tx, {
        organizacaoId: org.id,
        usuarioId: u.id,
        canal: 'email',
        destino: u.email,
        assunto: 'Seu código para entrar na Trames',
        texto: `Seu código para entrar na Trames é ${conteudo.codigo}. Ele vale por ${VALIDADE_CODIGO_MINUTOS} minutos. Se não foi você que tentou entrar, troque a sua senha.`,
      });
    }

    if (p.tipo === 'redefinir_senha') {
      const u = await tx.usuario.findUnique({ where: { id: p.usuarioId! } });
      if (!u) return;
      return enviar(tx, {
        organizacaoId: org.id,
        usuarioId: u.id,
        canal: 'email',
        destino: u.email,
        assunto: 'Crie uma senha nova na Trames',
        texto: `Olá, ${u.nome.split(' ')[0]}. Recebemos um pedido para trocar a senha da sua conta na Trames. Para criar uma senha nova, abra este link (vale 1 hora): ${conteudo.url}\n\nSe não foi você, ignore este e-mail: a sua senha continua a mesma.`,
      });
    }

    if (p.tipo === 'senha_trocada') {
      const u = await tx.usuario.findUnique({ where: { id: p.usuarioId! } });
      if (!u) return;
      return enviar(tx, {
        organizacaoId: org.id,
        usuarioId: u.id,
        canal: 'email',
        destino: u.email,
        assunto: 'A sua senha da Trames foi trocada',
        texto: `Olá, ${u.nome.split(' ')[0]}. A senha da sua conta na Trames acabou de ser trocada e os outros aparelhos foram desconectados. Se não foi você, use "Esqueci a senha" na tela de entrar e avise quem administra a conta ${org.nome}.`,
      });
    }

    if (p.tipo === 'convite') {
      const u = await tx.usuario.findUnique({ where: { id: p.usuarioId! } });
      if (!u) return;
      return enviar(tx, {
        organizacaoId: org.id,
        canal: 'email',
        destino: u.email,
        assunto: `Convite para a conta ${org.nome} na Trames`,
        texto: `Olá, ${u.nome.split(' ')[0]}. Você foi convidado para a conta ${org.nome} na Trames. Para entrar, crie sua senha por este link (vale 7 dias): ${conteudo.url}`,
      });
    }

    const b = await tx.balcao.findUnique({ where: { id: p.balcaoId! }, include: { cliente: true, itens: { where: { removidoEm: null }, select: { status: true, obrigatorio: true } } } });
    if (!b) return;
    const canal = await canalDoCliente(tx, org.id, p.canal);
    const nome = b.cliente.nome.split(' ')[0];
    const faltam = b.itens.filter((i) => i.status === 'pendente' || i.status === 'recusado').length;
    const prazo = dataLonga(b.prazo);
    const docs = `${faltam} ${faltam === 1 ? 'documento' : 'documentos'}`;

    const quando = { antes: `O prazo é ${prazo}.`, dia: `O prazo é hoje, ${prazo}.`, depois: `O prazo era ${prazo}.`, manual: `O prazo é ${prazo}.` }[conteudo.etapa ?? 'manual'] ?? '';
    const lembrete: Template = { nome: TEMPLATES.lembrete, corpo: [nome, org.nome, docs, prazo, conteudo.url ?? ''] };

    const mensagens = {
      codigo: {
        assunto: 'Seu código de acesso',
        texto: `${org.nome}: seu código para abrir o balcão de documentos é ${conteudo.codigo}. Vale por ${VALIDADE_CODIGO_MINUTOS} minutos. Não passe este código para ninguém.`,
        template: { nome: TEMPLATES.codigo, corpo: [conteudo.codigo ?? ''], botaoCodigo: conteudo.codigo } satisfies Template,
      },
      link: {
        assunto: `Documentos para ${org.nome}`,
        texto: conteudo.texto?.includes(conteudo.url ?? '') ? conteudo.texto : `${conteudo.texto || `Olá, ${nome}. ${org.nome} abriu um balcão para reunir os seus documentos.`} ${conteudo.url}`,
        template: undefined,
      },
      lembrete: {
        assunto: `Faltam documentos para ${org.nome}`,
        texto: `Olá, ${nome}. ${org.nome} ainda está esperando ${docs}. ${quando} Envie pelo celular, neste link: ${conteudo.url}`,
        template: lembrete,
      },
      mudanca: {
        assunto: `${org.nome} mudou a lista de documentos`,
        texto: `Olá, ${nome}. ${org.nome} mudou a lista de documentos que precisa de você: ${(conteudo.itens ?? []).join('; ')}. Agora faltam ${docs}. Envie pelo mesmo link: ${conteudo.url}`,
        template: lembrete,
      },
    };
    const m = mensagens[p.tipo as keyof typeof mensagens];
    if (!m) return;
    const porEmail = () => {
      if (!b.cliente.email) return log.warn({ balcaoId: b.id, tipo: p.tipo }, 'cliente sem e-mail; mensagem não enviada');
      return enviar(tx, { organizacaoId: org.id, balcaoId: b.id, canal: 'email', destino: b.cliente.email, assunto: m.assunto, texto: m.texto });
    };
    if (canal === 'email' || !m.template) return porEmail();
    try {
      const { telefone } = await decifrarDadosCliente(kms, b.cliente);
      await enviar(tx, { organizacaoId: org.id, balcaoId: b.id, canal, destino: telefone, assunto: m.assunto, texto: m.texto, template: m.template });
    } catch (e) {
      // WhatsApp fora do ar ou recusou: a mensagem sai por e-mail e não conta na cota.
      log.warn({ balcaoId: b.id, tipo: p.tipo, erro: (e as Error).message }, 'WhatsApp falhou; vai por e-mail');
      await tx.$executeRaw(Prisma.sql`UPDATE uso_mensal SET whatsapp_enviados = GREATEST(whatsapp_enviados - 1, 0) WHERE organizacao_id = ${org.id}::uuid AND mes = ${mesDe()}`);
      await porEmail();
    }
  });
}
