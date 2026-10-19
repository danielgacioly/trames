import { api } from '../../dados/api';
import { chaves, useAcao, usePastas } from '../../dados/consultas';
import { Icone } from '../../ui/Icone';

/** Escolher a pasta do balcão (na tela do balcão). Muda na hora. */
export function PastaDoBalcao({ id, pastaId, editavel }: { id: string; pastaId: string | null; editavel: boolean }) {
  const pastas = usePastas().data ?? [];
  const mover = useAcao((p: string | null) => api('PUT', `/balcoes/${id}/pasta`, { pastaId: p }), [chaves.balcao(id), chaves.balcoes, chaves.historico(id)]);
  const atual = pastas.find((p) => p.id === pastaId);
  if (!editavel) return atual ? <span className="seletor-pasta"><Icone nome="pasta" tamanho={16} />{atual.nome}</span> : null;
  if (!pastas.length) return null;
  return (
    <label className="seletor-pasta" style={atual ? { color: atual.cor } : undefined}>
      <Icone nome="pasta" tamanho={16} />
      <span className="sr-only">Pasta do balcão</span>
      <select value={pastaId ?? ''} disabled={mover.isPending} onChange={(e) => mover.mutate(e.target.value || null)}>
        <option value="">Sem pasta</option>
        {pastas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
