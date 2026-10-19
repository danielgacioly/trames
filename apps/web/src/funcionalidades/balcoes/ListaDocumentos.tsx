import { useState, type ReactNode } from 'react';
import type { ItemEntrada } from '@trames/shared';
import { useModelos } from '../../dados/consultas';
import { Icone, Selecao } from '../../ui';

/** Item da lista em edição. id e status só existem nos itens que já estão no balcão. */
export type Item = ItemEntrada & { chave: number; id?: string; status?: import('@trames/shared').StatusItem; temArquivo?: boolean; pedirDeNovo?: boolean };

let chaves = 0;
export const novaChave = () => ++chaves;
export const comChave = (itens: ItemEntrada[]): Item[] => itens.map((it) => ({ ...it, chave: novaChave() }));
export const novoItem = (): Item => ({ chave: novaChave(), nome: '', detalhe: '', obrigatorio: true });
/** Junta itens de um modelo sem repetir os que já estão na lista. */
export const juntar = (itens: Item[], novos: ItemEntrada[]) => [...itens, ...comChave(novos.filter((n) => !itens.some((i) => i.nome.trim().toLowerCase() === n.nome.trim().toLowerCase())))];

/**
 * Lista editável de documentos, como o modo de edição das listas do iOS:
 * remover à esquerda, reordenar à direita (arrastando ou pelas setas).
 * É a mesma no balcão novo, em "Editar lista" e no editor de modelos.
 */
export function ListaDocumentos({
  itens,
  mudar,
  extra,
  remover,
  rodape,
}: {
  itens: Item[];
  mudar: (itens: Item[]) => void;
  extra?: (d: Item) => ReactNode;
  remover?: (d: Item) => void;
  rodape?: ReactNode;
}) {
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
    <div className="grupo">
      <ul className="lista-editor">
        {itens.map((d, k) => (
          <li
            key={d.chave}
            className={`item-editor${arrastando === k ? ' item-editor--arrastando' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (arrastando !== null) mover(arrastando, k);
              setArrastando(null);
            }}
          >
            <button type="button" className="item-editor__remover" aria-label={`Remover ${d.nome || 'documento'}`} onClick={() => (remover ? remover(d) : mudar(itens.filter((x) => x.chave !== d.chave)))}>
              <Icone nome="menos" />
            </button>
            <div className="item-editor__campos">
              <input
                className="entrada entrada--sem-borda item-editor__nome"
                aria-label={`Nome do documento ${k + 1}`}
                placeholder="Nome do documento"
                value={d.nome}
                autoFocus={!d.nome && !d.id}
                onChange={(e) => editar(d.chave, { nome: e.target.value })}
              />
              <input
                className="entrada entrada--sem-borda item-editor__detalhe"
                aria-label={`Explicação do documento ${k + 1}`}
                placeholder="O que serve, como você explicaria ao cliente"
                value={d.detalhe}
                onChange={(e) => editar(d.chave, { detalhe: e.target.value })}
              />
              {extra?.(d)}
            </div>
            <label className="item-editor__obrigatorio">
              <input type="checkbox" className="caixa" checked={d.obrigatorio} onChange={(e) => editar(d.chave, { obrigatorio: e.target.checked })} />
              Obrigatório
            </label>
            <div className="item-editor__ordem">
              <button type="button" className="item-editor__mover" aria-label={`Subir ${d.nome}`} disabled={k === 0} onClick={() => mover(k, k - 1)}>
                <Icone nome="cima" />
              </button>
              <span
                className="item-editor__alca"
                draggable
                title="Arraste para mudar a ordem"
                onDragStart={(e) => {
                  setArrastando(k);
                  e.dataTransfer.effectAllowed = 'move';
                  const li = (e.currentTarget as HTMLElement).closest('li');
                  if (li) e.dataTransfer.setDragImage(li, 20, 20);
                }}
                onDragEnd={() => setArrastando(null)}
              >
                <Icone nome="alca" />
              </span>
              <button type="button" className="item-editor__mover" aria-label={`Descer ${d.nome}`} disabled={k === itens.length - 1} onClick={() => mover(k, k + 1)}>
                <Icone nome="baixo" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {itens.length === 0 && <p className="grupo--vazio pequeno">Nenhum documento ainda.</p>}
      <div className="lista-editor__rodape">
        <button type="button" className="botao botao--simples" onClick={() => mudar([...itens, novoItem()])}>
          <Icone nome="mais" />
          Adicionar documento
        </button>
        {rodape}
      </div>
    </div>
  );
}

/** Puxa os itens de um modelo para a lista. Escolher no menu já adiciona. */
export function PuxarModelo({ adicionar }: { adicionar: (itens: ItemEntrada[]) => void }) {
  const modelos = useModelos();
  if (!modelos.data?.length) return null;
  return (
    <Selecao
      aria-label="Puxar documentos de um modelo"
      value=""
      style={{ width: 'auto', maxWidth: 240 }}
      onChange={(e) => {
        const m = modelos.data.find((x) => x.id === e.target.value);
        if (m) adicionar(m.itens);
      }}
    >
      <option value="">Puxar de um modelo…</option>
      {modelos.data.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nome}
        </option>
      ))}
    </Selecao>
  );
}
