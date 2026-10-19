import { abrir, criarKms, type Tx } from '@trames/db';

const kms = criarKms();

/**
 * URL do link ativo do balcão, aberta do selo do KMS. Lembretes e avisos levam
 * sempre o mesmo link. Sem link ativo (ou de antes do selo), devolve null: o
 * worker não gera link novo, para não derrubar a sessão do cliente nem o link
 * que o escritório mandou.
 */
export async function urlDoLinkAtivo(tx: Tx, organizacaoId: string, balcaoId: string) {
  const l = await tx.linkAcesso.findFirst({ where: { balcaoId, revogadoEm: null, expiraEm: { gt: new Date() } }, orderBy: { criadoEm: 'desc' } });
  if (!l?.tokenSelado) return null;
  const token = await abrir(kms, Buffer.from(l.tokenSelado), `link:${organizacaoId}`);
  return `${process.env.URL_BALCAO}/#${token}`;
}
