import { novoToken, selar, type Tx } from '@trames/db';
import type { ConteudoSelado } from '@trames/shared/filas';
import { config } from '../../infra/config';
import { kms } from '../../infra/kms';

const DIAS_DEPOIS_DO_PRAZO = 30;

/**
 * Link do cliente: token aleatório de 256 bits; o banco guarda só o hash.
 * O token vai no fragmento (#) da URL, que o navegador não manda para servidor,
 * CDN ou log de acesso. O app do balcão o envia à API num cabeçalho.
 */
export async function criarLink(tx: Tx, organizacaoId: string, balcaoId: string, prazo: Date) {
  await tx.linkAcesso.updateMany({ where: { balcaoId, revogadoEm: null }, data: { revogadoEm: new Date() } });
  const { token, hash } = novoToken();
  const fim = Math.max(prazo.getTime(), Date.now()) + DIAS_DEPOIS_DO_PRAZO * 86_400_000;
  const link = await tx.linkAcesso.create({ data: { organizacaoId, balcaoId, tokenHash: hash, expiraEm: new Date(fim) } });
  return { url: `${config.URL_BALCAO}/#${token}`, expiraEm: link.expiraEm.toISOString(), linkId: link.id };
}

export const tokenDaUrl = (url: string) => url.split('#')[1] ?? '';

export async function selarConteudo(organizacaoId: string, c: ConteudoSelado) {
  return (await selar(kms, JSON.stringify(c), `fila:${organizacaoId}`)).toString('base64');
}
