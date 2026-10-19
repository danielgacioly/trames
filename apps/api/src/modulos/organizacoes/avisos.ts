import { enfileirar } from '../../infra/fila';
import { selarConteudo } from '../acesso-cliente/links';

/** E-mail para quem administra a conta (uso do mês, cota de WhatsApp, retenção). */
export async function avisarAdmins(organizacaoId: string, assunto: string, texto: string) {
  await enfileirar('enviar-mensagem', { organizacaoId, tipo: 'admin', canal: 'email', selado: await selarConteudo(organizacaoId, { assunto, texto }) });
}

/**
 * Aviso ao cliente de que a lista mudou. A fila "avisar-mudanca" é stately:
 * enquanto um aviso do balcão espera os 10 minutos, os pedidos seguintes são
 * ignorados e entram todos no mesmo e-mail.
 */
export async function agendarAvisoMudanca(organizacaoId: string, balcaoId: string) {
  await enfileirar('avisar-mudanca', { organizacaoId, balcaoId }, { singletonKey: `mudanca:${balcaoId}`, startAfter: 600 });
}
