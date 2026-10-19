import type { PlanoId } from './tipos';

/** Recursos que mudam de plano para plano. Lembrete por e-mail e modelos prontos valem em todos. */
export type Recurso = 'modelosProprios' | 'whatsapp' | 'marca' | 'permissoes' | 'relatorio';

export interface Plano {
  id: PlanoId;
  nome: string;
  /** Reais por mês. */
  preco: number;
  /** Reais por ano, pago de uma vez (null = sem plano anual). */
  precoAnual: number | null;
  descricao: string;
  /** Balcões abertos ao mesmo tempo. null = sem limite. */
  limiteBalcoes: number | null;
  /** Balcões novos por mês incluídos no preço; além disso, cada um é cobrado como excedente. */
  balcoesNoMes: number | null;
  limitePessoas: number | null;
  /** Mensagens de WhatsApp enviadas pela Trames por mês (código de acesso e lembretes). */
  cotaWhatsapp: number;
  /** Dias depois de concluído o balcão até os arquivos serem apagados. */
  retencao: { padrao: number; opcoes: number[] };
  recursos: Record<Recurso, boolean>;
  destaques: string[];
}

/** Preço de cada balcão excedente do Ultra, em centavos. */
export const PRECO_EXCEDENTE_CENTAVOS = 100;
/** Aviso ao admin do Ultra quando o mês chega a este número de balcões novos. */
export const AVISO_BALCOES_NO_MES = 180;

export const PLANOS: Record<PlanoId, Plano> = {
  gratis: {
    id: 'gratis',
    nome: 'Grátis',
    preco: 0,
    precoAnual: null,
    descricao: 'Para conhecer com calma.',
    limiteBalcoes: 3,
    balcoesNoMes: null,
    limitePessoas: 1,
    cotaWhatsapp: 0,
    retencao: { padrao: 30, opcoes: [30] },
    recursos: { modelosProprios: false, whatsapp: false, marca: false, permissoes: false, relatorio: false },
    destaques: ['3 balcões ativos', 'Modelos prontos da sua área', 'Código de acesso e lembretes por e-mail', 'Arquivos guardados por 30 dias depois de concluir', '1 pessoa na conta'],
  },
  pro: {
    id: 'pro',
    nome: 'Pro',
    preco: 69,
    precoAnual: 690,
    descricao: 'Para quem atende sozinho ou numa equipe pequena.',
    limiteBalcoes: 40,
    balcoesNoMes: null,
    limitePessoas: 3,
    cotaWhatsapp: 300,
    retencao: { padrao: 90, opcoes: [90] },
    recursos: { modelosProprios: true, whatsapp: true, marca: true, permissoes: false, relatorio: false },
    destaques: [
      '40 balcões ativos',
      'Seus próprios modelos, sem limite',
      'Código e lembretes também pelo WhatsApp (até 300 mensagens por mês)',
      'Logo e nome do seu escritório no balcão',
      'Arquivos guardados por 90 dias depois de concluir',
      'Até 3 pessoas na conta',
    ],
  },
  ultra: {
    id: 'ultra',
    nome: 'Ultra',
    preco: 149,
    precoAnual: 1490,
    descricao: 'Para escritórios com muitos clientes ao mesmo tempo.',
    limiteBalcoes: null,
    balcoesNoMes: 200,
    limitePessoas: null,
    cotaWhatsapp: 1500,
    retencao: { padrao: 90, opcoes: [30, 90, 180, 365] },
    recursos: { modelosProprios: true, whatsapp: true, marca: true, permissoes: true, relatorio: true },
    destaques: [
      '200 balcões novos por mês; depois, R$ 1,00 por balcão',
      'Tudo o que tem no Pro',
      'Até 1.500 mensagens de WhatsApp por mês',
      'Retenção dos arquivos de 30 dias a 12 meses',
      'Pessoas ilimitadas na conta',
      'Permissões por pessoa e relatório de prazos',
    ],
  },
};

export const ORDEM_PLANOS: PlanoId[] = ['gratis', 'pro', 'ultra'];

/** Mês de referência ("AAAA-MM") no fuso de Brasília: é quando o mês vira para a contagem e as cotas. */
export function mesDe(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7);
}

/** Retenção que vale para o escritório: a escolhida, se o plano oferece, ou a padrão do plano. */
export function diasRetencao(plano: PlanoId, escolhida: number) {
  const r = PLANOS[plano].retencao;
  return r.opcoes.includes(escolhida) ? escolhida : r.padrao;
}

/** Texto curto de qual plano libera cada recurso, para os avisos de bloqueio. */
export const RECURSO_INFO: Record<Recurso, { titulo: string; texto: string; plano: PlanoId }> = {
  modelosProprios: {
    titulo: 'Seus próprios modelos',
    texto: 'Crie e edite modelos com a lista de documentos que você mais pede. Faz parte do Pro e do Ultra.',
    plano: 'pro',
  },
  whatsapp: {
    titulo: 'Código e lembretes pelo WhatsApp',
    texto: 'O cliente recebe o código de acesso e os lembretes no WhatsApp, em vez do e-mail. Faz parte do Pro e do Ultra.',
    plano: 'pro',
  },
  marca: {
    titulo: 'Sua marca no balcão',
    texto: 'O cliente vê a sigla e a cor do seu escritório ao abrir o link. Faz parte do Pro e do Ultra.',
    plano: 'pro',
  },
  permissoes: {
    titulo: 'Permissões por pessoa',
    texto: 'Escolha quem monta balcões e quem só confere documentos. Exclusivo do Ultra.',
    plano: 'ultra',
  },
  relatorio: {
    titulo: 'Relatório de prazos e pendências',
    texto: 'Veja num só lugar o que está atrasado, o que vence na semana e quem está devendo documentos. Exclusivo do Ultra.',
    plano: 'ultra',
  },
};

export const NOMES_AREA = {
  contabilidade: 'Contabilidade',
  advocacia: 'Advocacia',
  saude: 'Saúde',
} as const;
