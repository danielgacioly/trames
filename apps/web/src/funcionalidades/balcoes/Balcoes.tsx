import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BalcaoResumo } from '@trames/shared';
import { useBalcoes, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando, Status } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { dataLonga, diasAte, plural, prazoRelativo } from '../../util/formatos';
import { busca, ordenar } from './pastas';

type Grupo = 'conferir' | 'cliente' | 'concluidos';

function grupoDe(b: BalcaoResumo): Grupo {
  if (b.concluidoEm) return 'concluidos';
  return b.contagem.analise > 0 ? 'conferir' : 'cliente';
}

/** Cartão de um balcão: cliente, progresso dos documentos e a situação que mais pede atenção. */
export function CartaoBalcao({ b }: { b: BalcaoResumo }) {
  const c = b.contagem;
  const grupo = grupoDe(b);
  const atrasado = !b.concluidoEm && diasAte(b.prazo) < 0;
  const p = c.total ? (c.aprovado / c.total) * 100 : 0;
  let status = null;
  if (grupo === 'concluidos') status = <Status status={b.arquivadoEm ? 'pendente' : 'aprovado'} texto={`${b.arquivadoEm ? 'Arquivado' : 'Concluído'}${b.arquivosApagadosEm ? ' · arquivos apagados' : ''}`} />;
  else if (c.analise) status = <Status status="analise" texto={`${c.analise} para conferir`} />;
  else if (c.recusado) status = <Status status="recusado" texto={`${c.recusado} para reenviar`} />;

  return (
    <article className="tr-balcao cartao-balcao">
      <div className="tr-balcao__topo">
        <div style={{ minWidth: 0 }}>
          <h2 className="tr-balcao__cliente cartao-balcao__cliente">
            <Link to={`/app/balcao/${b.id}`}>{b.clienteNome}</Link>
          </h2>
          <span className="tr-protocolo tr-balcao__protocolo">{b.protocolo}</span>
        </div>
        {b.tipo && <span className="tr-etiqueta">{b.tipo}</span>}
      </div>
      <div className="tr-progresso">
        <div className="tr-progresso__topo">
          <span>
            <strong>
              {c.aprovado} de {c.total}
            </strong>{' '}
            aprovados
          </span>
          <span>{Math.round(p)}%</span>
        </div>
        <div className="tr-progresso__trilho">
          <div className="tr-progresso__barra" style={{ '--p': `${p}%` } as React.CSSProperties} />
        </div>
      </div>
      <div className="tr-balcao__rodape">
        {status ?? (
          <span className="tr-balcao__prazo" style={atrasado ? { color: 'var(--recusado)' } : undefined}>
            <Icone nome="calendario" />
            {atrasado ? `Venceu ${prazoRelativo(b.prazo)}` : `Prazo: ${dataLonga(b.prazo)}`}
          </span>
        )}
        <Link to={`/app/balcao/${b.id}`} className={`tr-btn tr-btn--sm ${grupo === 'conferir' ? 'tr-btn--primario' : 'tr-btn--secundario'}`}>
          {grupo === 'conferir' ? 'Conferir' : 'Abrir'}
        </Link>
      </div>
    </article>
  );
}

/** Todos os balcões numa grade, com filtro por situação e busca. */
export function Balcoes() {
  const s = useSessao();
  const consulta = useBalcoes();
  const [filtro, setFiltro] = useState<'abertos' | Grupo>('abertos');
  const [termo, setTermo] = useState('');
  const podeMontar = !(s.tem('permissoes') && s.usuario.permissao === 'confere');

  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  const todos = consulta.data;

  const listas = {
    abertos: todos.filter((b) => !b.concluidoEm),
    conferir: todos.filter((b) => grupoDe(b) === 'conferir'),
    cliente: todos.filter((b) => grupoDe(b) === 'cliente'),
    concluidos: todos.filter((b) => grupoDe(b) === 'concluidos'),
  };
  const rotulos = { abertos: 'Abertos', conferir: 'Para conferir', cliente: 'Com o cliente', concluidos: 'Concluídos e arquivados' };
  const t = termo.trim().toLowerCase();
  const visiveis = ordenar(listas[filtro].filter((b) => busca(b, t)));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Balcões</h1>
          <p className="subtitulo">
            {plural(listas.abertos.length, 'balcão aberto', 'balcões abertos')}
            {listas.conferir.length > 0 && `, ${plural(listas.conferir.length, 'com documento', 'com documentos')} para conferir`}.
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

      <div className="linha filtros" role="group" aria-label="Filtrar por situação">
        {(Object.keys(listas) as (keyof typeof listas)[]).map((id) => (
          <button key={id} type="button" className="filtro" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
            {rotulos[id]} <span className="filtro__conta">{listas[id].length}</span>
          </button>
        ))}
      </div>

      {visiveis.length ? (
        <div className="grade">
          {visiveis.map((b) => (
            <CartaoBalcao key={b.id} b={b} />
          ))}
        </div>
      ) : (
        <div className="vazio">
          <p className="texto-suave">{t ? 'Nenhum balcão encontrado.' : 'Nenhum balcão por aqui.'}</p>
          {!t && podeMontar && filtro === 'abertos' && (
            <Link to="/app/novo" className="tr-btn tr-btn--secundario tr-btn--sm">
              <Icone nome="mais" />
              Novo balcão
            </Link>
          )}
        </div>
      )}
    </>
  );
}
