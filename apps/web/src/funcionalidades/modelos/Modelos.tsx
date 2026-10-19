import { Link } from 'react-router-dom';
import { NOMES_AREA, type ModeloDto as Modelo } from '@trames/shared';
import { useModelos, useSessao } from '../../dados/consultas';
import { Bloqueio, Carregando } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { Ordenar, useOrdem } from '../../ui/Ordenar';

type Area = keyof typeof NOMES_AREA;

const ORDENS = [
  { id: 'padrao', rotulo: 'Sugerida' },
  { id: 'nome', rotulo: 'Nome' },
  { id: 'mais', rotulo: 'Mais documentos' },
  { id: 'menos', rotulo: 'Menos documentos' },
] as const;

function LinhaModelo({ m, podeEditar, secundario = false }: { m: Modelo; podeEditar: boolean; secundario?: boolean }) {
  return (
    <li className={`linha-m${secundario ? ' linha-m--secundaria' : ''}`}>
      <div className="coluna" style={{ gap: 0, minWidth: 0 }}>
        <span className="linha-m__nome">{m.nome}</span>
        <span className="miudo texto-suave">{m.quando}</span>
      </div>
      <span className="num miudo texto-suave">{m.itens.length} documentos</span>
      <div className="linha-m__acoes">
        {podeEditar && (
          <Link to={m.proprio ? `/app/modelos/${m.id}` : `/app/modelos/novo?base=${m.id}`} className="tr-btn tr-btn--discreto tr-btn--sm">
            {m.proprio ? 'Editar' : 'Duplicar e editar'}
          </Link>
        )}
        <Link to={`/app/novo?modelo=${m.id}`} className={`tr-btn tr-btn--sm ${secundario ? 'tr-btn--discreto' : 'tr-btn--secundario'}`}>
          Usar modelo
        </Link>
      </div>
    </li>
  );
}

function GrupoModelos({ titulo, children, n }: { titulo: string; n: number; children: React.ReactNode }) {
  return (
    <section className="grupo-linhas">
      <h2 className="grupo-linhas__titulo rotulo">
        {titulo} <span className="num">{n}</span>
      </h2>
      <ul className="linhas">{children}</ul>
    </section>
  );
}

/** Modelos numa lista agrupada: primeiro a área do escritório, depois os próprios, depois as outras áreas. */
export function Modelos() {
  const sessao = useSessao();
  const consulta = useModelos();
  const proprios = sessao.tem('modelosProprios');
  const [ordem, setOrdem] = useOrdem('modelos', ORDENS);
  const area = sessao.organizacao.area;
  if (consulta.isPending) return <Carregando />;
  const todos = consulta.data ?? [];
  const ordenar = (l: Modelo[]) =>
    ordem === 'nome' ? [...l].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) : ordem === 'mais' ? [...l].sort((a, b) => b.itens.length - a.itens.length) : ordem === 'menos' ? [...l].sort((a, b) => a.itens.length - b.itens.length) : l;
  const meus = ordenar(todos.filter((m) => m.proprio));
  const outras = (Object.keys(NOMES_AREA) as Area[]).filter((a) => a !== area);
  const daArea = (a: Area) => ordenar(todos.filter((m) => !m.proprio && m.area === a));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Modelos</h1>
          <p className="subtitulo">Um modelo é a lista de documentos que você costuma pedir num tipo de caso. Ao abrir um balcão a partir dele, você ainda pode tirar ou acrescentar itens.</p>
        </div>
        <div className="acoes-cabecalho">
          <Ordenar valor={ordem} mudar={setOrdem} opcoes={ORDENS} />
          {proprios && (
            <Link to="/app/modelos/novo" className="tr-btn tr-btn--primario">
              <Icone nome="mais" />
              Criar modelo
            </Link>
          )}
        </div>
      </div>

      <div>
        <section className="modelos-da-area">
          <div className="modelos-da-area__cabeca">
            <h2 className="titulo-2">{NOMES_AREA[area]}</h2>
            <span className="pequeno texto-suave">
              <span className="num">{daArea(area).length}</span> modelos prontos da área do escritório
            </span>
          </div>
          <ul className="linhas">
            {daArea(area).map((m) => (
              <LinhaModelo key={m.id} m={m} podeEditar={proprios} />
            ))}
          </ul>
        </section>

        <section className="grupo-linhas">
          <h2 className="grupo-linhas__titulo rotulo">
            Meus modelos {proprios ? <span className="num">{meus.length}</span> : <Icone nome="cadeado" tamanho={14} />}
          </h2>
          {!proprios ? (
            <Bloqueio recurso="modelosProprios" compacto />
          ) : meus.length ? (
            <ul className="linhas">
              {meus.map((m) => (
                <LinhaModelo key={m.id} m={m} podeEditar />
              ))}
            </ul>
          ) : (
            <div className="linha" style={{ gap: 12, padding: '8px 12px', borderTop: '1px solid var(--linha)' }}>
              <p className="texto-suave">Você ainda não criou nenhum modelo.</p>
              <Link to="/app/modelos/novo" className="tr-btn tr-btn--secundario tr-btn--sm">
                Criar modelo
              </Link>
            </div>
          )}
        </section>

        <section className="outras-areas">
          <h2 className="rotulo">Modelos de outras áreas</h2>
          <p className="miudo texto-suave">Dá para usar ou duplicar, mas não foram pensados para a sua área.</p>
          {outras.map((a) =>
            daArea(a).length ? (
              <GrupoModelos key={a} titulo={NOMES_AREA[a]} n={daArea(a).length}>
                {daArea(a).map((m) => (
                  <LinhaModelo key={m.id} m={m} podeEditar={proprios} secundario />
                ))}
              </GrupoModelos>
            ) : null,
          )}
        </section>
      </div>
    </>
  );
}
