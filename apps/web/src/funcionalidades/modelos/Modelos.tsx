import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NOMES_AREA, type ModeloDto as Modelo } from '@trames/shared';
import { useModelos, useSessao } from '../../dados/consultas';
import { Bloqueio, Carregando } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';

type Aba = 'area' | 'meus' | 'outras';

function CartaoModelo({ m, podeEditar }: { m: Modelo; podeEditar: boolean }) {
  return (
    <article className="cartao" style={{ padding: 18, gap: 12 }}>
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
