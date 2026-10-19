import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ModeloDto as Modelo } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useModelos, useSessao } from '../../dados/consultas';
import { AvisoErro, Bloqueio, Carregando } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { comChave, ListaDocumentos, novoItem, type Item } from '../balcoes/ListaDocumentos';

export function EditorModelo() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const sessao = useSessao();
  const consulta = useModelos();
  if (!sessao.tem('modelosProprios')) return <Bloqueio recurso="modelosProprios" />;
  if (consulta.isPending) return <Carregando />;
  const existente = consulta.data?.find((m) => m.id === id && m.proprio);
  const base = existente ?? consulta.data?.find((m) => m.id === params.get('base'));
  return <FormularioModelo key={id ?? 'novo'} existente={existente} base={base} />;
}

function FormularioModelo({ existente, base }: { existente?: Modelo; base?: Modelo }) {
  const navegar = useNavigate();
  const [nome, setNome] = useState(existente?.nome ?? (base ? `${base.nome} (cópia)` : ''));
  const [quando, setQuando] = useState(base?.quando ?? '');
  const [itens, setItens] = useState<Item[]>(() => comChave(base?.itens ?? []));
  const salvar = useAcao(
    (corpo: unknown) => (existente ? api('PUT', `/modelos/${existente.id}`, corpo) : api('POST', '/modelos', corpo)),
    [chaves.modelos],
  );
  const excluir = useAcao(() => api('DELETE', `/modelos/${existente!.id}`), [chaves.modelos]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await salvar.mutateAsync({ nome: nome.trim(), quando: quando.trim(), itens: itens.map(({ chave: _, ...it }) => it) });
    navegar('/app/modelos');
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860 }}>
      <Link to="/app/modelos" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start' }}>
        <Icone nome="voltar" />
        Modelos
      </Link>
      <h1 className="titulo-1">{existente ? 'Editar modelo' : 'Novo modelo'}</h1>
      <AvisoErro erro={salvar.error ?? excluir.error} />
      <section className="cartao" style={{ gap: 20 }}>
        <label className="tr-campo tr-campo--largo">
          <span className="tr-campo__rotulo">Nome do modelo</span>
          <input className="tr-campo__entrada" required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Inventário com imóvel rural" />
        </label>
        <label className="tr-campo tr-campo--largo">
          <span className="tr-campo__rotulo">Quando usar</span>
          <input className="tr-campo__entrada" value={quando} onChange={(e) => setQuando(e.target.value)} placeholder="Uma frase para lembrar a equipe" />
        </label>
      </section>
      <section className="cartao">
        <div className="linha linha--entre">
          <h2 className="titulo-2">Documentos</h2>
          <span className="pequeno texto-suave">{itens.length} documentos</span>
        </div>
        <ListaDocumentos itens={itens} mudar={setItens} />
        <button type="button" className="tr-btn tr-btn--secundario" style={{ alignSelf: 'flex-start' }} onClick={() => setItens([...itens, novoItem()])}>
          <Icone nome="mais" />
          Adicionar documento
        </button>
      </section>
      <div className="linha linha--entre">
        {existente ? (
          <button
            type="button"
            className="tr-btn tr-btn--discreto"
            style={{ color: 'var(--recusado)' }}
            onClick={async () => {
              if (window.confirm(`Excluir o modelo ${existente.nome}?`)) {
                await excluir.mutateAsync();
                navegar('/app/modelos');
              }
            }}
          >
            <Icone nome="lixo" />
            Excluir modelo
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="tr-btn tr-btn--primario" disabled={!itens.length || salvar.isPending}>
          Salvar modelo
        </button>
      </div>
    </form>
  );
}
