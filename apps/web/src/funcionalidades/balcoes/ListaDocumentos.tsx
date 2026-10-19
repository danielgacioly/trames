import { useState, type ReactNode } from 'react';
import type { ItemEntrada as ItemModelo, StatusItem } from '@trames/shared';
import { useModelos } from '../../dados/consultas';
import { Icone } from '../../ui/Icone';

/** Item da lista em edição. id e status só existem nos itens que já estão no balcão. */
type Item = ItemModelo & { chave: number; id?: string; status?: StatusItem; temArquivo?: boolean; pedirDeNovo?: boolean };

let chaves = 0;
export const novaChave = () => ++chaves;
const comChave = (itens: ItemModelo[]): Item[] => itens.map((it) => ({ ...it, chave: ++chaves }));

const botaoIcone = { width: 32, height: 32, flex: 'none', display: 'grid', placeItems: 'center', border: 0, borderRadius: 8, background: 'transparent', color: 'var(--tinta-suave)', cursor: 'pointer' } as const;

/**
 * Lista editável de documentos: a mesma no balcão novo, em "Editar lista" e no
 * editor de modelos. Arrastar (ou as setas) muda a ordem em que o cliente vê.
 */
export function ListaDocumentos({ itens, mudar, extra, remover }: { itens: Item[]; mudar: (itens: Item[]) => void; extra?: (d: Item) => ReactNode; remover?: (d: Item) => void }) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const editar = (chave: number, dados: Partial<Item>) => mudar(itens.map((x) => (x.chave === chave ? { ...x, ...dados } : x)));
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= itens.length || de === para) return;
    const nova = [...itens];
    const [x] = nova.splice(de, 1);
    nova.splice(para, 0, x);
    mudar(nova);
  };
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {itens.map((d, k) => (
        <li
          key={d.chave}
          draggable
          onDragStart={(e) => {
            setArrastando(k);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (arrastando !== null) mover(arrastando, k);
            setArrastando(null);
          }}
          onDragEnd={() => setArrastando(null)}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 12px 12px 6px', border: '1px solid var(--linha)', borderRadius: 12, background: 'var(--areia)', opacity: arrastando === k ? 0.5 : 1 }}
        >
          <div className="coluna" style={{ gap: 0, flex: 'none', alignItems: 'center' }}>
            <span title="Arraste para mudar a ordem" style={{ ...botaoIcone, cursor: 'grab', height: 20 }} aria-hidden="true">
              <Icone nome="alca" tamanho={18} />
            </span>
            <button type="button" style={{ ...botaoIcone, height: 24 }} aria-label={`Subir ${d.nome}`} disabled={k === 0} onClick={() => mover(k, k - 1)}>
              <Icone nome="cima" tamanho={16} />
            </button>
            <button type="button" style={{ ...botaoIcone, height: 24 }} aria-label={`Descer ${d.nome}`} disabled={k === itens.length - 1} onClick={() => mover(k, k + 1)}>
              <Icone nome="baixo" tamanho={16} />
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              aria-label={`Nome do documento ${k + 1}`}
              value={d.nome}
              onChange={(e) => editar(d.chave, { nome: e.target.value })}
              style={{ font: 'inherit', fontSize: 16, fontWeight: 500, border: '1px solid transparent', borderRadius: 8, background: 'transparent', padding: '4px 6px', color: 'var(--tinta)' }}
            />
            <input
              aria-label={`Explicação do documento ${k + 1}`}
              value={d.detalhe}
              placeholder="Diga ao cliente o que serve neste item."
              onChange={(e) => editar(d.chave, { detalhe: e.target.value })}
              style={{ font: 'inherit', fontSize: 14, border: '1px solid transparent', borderRadius: 8, background: 'transparent', padding: '2px 6px', color: 'var(--tinta-suave)' }}
            />
            {extra?.(d)}
          </div>
          <button
            type="button"
            onClick={() => editar(d.chave, { obrigatorio: !d.obrigatorio })}
            aria-pressed={d.obrigatorio}
            style={{
              fontSize: 13,
              height: 32,
              padding: '0 12px',
              borderRadius: 9999,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginTop: 2,
              ...(d.obrigatorio
                ? { border: '1px solid var(--mangue)', background: 'var(--mangue-suave)', color: 'var(--mangue)' }
                : { border: '1px solid var(--linha-forte)', background: 'var(--areia-elevada)', color: 'var(--tinta-suave)' }),
            }}
          >
            {d.obrigatorio ? 'Obrigatório' : 'Se tiver'}
          </button>
          <button type="button" onClick={() => (remover ? remover(d) : mudar(itens.filter((x) => x.chave !== d.chave)))} aria-label={`Remover ${d.nome}`} style={{ ...botaoIcone, marginTop: 2 }}>
            <Icone nome="xis" tamanho={18} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function novoItem(): Item {
  return { chave: ++chaves, nome: 'Novo documento', detalhe: '', obrigatorio: true };
}

export { comChave, type Item };

/** Puxa os itens de um modelo para a lista (sem repetir o que já está nela). */
export function PuxarModelo({ adicionar }: { adicionar: (itens: ItemModelo[]) => void }) {
  const modelos = useModelos();
  const [id, setId] = useState('');
  if (!modelos.data?.length) return null;
  return (
    <label className="linha" style={{ gap: 8 }}>
      <span className="sr-only">Puxar documentos de um modelo</span>
      <select className="tr-campo__entrada" style={{ height: 40, maxWidth: 260 }} value={id} onChange={(e) => setId(e.target.value)}>
        <option value="">Puxar de um modelo…</option>
        {modelos.data.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="tr-btn tr-btn--discreto"
        disabled={!id}
        onClick={() => {
          const m = modelos.data.find((x) => x.id === id);
          if (m) adicionar(m.itens);
          setId('');
        }}
      >
        Adicionar itens
      </button>
    </label>
  );
}
