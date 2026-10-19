import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Tx } from '@trames/db';

/*
 * Envio de WhatsApp e e-mail. Em desenvolvimento (MENSAGENS=dev) as mensagens
 * vão para a tabela caixa_saida_dev. Em produção: WhatsApp Cloud API (Meta) e
 * Amazon SES em sa-east-1.
 *
 * Pelo WhatsApp a Trames só manda template aprovado: código de acesso
 * (categoria autenticação) e lembrete (categoria utilidade, só prazo e
 * documentos pendentes, sem oferta). O link inicial quem manda é o próprio
 * escritório, pelo WhatsApp dele (wa.me).
 */

export interface Template {
  /** Nome do template aprovado na Meta. */
  nome: string;
  /** Variáveis do corpo, na ordem ({{1}}, {{2}}…). */
  corpo: string[];
  /** Templates de autenticação levam o código também no botão de copiar. */
  botaoCodigo?: string;
}

export interface Envio {
  organizacaoId: string;
  balcaoId?: string;
  usuarioId?: string;
  canal: 'whatsapp' | 'email';
  destino: string;
  assunto: string;
  /** Texto do e-mail; no WhatsApp, é o equivalente do template (o que aparece na caixa de dev). */
  texto: string;
  template?: Template;
}

const modo = process.env.MENSAGENS ?? 'dev';
const ses = modo === 'dev' ? null : new SESv2Client({ region: process.env.AWS_REGION ?? 'sa-east-1' });

export const TEMPLATES = {
  codigo: process.env.WHATSAPP_TEMPLATE_CODIGO ?? 'trames_codigo',
  lembrete: process.env.WHATSAPP_TEMPLATE_LEMBRETE ?? 'trames_lembrete',
};

async function whatsapp(destino: string, t: Template) {
  const componentes: unknown[] = [{ type: 'body', parameters: t.corpo.map((text) => ({ type: 'text', text })) }];
  if (t.botaoCodigo) componentes.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: t.botaoCodigo }] });
  const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_NUMERO_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: destino.length <= 11 ? `55${destino}` : destino,
      type: 'template',
      template: { name: t.nome, language: { code: 'pt_BR' }, components: componentes },
    }),
  });
  if (!r.ok) throw new Error(`WhatsApp respondeu ${r.status}`);
}

async function email(destino: string, assunto: string, texto: string) {
  await ses!.send(
    new SendEmailCommand({
      FromEmailAddress: process.env.SES_REMETENTE,
      Destination: { ToAddresses: [destino] },
      Content: { Simple: { Subject: { Data: assunto }, Body: { Text: { Data: texto } } } },
    }),
  );
}

/** tx é usado só pelo modo dev, para gravar na caixa de saída (com RLS do escritório). */
export async function enviar(tx: Tx, e: Envio) {
  if (modo === 'dev') {
    const final = e.canal === 'whatsapp' ? `WhatsApp terminado em ${e.destino.slice(-4)}` : `e-mail ${e.destino.replace(/^(.).*@/, '$1***@')}`;
    const modelo = e.canal === 'whatsapp' && e.template ? `[template ${e.template.nome}]\n` : '';
    await tx.caixaSaidaDev.create({ data: { organizacaoId: e.organizacaoId, balcaoId: e.balcaoId, usuarioId: e.usuarioId, canal: e.canal, destino: final, texto: `${modelo}${e.assunto}\n\n${e.texto}` } });
    return;
  }
  if (e.canal === 'whatsapp') {
    if (!e.template) throw new Error('WhatsApp só sai por template aprovado.');
    await whatsapp(e.destino, e.template);
  } else await email(e.destino, e.assunto, e.texto);
}

/** E-mail para todas as pessoas que administram a conta. */
export async function avisarAdmins(tx: Tx, organizacaoId: string, assunto: string, texto: string) {
  const admins = await tx.usuario.findMany({ where: { permissao: 'admin', senhaHash: { not: null } } });
  for (const a of admins) await enviar(tx, { organizacaoId, usuarioId: a.id, canal: 'email', destino: a.email, assunto, texto });
}
