import type { Request } from 'express';
import { PLANOS, RECURSO_INFO, type Recurso } from '@trames/shared';
import { ErroHttp, proibido } from '../../infra/erros';

/** Recurso do plano: a mesma regra que o front mostra com cadeado, aqui é a que vale. */
export function exigirRecurso(req: Request, recurso: Recurso) {
  if (!PLANOS[req.empresa!.plano].recursos[recurso]) throw new ErroHttp(402, RECURSO_INFO[recurso].texto, 'plano');
}

const temPermissoesPorPessoa = (req: Request) => PLANOS[req.empresa!.plano].recursos.permissoes;

/** Administra a conta (plano, equipe, marca, dados de titular). */
export function exigirAdmin(req: Request) {
  if (req.empresa!.usuario.permissao !== 'admin') throw proibido('Só quem administra a conta pode fazer isso.');
}

/**
 * Monta balcões e modelos. "Só confere" bloqueia, mas só no Ultra, que é o
 * plano com permissões por pessoa; nos outros planos todos têm acesso completo.
 */
export function exigirMontar(req: Request) {
  if (temPermissoesPorPessoa(req) && req.empresa!.usuario.permissao === 'confere') throw proibido('Sua permissão nesta conta é só de conferir documentos.');
}

export const plano = (req: Request) => PLANOS[req.empresa!.plano];
