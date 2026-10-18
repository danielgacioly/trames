import { z } from 'zod';
import { TAMANHO_MAXIMO_ARQUIVO, TIPOS_PERMITIDOS } from './arquivos';
import { AreaId, CanalCodigo, EtapaSessao, Permissao, PlanoId, StatusDocumento, StatusItem } from './tipos';

/*
 * Entradas da API. A API valida tudo o que chega com estes esquemas;
 * o front usa os mesmos para avisar o usuário antes de enviar.
 */

const texto = (max: number) => z.string().trim().max(max);
const soDigitos = (s: string) => s.replace(/\D/g, '');

export const Email = z.string().trim().toLowerCase().email().max(254);
export const Senha = z.string().min(10, 'A senha precisa de pelo menos 10 caracteres.').max(200);
export const CodigoSeisDigitos = z.string().regex(/^\d{6}$/, 'Digite os 6 números.');
export const DataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const Uuid = z.string().uuid();

export const Cpf = z
  .string()
  .transform(soDigitos)
  .refine((s) => s.length === 0 || s.length === 11, 'CPF precisa ter 11 números.');

export const Telefone = z
  .string()
  .transform(soDigitos)
  .refine((s) => s.length >= 10 && s.length <= 13, 'Confira o WhatsApp, com DDD.');

export const EntrarEntrada = z.object({ email: Email, senha: z.string().min(1).max(200) });
export const CodigoLoginEntrada = z.object({ codigo: CodigoSeisDigitos });

export const CriarContaEntrada = z.object({
  nome: texto(120).min(2),
  escritorio: texto(120).min(2),
  email: Email,
  senha: Senha,
});

export const AreaEntrada = z.object({ area: AreaId });

export const ItemEntrada = z.object({
  nome: texto(120).min(1),
  detalhe: texto(300).default(''),
  obrigatorio: z.boolean(),
});
export type ItemEntrada = z.infer<typeof ItemEntrada>;

export const CriarBalcaoEntrada = z.object({
  cliente: z.object({
    nome: texto(160).min(2),
    cpf: Cpf.default(''),
    whatsapp: Telefone,
    email: z.union([Email, z.literal('')]).default(''),
  }),
  tipo: texto(80).default(''),
  prazo: DataISO,
  lembrete: z.boolean().default(false),
  itens: z.array(ItemEntrada).min(1).max(60),
});
export type CriarBalcaoEntrada = z.infer<typeof CriarBalcaoEntrada>;

export const RecusarEntrada = z.object({ motivo: texto(500).min(3) });

export const EnviarLinkEntrada = z.object({
  canal: CanalCodigo,
  mensagem: texto(1000).default(''),
});

export const ModeloEntrada = z.object({
  nome: texto(120).min(2),
  quando: texto(300).default(''),
  itens: z.array(ItemEntrada).min(1).max(60),
});

export const OrganizacaoEntrada = z.object({
  nome: texto(120).min(2),
  sigla: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,2}$/).optional(),
  cor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  diasRetencao: z.number().int().min(7).max(3650),
});

export const ConviteEntrada = z.object({ nome: texto(120).min(2), email: Email, permissao: Permissao });
export const PermissaoEntrada = z.object({ permissao: Permissao });
export const AceitarConviteEntrada = z.object({ senha: Senha });

export const TuruEntrada = z.object({
  mensagens: z
    .array(z.object({ de: z.enum(['eu', 'turu']), texto: texto(2000).min(1) }))
    .min(1)
    .max(30),
  lista: z.array(ItemEntrada).max(60).nullable(),
});

export const MudarPlanoEntrada = z.object({ plano: PlanoId });

export const PedirCodigoEntrada = z.object({ canal: CanalCodigo.default('whatsapp') });
export const EntrarClienteEntrada = z.object({ codigo: CodigoSeisDigitos });

export const IniciarUploadEntrada = z.object({
  nomeArquivo: texto(200).min(1),
  tipo: z.enum(TIPOS_PERMITIDOS),
  tamanho: z.number().int().positive().max(TAMANHO_MAXIMO_ARQUIVO, 'O arquivo passa de 10 MB.'),
});

/* ---------- Respostas ---------- */

export interface Eu {
  usuario: { id: string; nome: string; email: string; permissao: Permissao };
  organizacao: { id: string; nome: string; sigla: string; cor: string; area: AreaId; diasRetencao: number };
  plano: PlanoId;
  etapa: EtapaSessao;
}

export interface Contagem {
  pendente: number;
  analise: number;
  aprovado: number;
  recusado: number;
  total: number;
}

export interface BalcaoResumo {
  id: string;
  protocolo: string;
  tipo: string;
  clienteNome: string;
  prazo: string;
  lembrete: boolean;
  concluidoEm: string | null;
  arquivosApagadosEm: string | null;
  contagem: Contagem;
}

export interface DocumentoDto {
  id: string;
  nomeArquivo: string;
  tipo: string;
  tamanho: number;
  status: StatusDocumento;
  motivo: string | null;
  enviadoEm: string;
  temMiniatura: boolean;
}

export interface ItemDetalhe {
  id: string;
  nome: string;
  detalhe: string;
  obrigatorio: boolean;
  status: StatusItem;
  motivo: string | null;
  documento: DocumentoDto | null;
}

export interface BalcaoDetalhe extends BalcaoResumo {
  cliente: { id: string; nome: string; whatsappFinal: string; email: string };
  itens: ItemDetalhe[];
  link: { criadoEm: string; expiraEm: string } | null;
}

export interface LinkGerado {
  url: string;
  expiraEm: string;
}

export interface ModeloDto {
  id: string;
  nome: string;
  quando: string;
  area: AreaId;
  proprio: boolean;
  itens: ItemEntrada[];
}

export interface PessoaDto {
  id: string;
  nome: string;
  email: string;
  permissao: Permissao;
  convitePendente: boolean;
}

export interface ClienteDto {
  id: string;
  nome: string;
  email: string;
  whatsappFinal: string;
  balcoesAbertos: number;
  balcoesTotal: number;
  ultimoBalcaoId: string | null;
}

export interface EventoDto {
  id: string;
  acao: string;
  ator: string;
  criadoEm: string;
  ip: string | null;
}

export interface MarcaDto {
  nome: string;
  sigla: string;
  cor: string;
  comMarca: boolean;
}

export interface AcessoInfo {
  organizacao: MarcaDto;
  clientePrimeiroNome: string;
  whatsappFinal: string;
  temEmail: boolean;
  tipo: string;
  totalItens: number;
}

export interface ItemCliente {
  id: string;
  nome: string;
  detalhe: string;
  obrigatorio: boolean;
  status: StatusItem;
  motivo: string | null;
  verificando: boolean;
}

export interface BalcaoCliente {
  organizacao: MarcaDto;
  clientePrimeiroNome: string;
  tipo: string;
  prazo: string;
  concluido: boolean;
  itens: ItemCliente[];
}

export interface UploadIniciado {
  documentoId: string;
  url: string;
  campos: Record<string, string>;
}

export interface TuruResposta {
  resposta: string;
  lista: ItemEntrada[] | null;
  tipo: string | null;
}

/** Corpo de erro padrão da API. */
export interface ErroApi {
  erro: string;
  codigo?: string;
}
