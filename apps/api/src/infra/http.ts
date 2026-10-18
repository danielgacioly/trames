import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { z } from 'zod';
import type { Organizacao, Usuario } from '@trames/db';
import type { PlanoId } from '@trames/shared';
import { config } from './config';
import { ErroHttp } from './erros';
import { log } from './logger';

export interface ContextoEmpresa {
  sessaoId: string;
  usuario: Usuario;
  organizacao: Organizacao;
  plano: PlanoId;
}

export interface ContextoCliente {
  sessaoId: string;
  organizacaoId: string;
  balcaoId: string;
  linkId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      empresa?: ContextoEmpresa;
      cliente?: ContextoCliente;
    }
  }
}

/** Express 4 não pega erro de função async: este embrulho repassa para o tratador. */
export const rota =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    // Guarda o padrão da rota agora: no fim da resposta o Express já desfez o baseUrl.
    res.locals.rota = `${req.baseUrl}${req.route?.path ?? ''}`;
    fn(req, res).catch(next);
  };

export const validar = <S extends z.ZodTypeAny>(esquema: S, dado: unknown): z.infer<S> => esquema.parse(dado);

/** Log de acesso: método, padrão da rota (nunca a URL real, que pode ter o token do link), status e tempo. */
export function registrarAcesso(req: Request, res: Response, next: NextFunction) {
  req.id = randomUUID();
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    log.info(
      {
        rid: req.id,
        metodo: req.method,
        rota: res.locals.rota ?? 'sem-rota',
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - inicio) / 1_000_000n),
      },
      'requisição',
    );
  });
  next();
}

/**
 * Proteção contra CSRF: os cookies são SameSite=Strict, e toda requisição que
 * muda estado precisa vir de uma origem nossa.
 */
export function verificarOrigem(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origem = req.get('origin');
  if (!origem || ![config.URL_WEB, config.URL_BALCAO].includes(origem)) return next(new ErroHttp(403, 'Origem não permitida.'));
  next();
}

export const ipDe = (req: Request) => req.ip ?? null;

const limite = (janelaMin: number, max: number, chave?: (req: Request) => string) =>
  rateLimit({
    windowMs: janelaMin * 60_000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: chave,
    message: { erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.', codigo: 'limite' },
    // Os testes de integração fazem muitos logins seguidos do mesmo IP.
    skip: () => config.NODE_ENV === 'test',
  });

export const limites = {
  geral: limite(1, 300),
  login: limite(15, 20),
  segundoFator: limite(15, 10),
  reenviarCodigo: limite(15, 5),
  /** Pedir código: por link e por IP. */
  pedirCodigo: limite(15, 5, (req) => `${req.get('x-link') ?? ''}:${req.ip}`),
  entrarCliente: limite(15, 15),
  upload: limite(10, 60),
  turu: limite(1, 15),
};
