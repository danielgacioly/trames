import type { BalcaoResumo, PastaDto } from '@trames/shared';
import { diasAte } from '../../util/formatos';

/*
 * Pastas da tela Início. As de situação, tipo de caso e pessoa são calculadas
 * a partir da lista de balcões; as "Minhas pastas" vêm do banco (PastaDto).
 * O endereço de cada pasta é /app/pastas/:grupo/:valor.
 */

export type GrupoPasta = 'situacao' | 'minhas' | 'tipo' | 'pessoa';

export interface Pasta {
  grupo: GrupoPasta;
  valor: string;
  nome: string;
  /** Cor da pasta (ícone). */
  cor: string;
  /** Pastas de situação já dizem se o balcão está aberto; as outras mostram abertos e, à parte, os encerrados. */
  porSituacao: boolean;
  teste: (b: BalcaoResumo) => boolean;
  /** Texto quando a pasta está vazia. */
  vazia: string;
}

const aberto = (b: BalcaoResumo) => !b.concluidoEm;
const vencido = (b: BalcaoResumo) => aberto(b) && diasAte(b.prazo) < 0;

export const SITUACOES: Pasta[] = [
  { grupo: 'situacao', valor: 'conferir', nome: 'Para conferir', cor: 'var(--em-analise)', porSituacao: true, teste: (b) => aberto(b) && b.contagem.analise > 0, vazia: 'Nenhum documento esperando a sua conferência.' },
  {
    grupo: 'situacao',
    valor: 'cliente',
    nome: 'Com o cliente',
    cor: 'var(--pendente)',
    porSituacao: true,
    teste: (b) => aberto(b) && b.contagem.analise === 0 && b.contagem.pendente + b.contagem.recusado > 0,
    vazia: 'Nenhum balcão esperando o cliente.',
  },
  { grupo: 'situacao', valor: 'vencidos', nome: 'Prazo vencido', cor: 'var(--recusado)', porSituacao: true, teste: vencido, vazia: 'Nenhum prazo vencido.' },
  {
    grupo: 'situacao',
    valor: 'concluir',
    nome: 'Tudo aprovado',
    cor: 'var(--mangue)',
    porSituacao: true,
    teste: (b) => aberto(b) && b.contagem.analise + b.contagem.pendente + b.contagem.recusado === 0,
    vazia: 'Nenhum balcão com tudo aprovado.',
  },
  { grupo: 'situacao', valor: 'abertos', nome: 'Todos os abertos', cor: 'var(--tinta-suave)', porSituacao: true, teste: aberto, vazia: 'Nenhum balcão aberto.' },
  { grupo: 'situacao', valor: 'encerrados', nome: 'Encerrados', cor: 'var(--tinta-suave)', porSituacao: true, teste: (b) => !aberto(b), vazia: 'Nenhum balcão encerrado.' },
];

export const SEM_TIPO = '-';

export function pastasDeTipo(balcoes: BalcaoResumo[]): Pasta[] {
  const tipos = [...new Set(balcoes.map((b) => b.tipo.trim() || SEM_TIPO))].sort((a, b) => (a === SEM_TIPO ? 1 : b === SEM_TIPO ? -1 : a.localeCompare(b, 'pt-BR')));
  return tipos.map((t) => ({
    grupo: 'tipo',
    valor: t,
    nome: t === SEM_TIPO ? 'Sem tipo' : t,
    cor: 'var(--raiz)',
    porSituacao: false,
    teste: (b) => (b.tipo.trim() || SEM_TIPO) === t,
    vazia: 'Nenhum balcão deste tipo.',
  }));
}

export function pastasDePessoa(balcoes: BalcaoResumo[]): Pasta[] {
  const pessoas = new Map(balcoes.filter((b) => b.responsavel).map((b) => [b.responsavel!.id, b.responsavel!.nome]));
  return [...pessoas]
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
    .map(([id, nome]) => ({ grupo: 'pessoa', valor: id, nome, cor: 'var(--raiz)', porSituacao: false, teste: (b) => b.responsavel?.id === id, vazia: `${nome} ainda não abriu balcões.` }));
}

export function minhasPastas(pastas: PastaDto[]): Pasta[] {
  return pastas.map((p) => ({ grupo: 'minhas', valor: p.id, nome: p.nome, cor: p.cor, porSituacao: false, teste: (b) => b.pastaId === p.id, vazia: 'Nenhum balcão nesta pasta. Escolha a pasta ao criar o balcão ou na tela do balcão.' }));
}

/** Acha a pasta de um endereço. */
export function acharPasta(grupo: string, valor: string, balcoes: BalcaoResumo[], pastas: PastaDto[]): Pasta | undefined {
  const todas = grupo === 'situacao' ? SITUACOES : grupo === 'tipo' ? pastasDeTipo(balcoes) : grupo === 'pessoa' ? pastasDePessoa(balcoes) : grupo === 'minhas' ? minhasPastas(pastas) : [];
  return todas.find((p) => p.valor === valor);
}

export const enderecoDa = (p: Pasta) => `/app/pastas/${p.grupo}/${encodeURIComponent(p.valor)}`;

/** Para conferir primeiro; depois, o prazo mais perto. */
export const ordenar = (lista: BalcaoResumo[]) => [...lista].sort((a, b) => Number(b.contagem.analise > 0) - Number(a.contagem.analise > 0) || a.prazo.localeCompare(b.prazo));

export const busca = (b: BalcaoResumo, termo: string) => !termo || b.clienteNome.toLowerCase().includes(termo) || b.protocolo.toLowerCase().includes(termo) || b.tipo.toLowerCase().includes(termo);

export const CORES_PASTA = ['#13594b', '#8a5330', '#1c5d84', '#a9361b', '#865600', '#2e241b'];
