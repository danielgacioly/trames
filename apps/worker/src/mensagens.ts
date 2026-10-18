import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Tx } from '@trames/db';

/*
 * Envio de WhatsApp e e-mail. Em desenvolvimento (MENSAGENS=dev) as mensagens
 * vão para a tabela caixa_saida_dev. Em produção: WhatsApp Cloud API (Meta) e
 * Amazon SES em sa-east-1.
 */

export interface Envio {
  organizacaoId: string;
  balcaoId?: string;
  usuarioId?: string;
  canal: 'whatsapp' | 'email';
  destino: string;
  assunto: string;
  texto: string;
}

const modo = process.env.MENSAGENS ?? 'dev';
const ses = modo === 'dev' ? null : new SESv2Client({ region: process.env.AWS_REGION ?? 'sa-east-1' });

async function whatsapp(destino: string, texto: string) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_NUMERO_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: `55${destino}`, type: 'text', text: { body: texto, preview_url: false } }),
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
    await tx.caixaSaidaDev.create({ data: { organizacaoId: e.organizacaoId, balcaoId: e.balcaoId, usuarioId: e.usuarioId, canal: e.canal, destino: final, texto: `${e.assunto}\n\n${e.texto}` } });
    return;
  }
  if (e.canal === 'whatsapp') await whatsapp(e.destino, e.texto);
  else await email(e.destino, e.assunto, e.texto);
}
