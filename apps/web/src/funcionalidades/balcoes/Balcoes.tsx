import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BalcaoResumo } from '@trames/shared';
import { useBalcoes, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { plural } from '../../util/formatos';
import { CabecaLinhas, ListaBalcoes } from './ListaBalcoes';
import { Ordenar, useOrdem } from '../../ui/Ordenar';
import { busca, ORDENS_BALCAO, ordenarPor } from './pastas';

type Grupo = 'conferir' | 'cliente' | 'concluidos';

function grupoDe(b: BalcaoResumo): Grupo {
  if (b.concluidoEm) return 'concluidos';
  return b.contagem.analise > 0 ? 'conferir' : 'cliente';
}

const rotulos = { abertos: 'Abertos', conferir: 'Para conferir', cliente: 'Com o cliente', concluidos: 'Concluídos e arquivados' };

function Grupo({ titulo, balcoes }: { titulo: string; balcoes: BalcaoResumo[] }) {
  if (!balcoes.length) return null;
  return (
    <section className="grupo-linhas">
      <h2 className="grupo-linhas__titulo rotulo">
        {titulo} <span className="num">{balcoes.length}</span>
      </h2>
      <ListaBalcoes balcoes={balcoes} cabeca={false} />
    </section>
  );
}

/**
 * Todos os balcões numa lista em linhas. Em "Abertos", primeiro o que espera
 * conferência, depois o que está com o cliente; os concluídos ficam recolhidos no fim.
 */
export function Balcoes() {
  const s = useSessao();
  const consulta = useBalcoes();
  const [filtro, setFiltro] = useState<'abertos' | Grupo>('abertos');
  const [termo, setTermo] = useState('');
  const [ordem, setOrdem] = useOrdem('balcoes', ORDENS_BALCAO);
  const podeMontar = !(s.tem('permissoes') && s.usuario.permissao === 'confere');

  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  const t = termo.trim().toLowerCase();
  const todos = consulta.data.filter((b) => busca(b, t));

  const listas = {
    abertos: ordenarPor(todos.filter((b) => !b.concluidoEm), ordem),
    conferir: ordenarPor(todos.filter((b) => grupoDe(b) === 'conferir'), ordem),
    cliente: ordenarPor(todos.filter((b) => grupoDe(b) === 'cliente'), ordem),
    concluidos: ordenarPor(todos.filter((b) => grupoDe(b) === 'concluidos'), ordem === 'acao' ? 'recentes' : ordem),
  };
  // Em "Abertos" com "Precisa de ação", a lista vem em grupos; nas outras ordens, numa lista só.
  const emGrupos = filtro === 'abertos' && ordem === 'acao';
  const visiveis = listas[filtro];
  // O resumo do topo não muda com a busca.
  const abertosTotal = consulta.data.filter((b) => !b.concluidoEm);
  const conferirTotal = abertosTotal.filter((b) => b.contagem.analise > 0);

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Balcões</h1>
          <p className="subtitulo">
            {plural(abertosTotal.length, 'balcão aberto', 'balcões abertos')}
            {conferirTotal.length > 0 && `, ${plural(conferirTotal.length, 'com documento', 'com documentos')} para conferir`}.
          </p>
        </div>
        <div className="acoes-cabecalho">
          <label className="busca">
            <Icone nome="lupa" tamanho={18} />
            <input placeholder="Buscar cliente, protocolo ou tipo" aria-label="Buscar balcões" value={termo} onChange={(e) => setTermo(e.target.value)} />
          </label>
          {podeMontar && (
            <Link to="/app/novo" className="tr-btn tr-btn--primario">
              <Icone nome="mais" />
              Novo balcão
            </Link>
          )}
        </div>
      </div>

      <div className="filtro-e-ordem">
        <div className="abas" role="tablist" aria-label="Filtrar por situação">
          {(Object.keys(listas) as (keyof typeof listas)[]).map((id) => (
            <button key={id} type="button" role="tab" className="aba" aria-selected={filtro === id} onClick={() => setFiltro(id)}>
              {rotulos[id]} <span className="num">{listas[id].length}</span>
            </button>
          ))}
        </div>
        <Ordenar valor={ordem} mudar={setOrdem} opcoes={ORDENS_BALCAO} />
      </div>

      {!visiveis.length && !(filtro === 'abertos' && listas.concluidos.length) ? (
        <div className="coluna" style={{ gap: 12, alignItems: 'flex-start', padding: '24px 12px' }}>
          <p className="texto-suave">{t ? 'Nenhum balcão encontrado.' : 'Nenhum balcão por aqui.'}</p>
          {!t && podeMontar && filtro === 'abertos' && (
            <Link to="/app/novo" className="tr-btn tr-btn--secundario tr-btn--sm">
              <Icone nome="mais" />
              Novo balcão
            </Link>
          )}
        </div>
      ) : filtro === 'abertos' ? (
        <div>
          <CabecaLinhas />
          {emGrupos ? (
            <>
              <Grupo titulo={rotulos.conferir} balcoes={listas.conferir} />
              <Grupo titulo={rotulos.cliente} balcoes={listas.cliente} />
            </>
          ) : (
            <ListaBalcoes balcoes={listas.abertos} cabeca={false} />
          )}
          {listas.concluidos.length > 0 && (
            <details className="grupo-linhas">
              <summary className="rotulo">
                {rotulos.concluidos} <span className="num">{listas.concluidos.length}</span>
              </summary>
              <ListaBalcoes balcoes={listas.concluidos} cabeca={false} />
            </details>
          )}
        </div>
      ) : (
        <ListaBalcoes balcoes={visiveis} />
      )}
    </>
  );
}
