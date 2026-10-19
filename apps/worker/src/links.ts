import { novoToken, type Tx } from '@trames/db';

const DIAS_DEPOIS_DO_PRAZO = 30;

/**
 * Emite um link novo para a mensagem (lembrete ou aviso). O banco guarda só o
 * hash; o token existe apenas na mensagem. Os links anteriores continuam
 * valendo e a sessão de 30 dias do cliente não cai.
 */
export async function emitirLink(tx: Tx, organizacaoId: string, balcaoId: string, prazo: Date) {
  const { token, hash } = novoToken();
  const fim = Math.max(prazo.getTime(), Date.now()) + DIAS_DEPOIS_DO_PRAZO * 86_400_000;
  await tx.linkAcesso.create({ data: { organizacaoId, balcaoId, tokenHash: hash, expiraEm: new Date(fim) } });
  return `${process.env.URL_BALCAO}/#${token}`;
}
