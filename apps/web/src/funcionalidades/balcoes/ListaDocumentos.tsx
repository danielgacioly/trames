import { useState, type ReactNode } from 'react';
import type { ItemEntrada as ItemModelo, StatusItem } from '@trames/shared';
import { useModelos } from '../../dados/consultas';
import { Icone } from '../../ui/Icone';

/** Item da lista em edição. id e status só existem nos itens que já estão no balcão. */
type Item = ItemModelo & { chave: number; id?: string; status?: StatusItem; temArquivo?: boolean; pedirDeNovo?: boolean };

let chaves = 0;
export const novaChave = () => ++chaves;
const comChave = (itens: ItemModelo[]): Item[] => itens.map((it) => ({ ...it, chave: ++chaves }));

/**
 * Lista editável de documentos: a mesma no balcão novo, em "Editar lista" e no
 * editor de modelos. Lê-se como uma lista escrita; arrastar pelo número (ou as
 * setas) muda a ordem em que o cliente vê. A última linha acrescenta um item.
 */
export function ListaDocumentos({ itens, mudar, extra, remover }: { itens: Item[]; mudar: (itens: Item[]) => void; extra?: (d: Item) => ReactNode; remover?: (d: Item) => void }) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [novo, setNovo] = useState('');
  const editar = (chave: number, dados: Partial<Item>) => mudar(itens.map((x) => (x.chave === chave ? { ...x, ...dados } : x)));
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= itens.length || de === para) return;
    const nova = [...itens];
    const [x] = nova.splice(de, 1);
    nova.splice(para, 0, x);
    mudar(nova);
  };
  const acrescentar = () => {
    const nome = novo.trim();
    if (!nome) return;
    mudar([...itens, { ...novoItem(), nome }]);
    setNovo('');
  };
  return (
    <ul className="docs">
      {itens.map((d, k) => (
        <li
          key={d.chave}
          className={`doc${arrastando === k ? ' doc--arrastando' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (arrastando !== null) mover(arrastando, k);
            setArrastando(null);
          }}
        >
          <span
            className="doc__num"
            draggable
            title="Arraste para mudar a ordem"
            onDragStart={(e) => {
              setArrastando(k);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => setArrastando(null)}
          >
            {String(k + 1).padStart(2, '0')}
          </span>
          <div className="doc__textos">
            <input className="doc__nome" aria-label={`Nome do documento ${k + 1}`} value={d.nome} onChange={(e) => editar(d.chave, { nome: e.target.value })} />
            <input className="doc__detalhe" aria-label={`Explicação do documento ${k + 1}`} value={d.detalhe} placeholder="Explique ao cliente o que serve (opcional)" onChange={(e) => editar(d.chave, { detalhe: e.target.value })} />
            {extra?.(d)}
          </div>
          <button type="button" className="doc__exigencia" aria-pressed={d.obrigatorio} title="Clique para alternar" onClick={() => editar(d.chave, { obrigatorio: !d.obrigatorio })}>
            {d.obrigatorio ? 'Obrigatório' : 'Se tiver'}
          </button>
          <div className="doc__acoes">
            <button type="button" aria-label={`Subir ${d.nome}`} disabled={k === 0} onClick={() => mover(k, k - 1)}>
              <Icone nome="cima" tamanho={16} />
            </button>
            <button type="button" aria-label={`Descer ${d.nome}`} disabled={k === itens.length - 1} onClick={() => mover(k, k + 1)}>
              <Icone nome="baixo" tamanho={16} />
            </button>
            <button type="button" aria-label={`Remover ${d.nome}`} onClick={() => (remover ? remover(d) : mudar(itens.filter((x) => x.chave !== d.chave)))}>
              <Icone nome="xis" tamanho={16} />
            </button>
          </div>
        </li>
      ))}
      <li className="doc-novo">
        <Icone nome="mais" tamanho={18} />
        <input
          aria-label="Novo documento"
          placeholder={itens.length ? 'Escreva o próximo documento e tecle Enter' : 'Escreva o primeiro documento e tecle Enter'}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onBlur={acrescentar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              acrescentar();
            }
          }}
        />
      </li>
    </ul>
  );
}

export function novoItem(): Item {
  return { chave: ++chaves, nome: 'Novo documento', detalhe: '', obrigatorio: true };
}

export { comChave, type Item };

/** Puxa os itens de um modelo para a lista (sem repetir o que já está nela). Escolher já acrescenta. */
export function PuxarModelo({ adicionar }: { adicionar: (itens: ItemModelo[]) => void }) {
  const modelos = useModelos();
  if (!modelos.data?.length) return null;
  return (
    <label className="linha" style={{ gap: 8, paddingLeft: 44, marginTop: 4 }}>
      <span className="pequeno texto-suave">ou</span>
      <select
        className="tr-campo__entrada"
        style={{ height: 36, maxWidth: 280, fontSize: 14 }}
        value=""
        aria-label="Puxar documentos de um modelo"
        onChange={(e) => {
          const m = modelos.data.find((x) => x.id === e.target.value);
          if (m) adicionar(m.itens);
        }}
      >
        <option value="">Puxar os itens de um modelo…</option>
        {modelos.data.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome} ({m.itens.length})
          </option>
        ))}
      </select>
    </label>
  );
}
