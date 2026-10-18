import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { NOMES_AREA, type ModeloDto as Modelo } from '@trames/shared';
import { api } from '../dados/api';
import { chaves, useAcao, useModelos, useSessao } from '../dados/consultas';
import { AvisoErro, Bloqueio, Carregando } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { comChave, ListaDocumentos, novoItem, type Item } from './NovoBalcao';

type Aba = 'area' | 'meus' | 'outras';

function CartaoModelo({ m, podeEditar }: { m: Modelo; podeEditar: boolean }) {
  return (
    <article className="cartao" style={{ padding: 22, gap: 14 }}>
      <div className="linha linha--entre" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 12 }}>
        <h2 className="titulo-cartao">{m.nome}</h2>
        <span className="miudo texto-suave" style={{ flex: 'none', paddingTop: 4 }}>
          {m.itens.length} documentos
        </span>
      </div>
      <p className="texto-suave" style={{ fontSize: 15, lineHeight: '22px' }}>
        {m.quando}
      </p>
      <div className="linha" style={{ gap: 6 }}>
        {m.itens.slice(0, 3).map((d) => (
          <span key={d.nome} className="pilula">
            {d.nome}
          </span>
        ))}
      </div>
      <div className="linha" style={{ marginTop: 'auto', paddingTop: 6 }}>
        <Link to={`/app/novo?modelo=${m.id}`} className="tr-btn tr-btn--primario tr-btn--sm">
          Usar modelo
        </Link>
        {podeEditar && (
          <Link to={m.proprio ? `/app/modelos/${m.id}` : `/app/modelos/novo?base=${m.id}`} className="tr-btn tr-btn--discreto tr-btn--sm">
            {m.proprio ? 'Editar' : 'Duplicar e editar'}
          </Link>
        )}
      </div>
    </article>
  );
}

export function Modelos() {
  const sessao = useSessao();
  const consulta = useModelos();
  const [aba, setAba] = useState<Aba>('area');
  const proprios = sessao.tem('modelosProprios');
  const area = sessao.organizacao.area;
  if (consulta.isPending) return <Carregando />;
  const todos = consulta.data ?? [];

  const listas: Record<Aba, Modelo[]> = {
    area: todos.filter((m) => !m.proprio && m.area === area),
    meus: todos.filter((m) => m.proprio),
    outras: todos.filter((m) => !m.proprio && m.area !== area),
  };
  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'area', rotulo: NOMES_AREA[area] },
    { id: 'meus', rotulo: 'Meus modelos' },
    { id: 'outras', rotulo: 'Outras áreas' },
  ];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Modelos</h1>
          <p className="subtitulo">Um modelo é a lista de documentos que você costuma pedir num tipo de caso. Ao abrir um balcão a partir dele, você ainda pode tirar ou acrescentar itens.</p>
        </div>
        {proprios && (
          <div className="linha">
            <Link to="/app/turu" className="tr-btn tr-btn--secundario">
              Montar com o Turu
            </Link>
            <Link to="/app/modelos/novo" className="tr-btn tr-btn--primario">
              <Icone nome="mais" />
              Criar modelo
            </Link>
          </div>
        )}
      </div>

      <div role="tablist" aria-label="Grupos de modelos" className="abas">
        {abas.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="aba" onClick={() => setAba(a.id)}>
            {a.rotulo}
            {a.id === 'meus' && !proprios && <Icone nome="cadeado" tamanho={14} />}
          </button>
        ))}
      </div>

      {aba === 'meus' && !proprios ? (
        <Bloqueio recurso="modelosProprios" />
      ) : listas[aba].length ? (
        <div className="grade">
          {listas[aba].map((m) => (
            <CartaoModelo key={m.id} m={m} podeEditar={proprios} />
          ))}
        </div>
      ) : (
        <div className="cartao cartao--fundo" style={{ alignItems: 'flex-start' }}>
          <p className="texto-suave">Você ainda não criou nenhum modelo.</p>
          <Link to="/app/modelos/novo" className="tr-btn tr-btn--primario tr-btn--sm">
            Criar modelo
          </Link>
        </div>
      )}
    </>
  );
}

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
