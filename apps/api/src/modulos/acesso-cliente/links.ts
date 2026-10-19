import { abrir, novoToken, selar, type Tx } from '@trames/db';
import type { ConteudoSelado } from '@trames/shared/filas';
import { config } from '../../infra/config';
import { kms } from '../../infra/kms';

const DIAS_DEPOIS_DO_PRAZO = 30;

/**
 * Link do cliente: token aleatório de 256 bits. Para buscar, o banco usa só o hash.
 * O token também fica selado com o KMS (AAD = escritório) para que lembretes e
 * avisos levem o mesmo link, sem derrubar a sessão de 30 dias do cliente.
 * Na URL ele vai no fragmento (#), que o navegador não manda para servidor,
 * CDN ou log de acesso. O app do balcão o envia à API num cabeçalho.
 */
export async function criarLink(tx: Tx, organizacaoId: string, balcaoId: string, prazo: Date) {
  await tx.linkAcesso.updateMany({ where: { balcaoId, revogadoEm: null }, data: { revogadoEm: new Date() } });
  const { token, hash } = novoToken();
  const fim = Math.max(prazo.getTime(), Date.now()) + DIAS_DEPOIS_DO_PRAZO * 86_400_000;
  const tokenSelado = await selar(kms, token, `link:${organizacaoId}`);
  const link = await tx.linkAcesso.create({ data: { organizacaoId, balcaoId, tokenHash: hash, tokenSelado, expiraEm: new Date(fim) } });
  return { url: urlDoToken(token), expiraEm: link.expiraEm.toISOString(), linkId: link.id };
}

const urlDoToken = (token: string) => `${config.URL_BALCAO}/#${token}`;

/** O link ativo do balcão, aberto do selo. Se não houver (ou for de antes do selo), gera um novo. */
export async function linkAtivo(tx: Tx, organizacaoId: string, balcaoId: string, prazo: Date) {
  const l = await tx.linkAcesso.findFirst({ where: { balcaoId, revogadoEm: null, expiraEm: { gt: new Date() } }, orderBy: { criadoEm: 'desc' } });
  if (l?.tokenSelado) {
    const token = await abrir(kms, Buffer.from(l.tokenSelado), `link:${organizacaoId}`);
    return { url: urlDoToken(token), expiraEm: l.expiraEm.toISOString(), linkId: l.id, novo: false };
  }
  return { ...(await criarLink(tx, organizacaoId, balcaoId, prazo)), novo: true };
}

export const tokenDaUrl = (url: string) => url.split('#')[1] ?? '';

export async function selarConteudo(organizacaoId: string, c: ConteudoSelado) {
  return (await selar(kms, JSON.stringify(c), `fila:${organizacaoId}`)).toString('base64');
}
