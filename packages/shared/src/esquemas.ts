import { z } from 'zod';
import { TAMANHO_MAXIMO_ARQUIVO, TIPOS_PERMITIDOS } from './arquivos';
import type { Termo } from './termo';
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

/**
 * O e-mail do cliente é obrigatório em todos os planos: é o canal que sempre
 * funciona (código, lembretes, avisos) e o destino quando o WhatsApp falha ou a cota acaba.
 */
export const CriarBalcaoEntrada = z
  .object({
    cliente: z.object({
      nome: texto(160).min(2),
      cpf: Cpf.default(''),
      whatsapp: Telefone,
      email: Email,
    }),
    tipo: texto(80).default(''),
    prazo: DataISO,
    /** Canal do código de acesso. WhatsApp só no Pro e no Ultra (a API confere). */
    canalCodigo: CanalCodigo.default('email'),
    lembrete: z.boolean().default(true),
    canalLembrete: CanalCodigo.default('email'),
    itens: z.array(ItemEntrada).min(1).max(60),
    /** Pasta do escritório onde o balcão entra (opcional). */
    pastaId: Uuid.nullable().default(null),
  });
export type CriarBalcaoEntrada = z.infer<typeof CriarBalcaoEntrada>;

/** Configurações do balcão que dá para mudar depois de criado. */
export const ConfigBalcaoEntrada = z.object({
  prazo: DataISO.optional(),
  lembrete: z.boolean().optional(),
  canalLembrete: CanalCodigo.optional(),
  canalCodigo: CanalCodigo.optional(),
});

/* ---------- Editar a lista de um balcão aberto ---------- */

export const AdicionarItensEntrada = z.object({ itens: z.array(ItemEntrada).min(1).max(60) });

export const EditarItemEntrada = z.object({
  nome: texto(120).min(1).optional(),
  detalhe: texto(300).optional(),
  obrigatorio: z.boolean().optional(),
  /** O pedido mudou: o item volta a pendente e os arquivos anteriores vão para o histórico. */
  pedirDeNovo: z.boolean().default(false),
});

export const ReordenarEntrada = z.object({ ids: z.array(z.string().uuid()).min(1).max(120) });

export const RecusarEntrada = z.object({ motivo: texto(500).min(3) });

/** Envio do link pela Trames: só por e-mail. Pelo WhatsApp, quem manda é o próprio escritório (wa.me). */
export const EnviarLinkEntrada = z.object({ mensagem: texto(1000).default(''), url: z.string().url().max(500) });

/** O escritório copiou o link ou abriu o WhatsApp dele para mandar: fica na auditoria. */
export const RegistrarEnvioEntrada = z.object({ canal: z.enum(['whatsapp', 'copiado']) });

/* ---------- Pastas ---------- */

export const PastaEntrada = z.object({
  nome: texto(60).min(1, 'Dê um nome para a pasta.'),
  cor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#13594b'),
});

/** Põe o balcão numa pasta ou tira dela (null). */
export const MoverParaPastaEntrada = z.object({ pastaId: Uuid.nullable() });

export const ModeloEntrada = z.object({
  nome: texto(120).min(2),
  quando: texto(300).default(''),
  itens: z.array(ItemEntrada).min(1).max(60),
});

export const OrganizacaoEntrada = z.object({
  nome: texto(120).min(2),
  sigla: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,2}$/).optional(),
  cor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  /** Só vale no Ultra (30, 90, 180 ou 365); nos outros planos a API usa a retenção do plano. */
  diasRetencao: z.number().int().refine((d) => [30, 90, 180, 365].includes(d), 'Escolha 30, 90, 180 ou 365 dias.'),
  /** Como o escritório chama os balcões. */
  termo: z.object({ singular: texto(30).min(2), plural: texto(32).min(2), feminino: z.boolean() }).optional(),
});

export const ConviteEntrada = z.object({ nome: texto(120).min(2), email: Email, permissao: Permissao });
export const PermissaoEntrada = z.object({ permissao: Permissao });
export const AceitarConviteEntrada = z.object({ senha: Senha });

/** Perfil da pessoa: o nome aparece para a equipe e no histórico; o cargo é opcional. */
export const PerfilEntrada = z.object({ nome: texto(120).min(2, 'Escreva o seu nome.'), cargo: texto(80).default('') });
export const TrocarSenhaEntrada = z.object({ atual: z.string().min(1).max(200), nova: Senha });
export const EsqueciSenhaEntrada = z.object({ email: Email });
export const RedefinirSenhaEntrada = z.object({ senha: Senha });

/** Um aparelho (sessão) conectado à conta da pessoa. */
export interface AparelhoDto {
  id: string;
  aparelho: string;
  criadaEm: string;
  atual: boolean;
}

export const MudarPlanoEntrada = z.object({ plano: PlanoId, periodicidade: z.enum(['mensal', 'anual']).default('mensal') });

/** O canal do código é o que o escritório escolheu para o balcão; o cliente não escolhe. */
export const PedirCodigoEntrada = z.object({});
export const EntrarClienteEntrada = z.object({ codigo: CodigoSeisDigitos });

export const IniciarUploadEntrada = z.object({
  nomeArquivo: texto(200).min(1),
  tipo: z.enum(TIPOS_PERMITIDOS),
  tamanho: z.number().int().positive().max(TAMANHO_MAXIMO_ARQUIVO, 'O arquivo passa de 10 MB.'),
});

/* ---------- Respostas ---------- */

export interface Eu {
  usuario: { id: string; nome: string; email: string; cargo: string | null; permissao: Permissao };
  organizacao: { id: string; nome: string; sigla: string; cor: string; area: AreaId; diasRetencao: number; termo: Termo };
  plano: PlanoId;
  periodicidade: 'mensal' | 'anual';
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
  criadoEm: string;
  lembrete: boolean;
  canalLembrete: CanalCodigo;
  canalCodigo: CanalCodigo;
  /** Encerramento (concluído ou arquivado). */
  concluidoEm: string | null;
  /** Preenchido quando o encerramento foi um arquivamento. */
  arquivadoEm: string | null;
  apagarArquivosEm: string | null;
  arquivosApagadosEm: string | null;
  contagem: Contagem;
  pastaId: string | null;
  /** Quem abriu o balcão (para as pastas por pessoa). */
  responsavel: { id: string; nome: string } | null;
}

export interface PastaDto {
  id: string;
  nome: string;
  cor: string;
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
  /** Último arquivo enviado depois do último "pedir de novo". */
  documento: DocumentoDto | null;
  /** Arquivos anteriores (substituídos ou de antes de pedir de novo), do mais novo para o mais antigo. */
  historico: DocumentoDto[];
}

export interface BalcaoDetalhe extends BalcaoResumo {
  cliente: { id: string; nome: string; whatsappFinal: string; email: string };
  itens: ItemDetalhe[];
  link: { criadoEm: string; expiraEm: string } | null;
  /** Aparelhos do cliente com sessão aberta neste balcão. */
  sessoesCliente: number;
  exportacao: ExportacaoDto | null;
}

export interface ExportacaoDto {
  id: string;
  status: 'pendente' | 'pronta' | 'falhou';
  criadaEm: string;
  expiraEm: string | null;
}

/** Uso do mês e do plano, para o painel, a tela Conta e os avisos. */
export interface UsoDto {
  plano: PlanoId;
  periodicidade: 'mensal' | 'anual';
  mes: string;
  balcoesAtivos: number;
  balcoesNoMes: number;
  /** Excedentes já gerados no mês (Ultra). */
  excedentes: number;
  valorExcedentesCentavos: number;
  whatsappEnviados: number;
  pessoas: number;
  trocaSimulada: boolean;
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
  /** Por onde o código vai, como o escritório escolheu (pode cair para e-mail se a cota acabar). */
  canal: CanalCodigo;
  whatsappFinal: string;
  emailMascarado: string;
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
  /** Há miniatura do que o cliente enviou (o original não volta para o celular). */
  temMiniatura: boolean;
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

/** Corpo de erro padrão da API. */
export interface ErroApi {
  erro: string;
  codigo?: string;
}
