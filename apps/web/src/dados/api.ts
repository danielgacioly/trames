import type { ErroApi } from '@trames/shared';

/** Erro vindo da API, com o status HTTP e o código (ex.: "plano", "verificar_2fa"). */
export class ErroDaApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
    public codigo?: string,
  ) {
    super(mensagem);
  }
}

/** Chama a API (mesma origem, /api). O cookie de sessão é httpOnly: o front nunca vê o token. */
export async function api<T = void>(metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    method: metodo,
    credentials: 'same-origin',
    headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (r.status === 204 || r.status === 202) return (r.headers.get('content-type')?.includes('json') ? r.json() : undefined) as Promise<T>;
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = dados as ErroApi;
    throw new ErroDaApi(r.status, e.erro ?? 'Algo deu errado.', e.codigo);
  }
  return dados as T;
}

export const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado.');
