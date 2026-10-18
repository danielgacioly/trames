export type PlanoId = 'gratis' | 'pro' | 'ultra';
export type AreaId = 'contabilidade' | 'advocacia' | 'saude';
export type Permissao = 'admin' | 'monta' | 'confere';
export type StatusDoc = 'pendente' | 'analise' | 'aprovado' | 'recusado';

export interface Usuario {
  id: string;
  contaId: string;
  nome: string;
  email: string;
  senha: string;
  permissao: Permissao;
}

export interface Conta {
  id: string;
  nome: string;
  sigla: string;
  cor: string;
  area: AreaId;
  plano: PlanoId;
}

export interface Documento {
  id: string;
  nome: string;
  detalhe: string;
  obrigatorio: boolean;
  status: StatusDoc;
  arquivo?: string;
  enviadoEm?: string;
  motivo?: string;
}

export interface Cliente {
  nome: string;
  cpf: string;
  whatsapp: string;
  email: string;
}

export interface Balcao {
  id: string;
  contaId: string;
  codigo: string;
  protocolo: string;
  tipo: string;
  cliente: Cliente;
  prazo: string;
  lembrete: boolean;
  docs: Documento[];
  criadoEm: string;
  concluidoEm?: string;
}

export interface ItemModelo {
  nome: string;
  detalhe: string;
  obrigatorio: boolean;
}

export interface Modelo {
  id: string;
  area: AreaId;
  nome: string;
  quando: string;
  itens: ItemModelo[];
  /** Presente só nos modelos criados por uma conta. */
  contaId?: string;
}

export interface Db {
  versao: number;
  usuarios: Usuario[];
  contas: Conta[];
  balcoes: Balcao[];
  modelos: Modelo[];
  sessao: string | null;
  seq: number;
}
