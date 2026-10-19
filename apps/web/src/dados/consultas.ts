import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { PLANOS, type BalcaoDetalhe, type BalcaoResumo, type ClienteDto, type Eu, type EventoDto, type ModeloDto, type PessoaDto, type UsoDto } from '@trames/shared';
import { api, ErroDaApi } from './api';

export const chaves = {
  eu: ['eu'] as const,
  balcoes: ['balcoes'] as const,
  balcao: (id: string) => ['balcoes', id] as const,
  historico: (id: string) => ['balcoes', id, 'historico'] as const,
  modelos: ['modelos'] as const,
  equipe: ['equipe'] as const,
  clientes: ['clientes'] as const,
  relatorio: ['relatorio'] as const,
  cobranca: ['cobranca'] as const,
};

export function useEu() {
  return useQuery({
    queryKey: chaves.eu,
    queryFn: () => api<Eu>('GET', '/auth/eu'),
    retry: (n, e) => !(e instanceof ErroDaApi && e.status === 401) && n < 2,
    staleTime: 30_000,
  });
}

/** Sessão completa já carregada (só dentro do app, depois do LayoutApp). */
export function useSessao() {
  const eu = useEu().data!;
  const plano = PLANOS[eu.plano];
  return { ...eu, plano, tem: (r: keyof typeof plano.recursos) => plano.recursos[r] };
}

export const useBalcoes = (ativo = true) => useQuery({ queryKey: chaves.balcoes, queryFn: () => api<BalcaoResumo[]>('GET', '/balcoes'), enabled: ativo });
export const useBalcao = (id: string) =>
  useQuery({
    queryKey: chaves.balcao(id),
    queryFn: () => api<BalcaoDetalhe>('GET', `/balcoes/${id}`),
    // Enquanto um arquivo está no antivírus ou o ZIP está sendo montado, atualiza sozinho.
    refetchInterval: (q) => (q.state.data?.itens.some((i) => i.documento?.status === 'quarentena') || q.state.data?.exportacao?.status === 'pendente' ? 3000 : false),
  });
export const useHistorico = (id: string, ativo: boolean) =>
  useQuery({ queryKey: chaves.historico(id), queryFn: () => api<EventoDto[]>('GET', `/auditoria/balcao/${id}`), enabled: ativo });
export const useModelos = () => useQuery({ queryKey: chaves.modelos, queryFn: () => api<ModeloDto[]>('GET', '/modelos'), staleTime: 60_000 });
export const useEquipe = () => useQuery({ queryKey: chaves.equipe, queryFn: () => api<PessoaDto[]>('GET', '/organizacao/equipe') });
export const useClientes = () => useQuery({ queryKey: chaves.clientes, queryFn: () => api<ClienteDto[]>('GET', '/clientes') });
export const useRelatorio = (ativo: boolean) => useQuery({ queryKey: chaves.relatorio, queryFn: () => api<BalcaoResumo[]>('GET', '/relatorio'), enabled: ativo });
export const useCobranca = (ativo = true) => useQuery({ queryKey: chaves.cobranca, queryFn: () => api<UsoDto>('GET', '/cobranca'), enabled: ativo });

/** Mutação que, ao terminar, recarrega as consultas indicadas. */
export function useAcao<E = void, S = unknown>(fn: (entrada: E) => Promise<S>, invalidar: QueryKey[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(invalidar.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
}
