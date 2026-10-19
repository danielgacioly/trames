import { hashToken, novoToken, selar, type Tx } from '@trames/db';
import type { ConteudoSelado } from '@trames/shared/filas';
import { config } from '../../infra/config';
import { kms } from '../../infra/kms';

const DIAS_DEPOIS_DO_PRAZO = 30;

/**
 * Link do cliente: token aleatório de 256 bits; o banco guarda só o hash, e o
 * token existe apenas na mensagem que o leva. Por isso cada envio (lembrete,
 * aviso, "mandar de novo") emite um link novo, sem revogar os anteriores: todos
 * abrem o mesmo balcão e a sessão de 30 dias do cliente continua.
 * Na URL o token vai no fragmento (#), que o navegador não manda para servidor,
 * CDN ou log de acesso. O app do balcão o envia à API num cabeçalho.
 */
export async function emitirLink(tx: Tx, organizacaoId: string, balcaoId: string, prazo: Date) {
  const { token, hash } = novoToken();
  const fim = Math.max(prazo.getTime(), Date.now()) + DIAS_DEPOIS_DO_PRAZO * 86_400_000;
  const link = await tx.linkAcesso.create({ data: { organizacaoId, balcaoId, tokenHash: hash, expiraEm: new Date(fim) } });
  return { url: `${config.URL_BALCAO}/#${token}`, expiraEm: link.expiraEm.toISOString(), linkId: link.id };
}

/** "Gerar link novo": revoga todos os links do balcão (e com eles as sessões do cliente) e emite um. */
export async function criarLink(tx: Tx, organizacaoId: string, balcaoId: string, prazo: Date) {
  await tx.linkAcesso.updateMany({ where: { balcaoId, revogadoEm: null }, data: { revogadoEm: new Date() } });
  await tx.sessaoCliente.deleteMany({ where: { balcaoId } });
  return emitirLink(tx, organizacaoId, balcaoId, prazo);
}

export const tokenDaUrl = (url: string) => url.split('#')[1] ?? '';

/** Confere que a URL que o front mandou é um link ativo deste balcão (pelo hash). */
export async function linkDaUrl(tx: Tx, balcaoId: string, url: string) {
  return tx.linkAcesso.findFirst({ where: { balcaoId, tokenHash: hashToken(tokenDaUrl(url)), revogadoEm: null, expiraEm: { gt: new Date() } } });
}

export async function selarConteudo(organizacaoId: string, c: ConteudoSelado) {
  return (await selar(kms, JSON.stringify(c), `fila:${organizacaoId}`)).toString('base64');
}
