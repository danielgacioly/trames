import { MODELOS_PADRAO } from './modelos';
import type { Balcao, Cliente, Conta, Db, Documento, StatusDoc, Usuario } from './tipos';

/** Senha das três contas de teste. */
export const SENHA_TESTE = 'trames123';

/** Código de acesso que o cliente digita no protótipo (o WhatsApp é simulado). */
export const CODIGO_ACESSO = '482913';

export const CONTAS_TESTE = [
  { plano: 'Grátis', email: 'gratis@trames.app', quem: 'Carla Menezes · Clínica Boa Vista' },
  { plano: 'Pro', email: 'pro@trames.app', quem: 'Ana Albuquerque · Albuquerque & Lima' },
  { plano: 'Ultra', email: 'ultra@trames.app', quem: 'Rafael Moura · Lins & Moura Contabilidade' },
];

const DIA = 24 * 60 * 60 * 1000;

function hojeMeiaNoite() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Data (AAAA-MM-DD) a n dias de hoje. */
export function dia(n: number) {
  const d = new Date(hojeMeiaNoite() + n * DIA);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Momento (ISO) a n dias de hoje, no horário dado. */
function momento(n: number, hora = 10, minuto = 0) {
  return new Date(hojeMeiaNoite() + n * DIA + (hora * 60 + minuto) * 60 * 1000).toISOString();
}

export function gerarCodigo(semente: number) {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  let x = (semente * 2654435761) >>> 0;
  let s = '';
  for (let k = 0; k < 7; k++) {
    s += letras[x % letras.length];
    x = Math.floor(x / letras.length) + (k + 1) * 7919 * semente;
    x >>>= 0;
  }
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function docsDoModelo(modeloId: string, status: StatusDoc[], arquivoBase: string): Documento[] {
  const modelo = MODELOS_PADRAO.find((m) => m.id === modeloId)!;
  return modelo.itens.map((it, k) => {
    const s = status[k] ?? 'pendente';
    const enviado = s !== 'pendente';
    return {
      id: `d${k + 1}`,
      ...it,
      status: s,
      arquivo: enviado ? `${arquivoBase}-${k + 1}.pdf` : undefined,
      enviadoEm: enviado ? momento(-((k % 5) + 1), 9 + (k % 9), 12) : undefined,
      motivo: s === 'recusado' ? 'O arquivo está cortado na parte de baixo. Pode enviar de novo com a folha inteira?' : undefined,
    };
  });
}

interface NovoBalcao {
  n: number;
  contaId: string;
  tipo: string;
  cliente: Cliente;
  prazo: number;
  docs: Documento[];
  lembrete?: boolean;
  codigo?: string;
  concluido?: boolean;
}

function balcao(b: NovoBalcao): Balcao {
  return {
    id: `b${b.n}`,
    contaId: b.contaId,
    codigo: b.codigo ?? gerarCodigo(b.n),
    protocolo: `TRM-2026-${String(b.n).padStart(5, '0')}`,
    tipo: b.tipo,
    cliente: b.cliente,
    prazo: dia(b.prazo),
    lembrete: b.lembrete ?? false,
    docs: b.docs,
    criadoEm: momento(-14 - (b.n % 10)),
    concluidoEm: b.concluido ? momento(-2, 16) : undefined,
  };
}

const cli = (nome: string, n: number): Cliente => {
  const usuario = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, '')
    .split(' ')
    .filter(Boolean);
  return {
    nome,
    cpf: `${String(100 + ((n * 37) % 900))}.${String(100 + ((n * 53) % 900))}.${String(100 + ((n * 71) % 900))}-${String(10 + (n % 89))}`,
    whatsapp: `(81) 9${String(8000 + ((n * 13) % 2000))}-${String(1000 + ((n * 97) % 9000))}`,
    email: `${usuario[0]}.${usuario[usuario.length - 1]}@email.com`,
  };
};

const A: StatusDoc = 'aprovado';
const E: StatusDoc = 'analise';
const P: StatusDoc = 'pendente';
const R: StatusDoc = 'recusado';

function balcoesGratis(): Balcao[] {
  const c = 'c-gratis';
  return [
    balcao({ n: 3101, contaId: c, tipo: 'Pré-operatório', cliente: cli('Roberta Lins', 3101), prazo: 6, docs: docsDoModelo('sau-preop', [A, A, E, P, P, P], 'roberta') }),
    balcao({ n: 3107, contaId: c, tipo: 'Reembolso do plano', cliente: cli('Marcos Teixeira', 3107), prazo: 9, docs: docsDoModelo('sau-reembolso', [P, P, P, P], 'marcos') }),
    balcao({ n: 3088, contaId: c, tipo: 'Primeira consulta', cliente: cli('Helena Prado', 3088), prazo: -3, docs: docsDoModelo('sau-consulta', [A, A, A, A], 'helena'), concluido: true }),
  ];
}

function balcoesPro(): Balcao[] {
  const c = 'c-pro';
  const julio: Documento[] = [
    { id: 'd1', nome: 'Certidão de óbito', detalhe: 'A certidão emitida pelo cartório. Se tiver mais de uma página, envie todas.', obrigatorio: true, status: A, arquivo: 'certidao-obito-maria.pdf', enviadoEm: momento(-6, 11, 5) },
    { id: 'd2', nome: 'RG ou CNH do Júlio', detalhe: 'Frente e verso, ou a CNH digital em PDF.', obrigatorio: true, status: A, arquivo: 'cnh-julio.pdf', enviadoEm: momento(-6, 11, 9) },
    { id: 'd3', nome: 'Comprovante de residência', detalhe: 'Conta de luz, água ou internet dos últimos 90 dias.', obrigatorio: true, status: P },
    { id: 'd4', nome: 'Certidão de casamento', detalhe: 'Só se o Júlio for casado. Pode ser a original ou uma cópia atualizada.', obrigatorio: false, status: P },
    { id: 'd5', nome: 'Matrícula do apartamento', detalhe: 'A matrícula atualizada, pedida no cartório de registro de imóveis.', obrigatorio: true, status: E, arquivo: 'matricula-apartamento.jpg', enviadoEm: momento(-1, 19, 42) },
    { id: 'd6', nome: 'Documento do carro (CRLV)', detalhe: 'O documento mais recente, em PDF ou foto.', obrigatorio: true, status: P },
  ];
  return [
    balcao({
      n: 4127,
      contaId: c,
      tipo: 'Inventário',
      codigo: 'k7m2-9qd',
      lembrete: true,
      cliente: { nome: 'Júlio César Albuquerque', cpf: '412.873.590-27', whatsapp: '(81) 99812-4127', email: 'julio.albuquerque@email.com' },
      prazo: 20,
      docs: julio,
    }),
    balcao({ n: 4131, contaId: c, tipo: 'Previdenciário', cliente: cli('Marta Cavalcanti', 4131), prazo: 24, lembrete: true, docs: docsDoModelo('adv-aposentadoria', [A, E, E, E], 'marta') }),
    balcao({ n: 4109, contaId: c, tipo: 'Divórcio', cliente: cli('Roberto e Camila Sales', 4109), prazo: 3, docs: docsDoModelo('adv-divorcio', [A, A, A, A, A, A], 'sales') }),
    balcao({ n: 4140, contaId: c, tipo: 'Inventário', cliente: cli('Lúcia Ferraz', 4140), prazo: 12, lembrete: true, docs: docsDoModelo('adv-inventario', [], 'lucia') }),
    balcao({ n: 4098, contaId: c, tipo: 'Previdenciário', cliente: cli('Paulo Henrique Rocha', 4098), prazo: 16, docs: docsDoModelo('adv-aposentadoria', [A, A, R, A, A], 'paulo') }),
    balcao({ n: 4088, contaId: c, tipo: 'Imóveis', cliente: cli('Condomínio Maré Alta', 4088), prazo: 27, docs: docsDoModelo('adv-imovel', [A, A, A, A, A, A, A], 'mare-alta') }),
    balcao({ n: 4051, contaId: c, tipo: 'Família', cliente: cli('Fernanda Rêgo', 4051), prazo: -4, docs: docsDoModelo('adv-pensao', [A, A, A, A, A, A], 'fernanda'), concluido: true }),
  ];
}

function balcoesUltra(): Balcao[] {
  const c = 'c-ultra';
  const nomes = ['Ana', 'Bruno', 'Cecília', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Larissa', 'Mateus', 'Natália', 'Otávio', 'Priscila', 'Renato', 'Sofia', 'Tiago', 'Vanessa', 'Wagner'];
  const sobrenomes = ['Barbosa', 'Cardoso', 'Duarte', 'Freitas', 'Gomes', 'Leal', 'Macedo', 'Nunes', 'Pacheco', 'Queiroz', 'Ramos', 'Siqueira', 'Torres', 'Vieira'];
  const empresas = ['Padaria Bom Grão', 'Ótica Visão Clara', 'Ateliê Mãos de Fada', 'Mercadinho Boa Viagem', 'Oficina Dois Irmãos', 'Pet Shop Maracatu', 'Studio Frevo Pilates'];
  const tipos = [
    { modelo: 'cont-irpf', tipo: 'Imposto de Renda' },
    { modelo: 'cont-mensal', tipo: 'Rotina do mês' },
    { modelo: 'cont-admissao', tipo: 'Admissão' },
    { modelo: 'cont-irpf', tipo: 'Imposto de Renda' },
    { modelo: 'cont-abertura', tipo: 'Abertura de empresa' },
  ];
  const lista: Balcao[] = [];
  for (let k = 0; k < 49; k++) {
    const n = 5000 + k * 3;
    const t = tipos[k % tipos.length];
    const empresa = t.tipo === 'Rotina do mês' || t.tipo === 'Admissão';
    const nome = empresa ? empresas[k % empresas.length] : `${nomes[k % nomes.length]} ${sobrenomes[(k * 5) % sobrenomes.length]}`;
    const qtd = MODELOS_PADRAO.find((m) => m.id === t.modelo)!.itens.length;
    const concluido = k >= 46;
    const status: StatusDoc[] = Array.from({ length: qtd }, (_, j) => {
      if (concluido) return A;
      const v = (k * 7 + j * 3) % 10;
      if (v < 4) return A;
      if (v < 6) return E;
      if (v === 6 && k % 5 === 0) return R;
      return P;
    });
    lista.push(
      balcao({
        n,
        contaId: c,
        tipo: t.tipo,
        cliente: cli(nome, n),
        prazo: concluido ? -6 : ((k * 11) % 46) - 6,
        lembrete: k % 3 !== 0,
        docs: docsDoModelo(t.modelo, status, nome.split(' ')[0].toLowerCase()),
        concluido,
      }),
    );
  }
  return lista;
}

export function criarDbInicial(): Db {
  const contas: Conta[] = [
    { id: 'c-gratis', nome: 'Clínica Boa Vista', sigla: 'BV', cor: '#1c5d84', area: 'saude', plano: 'gratis' },
    { id: 'c-pro', nome: 'Albuquerque & Lima Advocacia', sigla: 'AL', cor: '#8a5330', area: 'advocacia', plano: 'pro' },
    { id: 'c-ultra', nome: 'Lins & Moura Contabilidade', sigla: 'LM', cor: '#13594b', area: 'contabilidade', plano: 'ultra' },
  ];
  const u = (id: string, contaId: string, nome: string, email: string, permissao: Usuario['permissao'] = 'admin'): Usuario => ({
    id,
    contaId,
    nome,
    email,
    senha: SENHA_TESTE,
    permissao,
  });
  const usuarios: Usuario[] = [
    u('u-gratis', 'c-gratis', 'Carla Menezes', 'gratis@trames.app'),
    u('u-pro', 'c-pro', 'Ana Albuquerque', 'pro@trames.app'),
    u('u-pro-2', 'c-pro', 'Bruno Lima', 'bruno@albuquerquelima.adv.br', 'monta'),
    u('u-ultra', 'c-ultra', 'Rafael Moura', 'ultra@trames.app'),
    u('u-ultra-2', 'c-ultra', 'Patrícia Lins', 'patricia@linsmoura.com.br'),
    u('u-ultra-3', 'c-ultra', 'Diego Santos', 'diego@linsmoura.com.br', 'monta'),
    u('u-ultra-4', 'c-ultra', 'Juliana Rocha', 'juliana@linsmoura.com.br', 'monta'),
    u('u-ultra-5', 'c-ultra', 'Thiago Barros', 'thiago@linsmoura.com.br', 'confere'),
    u('u-ultra-6', 'c-ultra', 'Marina Costa', 'marina@linsmoura.com.br', 'confere'),
  ];
  const modelosPro = [
    {
      id: 'm-pro-1',
      contaId: 'c-pro',
      area: 'advocacia' as const,
      nome: 'Inventário com herdeiro no exterior',
      quando: 'Criado com o Turu a partir do caso da família Albuquerque.',
      itens: [
        { nome: 'Certidão de óbito', detalhe: 'A certidão emitida pelo cartório.', obrigatorio: true },
        { nome: 'RG e CPF de cada herdeiro', detalhe: 'Um documento com foto de cada um.', obrigatorio: true },
        { nome: 'Procuração com apostila de Haia', detalhe: 'Só para o herdeiro que mora fora do Brasil.', obrigatorio: true },
        { nome: 'Passaporte', detalhe: 'Do herdeiro que mora fora.', obrigatorio: true },
        { nome: 'Matrícula do imóvel', detalhe: 'Atualizada, do cartório de registro de imóveis.', obrigatorio: true },
        { nome: 'Certidão de casamento dos herdeiros', detalhe: 'Se tiver.', obrigatorio: false },
      ],
    },
    {
      id: 'm-pro-2',
      contaId: 'c-pro',
      area: 'advocacia' as const,
      nome: 'Usucapião',
      quando: 'Para quem mora há anos num imóvel sem escritura.',
      itens: [
        { nome: 'Contas antigas no endereço', detalhe: 'Luz ou água de anos diferentes, as mais antigas que tiver.', obrigatorio: true },
        { nome: 'Declaração de vizinhos', detalhe: 'Assinada, dizendo há quanto tempo você mora lá.', obrigatorio: true },
        { nome: 'Planta do imóvel', detalhe: 'Feita por engenheiro ou arquiteto.', obrigatorio: true },
        { nome: 'IPTU', detalhe: 'Carnês pagos, se tiver.', obrigatorio: false },
      ],
    },
  ];
  return {
    versao: 1,
    usuarios,
    contas,
    balcoes: [...balcoesGratis(), ...balcoesPro(), ...balcoesUltra()],
    modelos: [...MODELOS_PADRAO, ...modelosPro],
    sessao: null,
    seq: 6000,
  };
}
