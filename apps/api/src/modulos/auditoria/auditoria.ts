import type { Prisma, Tx } from '@trames/db';
import type { Request } from 'express';
import { ipDe } from '../../infra/http';

/*
 * Log append-only: o banco não deixa alterar nem apagar (trigger + permissões).
 * Registra quem viu, baixou, aprovou, recusou ou apagou cada documento, quando e de qual IP.
 * Detalhes nunca levam dado pessoal: só ids e contagens.
 */

export type Acao =
  | 'login.senha'
  | 'login.segundo_fator'
  | 'login.falhou'
  | 'login.codigo_errado'
  | 'conta.criada'
  | 'balcao.criado'
  | 'balcao.concluido'
  | 'balcao.reaberto'
  | 'link.criado'
  | 'link.revogado'
  | 'link.enviado'
  | 'link.copiado'
  | 'link.aberto_whatsapp'
  | 'link.visto'
  | 'cliente.acesso_encerrado'
  | 'balcao.alterado'
  | 'item.adicionado'
  | 'item.editado'
  | 'item.pedido_de_novo'
  | 'item.removido'
  | 'itens.reordenados'
  | 'exportacao.pedida'
  | 'exportacao.baixou'
  | 'cobranca.excedente'
  | 'lembrete.enviado'
  | 'documento.enviado'
  | 'documento.verificado'
  | 'documento.rejeitado'
  | 'documento.viu'
  | 'documento.baixou'
  | 'documento.aprovou'
  | 'documento.recusou'
  | 'documento.apagou'
  | 'cliente.entrou'
  | 'cliente.codigo_errado'
  | 'titular.exportou'
  | 'titular.excluiu'
  | 'equipe.convidou'
  | 'equipe.permissao'
  | 'equipe.removeu'
  | 'organizacao.alterada'
  | 'plano.alterado'
  | 'retencao.apagou';

interface Evento {
  acao: Acao;
  alvoTipo: 'balcao' | 'documento' | 'item' | 'cliente' | 'usuario' | 'organizacao' | 'link';
  alvoId?: string | null;
  detalhes?: Prisma.InputJsonObject;
}

export function auditar(tx: Tx, req: Request, e: Evento) {
  const ator = req.empresa
    ? { atorTipo: 'usuario' as const, atorId: req.empresa.usuario.id, organizacaoId: req.empresa.organizacao.id }
    : { atorTipo: 'cliente' as const, atorId: null, organizacaoId: req.cliente!.organizacaoId };
  return tx.eventoAuditoria.create({ data: { ...ator, acao: e.acao, alvoTipo: e.alvoTipo, alvoId: e.alvoId ?? null, detalhes: e.detalhes, ip: ipDe(req) } });
}

/** Para eventos antes de existir req.empresa (login) ou do sistema. */
export function auditarComo(tx: Tx, organizacaoId: string, atorTipo: 'usuario' | 'cliente' | 'sistema', atorId: string | null, ip: string | null, e: Evento) {
  return tx.eventoAuditoria.create({ data: { organizacaoId, atorTipo, atorId, acao: e.acao, alvoTipo: e.alvoTipo, alvoId: e.alvoId ?? null, detalhes: e.detalhes, ip } });
}
