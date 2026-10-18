import type { PlanoId } from './tipos';

export type Recurso = 'modelosProprios' | 'turu' | 'lembretes' | 'marca' | 'permissoes' | 'relatorio';

export interface Plano {
  id: PlanoId;
  nome: string;
  preco: number;
  descricao: string;
  /** null = ilimitado */
  limiteBalcoes: number | null;
  limitePessoas: number | null;
  recursos: Record<Recurso, boolean>;
  destaques: string[];
}

export const PLANOS: Record<PlanoId, Plano> = {
  gratis: {
    id: 'gratis',
    nome: 'Grátis',
    preco: 0,
    descricao: 'Para conhecer com calma.',
    limiteBalcoes: 3,
    limitePessoas: 1,
    recursos: { modelosProprios: false, turu: false, lembretes: false, marca: false, permissoes: false, relatorio: false },
    destaques: ['3 balcões ativos', 'Modelos prontos da sua área', 'Link por WhatsApp e e-mail', '1 pessoa na conta'],
  },
  pro: {
    id: 'pro',
    nome: 'Pro',
    preco: 59,
    descricao: 'Para quem atende sozinho ou numa equipe pequena.',
    limiteBalcoes: 40,
    limitePessoas: 3,
    recursos: { modelosProprios: true, turu: true, lembretes: true, marca: true, permissoes: false, relatorio: false },
    destaques: [
      '40 balcões ativos',
      'Seus próprios modelos, sem limite',
      'Turu para montar modelos',
      'Lembretes automáticos para o cliente',
      'Logo e nome do seu escritório no balcão',
      'Até 3 pessoas na conta',
    ],
  },
  ultra: {
    id: 'ultra',
    nome: 'Ultra',
    preco: 119,
    descricao: 'Para escritórios com muitos clientes ao mesmo tempo.',
    limiteBalcoes: null,
    limitePessoas: null,
    recursos: { modelosProprios: true, turu: true, lembretes: true, marca: true, permissoes: true, relatorio: true },
    destaques: [
      'Balcões ativos ilimitados',
      'Tudo o que tem no Pro',
      'Pessoas ilimitadas na conta',
      'Permissões por pessoa',
      'Relatório de prazos e pendências',
    ],
  },
};

export const ORDEM_PLANOS: PlanoId[] = ['gratis', 'pro', 'ultra'];

/** Texto curto de qual plano libera cada recurso, para os avisos de bloqueio. */
export const RECURSO_INFO: Record<Recurso, { titulo: string; texto: string; plano: PlanoId }> = {
  modelosProprios: {
    titulo: 'Seus próprios modelos',
    texto: 'Crie e edite modelos com a lista de documentos que você mais pede. Faz parte do Pro e do Ultra.',
    plano: 'pro',
  },
  turu: {
    titulo: 'Turu',
    texto: 'Conte o caso e o Turu monta a lista de documentos para você revisar. Faz parte do Pro e do Ultra.',
    plano: 'pro',
  },
  lembretes: {
    titulo: 'Lembretes automáticos',
    texto: 'A Trames lembra o cliente pelo WhatsApp até ele enviar tudo. Faz parte do Pro e do Ultra.',
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
