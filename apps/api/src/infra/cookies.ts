import type { CookieOptions, Response } from 'express';
import { emDesenvolvimento } from './config';

export const COOKIE_EMPRESA = 'trames_sessao';
export const COOKIE_CLIENTE = 'trames_cliente';

const base: CookieOptions = { httpOnly: true, sameSite: 'strict', secure: !emDesenvolvimento, path: '/' };

export function definirCookie(res: Response, nome: string, valor: string, validadeMs: number) {
  res.cookie(nome, valor, { ...base, maxAge: validadeMs });
}

export function limparCookie(res: Response, nome: string) {
  res.clearCookie(nome, base);
}
