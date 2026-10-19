import type { ErroApi } from '@trames/shared';

export class ErroDaApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
    public codigo?: string,
  ) {
    super(mensagem);
  }
}

const CHAVE_LINK = 'trames:link';

/** Token do link desta aba. Vai em todo pedido: a sessão do cliente vale só para o balcão deste link. */
let tokenAtual: string | null = null;

/**
 * O token do link chega no fragmento (#) da URL, que não vai para servidor nem
 * para log. Guardamos na aba (sessionStorage) e tiramos da barra de endereço.
 */
export function tokenDoLink(): { token: string | null; novo: boolean } {
  const doHash = window.location.hash.slice(1);
  if (doHash.length >= 30) {
    try {
      sessionStorage.setItem(CHAVE_LINK, doHash);
    } catch {
      /* sem sessionStorage: segue só com a memória */
    }
    history.replaceState(null, '', window.location.pathname);
    tokenAtual = doHash;
    return { token: doHash, novo: true };
  }
  try {
    tokenAtual = sessionStorage.getItem(CHAVE_LINK);
  } catch {
    tokenAtual = null;
  }
  return { token: tokenAtual, novo: false };
}

export async function api<T = void>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  if (tokenAtual) headers['x-link'] = tokenAtual;
  const r = await fetch(`/api${caminho}`, { method: metodo, credentials: 'same-origin', headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const dados = r.status === 204 ? undefined : await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = (dados ?? {}) as ErroApi;
    throw new ErroDaApi(r.status, e.erro ?? 'Algo deu errado.', e.codigo);
  }
  return dados as T;
}
