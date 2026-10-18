import { z } from 'zod';

export const PlanoId = z.enum(['gratis', 'pro', 'ultra']);
export type PlanoId = z.infer<typeof PlanoId>;

export const AreaId = z.enum(['contabilidade', 'advocacia', 'saude']);
export type AreaId = z.infer<typeof AreaId>;

export const Permissao = z.enum(['admin', 'monta', 'confere']);
export type Permissao = z.infer<typeof Permissao>;

export const StatusItem = z.enum(['pendente', 'analise', 'aprovado', 'recusado']);
export type StatusItem = z.infer<typeof StatusItem>;

/** Situação do arquivo enviado: só sai da quarentena depois do antivírus e da checagem do tipo real. */
export const StatusDocumento = z.enum(['quarentena', 'disponivel', 'rejeitado', 'apagado']);
export type StatusDocumento = z.infer<typeof StatusDocumento>;

/** Etapa do login da empresa. */
export const EtapaSessao = z.enum(['configurar_2fa', 'verificar_2fa', 'completa']);
export type EtapaSessao = z.infer<typeof EtapaSessao>;

export const CanalCodigo = z.enum(['whatsapp', 'email']);
export type CanalCodigo = z.infer<typeof CanalCodigo>;
