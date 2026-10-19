import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { trocarTermo } from '@trames/shared';
import { log } from './logger';

export class ErroHttp extends Error {
  constructor(
    public status: number,
    mensagem: string,
    public codigo?: string,
  ) {
    super(mensagem);
  }
}

export const naoEncontrado = (o = 'Não encontrado.') => new ErroHttp(404, o);
export const proibido = (o = 'Você não tem permissão para isso.') => new ErroHttp(403, o, 'proibido');

export const tratarErros: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ erro: err.issues[0]?.message ?? 'Dados inválidos.', codigo: 'invalido' });
    return;
  }
  if (err instanceof ErroHttp) {
    // A mensagem usa o nome que o escritório dá aos balcões (processo, projeto...).
    const o = req.empresa?.organizacao;
    const erro = o ? trocarTermo(err.message, { singular: o.termoSingular, plural: o.termoPlural, feminino: o.termoFeminino }) : err.message;
    res.status(err.status).json({ erro, codigo: err.codigo });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ erro: 'Requisição grande demais.' });
    return;
  }
  // Mensagens de erro do banco podem conter valores das colunas: só o nome e o código vão para o log.
  log.error({ erro: err?.name, codigo: err?.code, rid: req.id }, 'erro não tratado');
  res.status(500).json({ erro: 'Algo deu errado. Tente de novo em instantes.' });
};
