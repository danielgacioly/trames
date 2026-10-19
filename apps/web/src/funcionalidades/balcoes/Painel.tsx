import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NOMES_AREA, type BalcaoResumo } from '@trames/shared';
import { useBalcoes, useModelos, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando, Status } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { dataLonga, diasAte, plural, prazoRelativo, primeiroNome, saudacao } from '../../util/formatos';

type Grupo = 'conferir' | 'cliente' | 'concluidos';

function grupoDe(b: BalcaoResumo): Grupo {
  if (b.concluidoEm) return 'concluidos';
  return b.contagem.analise > 0 ? 'conferir' : 'cliente';
}

function CartaoBalcao({ b }: { b: BalcaoResumo }) {
  const c = b.contagem;
  const grupo = grupoDe(b);
  const atrasado = !b.concluidoEm && diasAte(b.prazo) < 0;
  let status = null;
  if (grupo === 'concluidos') status = <Status status={b.arquivadoEm ? 'pendente' : 'aprovado'} texto={`${b.arquivadoEm ? 'Arquivado' : 'Concluído'}${b.arquivosApagadosEm ? ' · arquivos apagados' : ''}`} />;
  else if (c.analise) status = <Status status="analise" texto={`${c.analise} em análise`} />;
  else if (c.recusado) status = <Status status="recusado" texto={`${c.recusado} para reenviar`} />;

  return (
    <article className="tr-balcao" style={{ maxWidth: 'none' }}>
      <div className="tr-balcao__topo">
        <div style={{ minWidth: 0 }}>
          <h2 className="tr-balcao__cliente" style={{ fontSize: 20, lineHeight: '26px' }}>
            {b.clienteNome}
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
            documentos aprovados
          </span>
          <span>{Math.round((c.aprovado / c.total) * 100)}%</span>
        </div>
        <div className="tr-progresso__trilho">
          <div className="tr-progresso__barra" style={{ '--p': `${(c.aprovado / c.total) * 100}%` } as React.CSSProperties} />
        </div>
      </div>
      <div className="tr-balcao__rodape">
        {status ?? (
          <span className="tr-balcao__prazo" style={atrasado ? { color: 'var(--recusado)' } : undefined}>
            <Icone nome="calendario" />
            {atrasado ? `Prazo venceu ${prazoRelativo(b.prazo)}` : `Prazo: ${dataLonga(b.prazo)}`}
          </span>
        )}
        <Link to={`/app/balcao/${b.id}`} className={`tr-btn tr-btn--sm ${grupo === 'conferir' ? 'tr-btn--primario' : 'tr-btn--secundario'}`}>
          {grupo === 'conferir' ? 'Conferir' : grupo === 'concluidos' ? 'Ver balcão' : 'Abrir balcão'}
        </Link>
      </div>
    </article>
  );
}

/** Primeira vez na conta: ainda não há nenhum balcão. */
function Inicio() {
  const s = useSessao();
  const modelos = (useModelos().data ?? []).filter((m) => !m.proprio && m.area === s.organizacao.area).slice(0, 3);
  return (
    <div style={{ flex: 1, borderRadius: 14, border: '1px dashed var(--linha-forte)', backgroundImage: 'radial-gradient(circle, #ddd3c3 1.2px, transparent 1.3px)', backgroundSize: '24px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ width: '100%', maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div className="coluna" style={{ gap: 10, textAlign: 'center', alignItems: 'center' }}>
          <h1 style={{ fontSize: 40, lineHeight: '44px', letterSpacing: '-.02em' }}>Seu espaço está pronto, {primeiroNome(s.usuario.nome)}</h1>
          <p className="texto-suave" style={{ fontSize: 18, lineHeight: '28px', maxWidth: 520 }}>
            Comece por um modelo de {NOMES_AREA[s.organizacao.area].toLowerCase()} ou monte um balcão do zero. Você pode mudar qualquer coisa depois.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          {modelos.map((m) => (
            <Link key={m.id} to={`/app/novo?modelo=${m.id}`} className="cartao" style={{ textDecoration: 'none', color: 'var(--tinta)', padding: 20, gap: 10, minHeight: 168 }}>
              <span className="tr-etiqueta" style={{ alignSelf: 'flex-start' }}>
                Modelo
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: '24px', fontWeight: 600 }}>{m.nome}</span>
              <span className="pequeno texto-suave">
                {plural(m.itens.length, 'documento', 'documentos')}. {m.quando}
              </span>
            </Link>
          ))}
          <Link to="/app/novo" style={{ textDecoration: 'none', color: 'var(--mangue)', border: '1.5px dashed var(--mangue)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 168, textAlign: 'center' }}>
            <Icone nome="mais" tamanho={28} />
            <span style={{ fontWeight: 500 }}>Balcão em branco</span>
          </Link>
        </div>
        {import.meta.env.VITE_TURU === '1' && (
        <Link
          to="/app/turu"
          style={{ textDecoration: 'none', color: 'var(--tinta)', alignSelf: 'center', width: '100%', maxWidth: 640, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--areia-elevada)', border: '1px solid var(--linha)', borderRadius: 9999, padding: '8px 8px 8px 10px' }}
        >
          <img src="/marca/turu.svg" alt="" style={{ width: 36, height: 36, borderRadius: 9999, flex: 'none' }} />
          <span className="texto-suave" style={{ flex: 1, fontSize: 15 }}>
            Prefere contar o caso? O Turu monta a lista para você.
          </span>
          <span className="tr-btn tr-btn--secundario tr-btn--sm" style={{ borderRadius: 9999 }}>
            Falar com o Turu
          </span>
        </Link>
        )}
      </div>
    </div>
  );
}

export function Painel() {
  const s = useSessao();
  const consulta = useBalcoes();
  const [filtro, setFiltro] = useState<'abertos' | Grupo>('abertos');
  const [busca, setBusca] = useState('');

  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  const todos = consulta.data;
  if (todos.length === 0) return <Inicio />;

  const abertos = todos.filter((b) => !b.concluidoEm);
  const listas = {
    abertos,
    cliente: todos.filter((b) => grupoDe(b) === 'cliente'),
    conferir: todos.filter((b) => grupoDe(b) === 'conferir'),
    concluidos: todos.filter((b) => grupoDe(b) === 'concluidos'),
  };
  const rotulos = { abertos: 'Abertos', cliente: 'Esperando o cliente', conferir: 'Para conferir', concluidos: 'Concluídos e arquivados' };
  const termo = busca.trim().toLowerCase();
  const visiveis = listas[filtro].filter((b) => !termo || b.clienteNome.toLowerCase().includes(termo) || b.protocolo.toLowerCase().includes(termo));

  const emAnalise = abertos.reduce((n, b) => n + b.contagem.analise, 0);
  const proximo = abertos.find((b) => diasAte(b.prazo) >= 0);
  const atrasados = abertos.filter((b) => diasAte(b.prazo) < 0).length;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">
            {saudacao()}, {primeiroNome(s.usuario.nome)}
          </h1>
          <p className="subtitulo">
            Você tem {plural(abertos.length, 'balcão aberto', 'balcões abertos')}.{' '}
            {emAnalise > 0 && `${plural(emAnalise, 'documento espera', 'documentos esperam')} a sua conferência. `}
            {atrasados > 0 && `${plural(atrasados, 'balcão está', 'balcões estão')} com o prazo vencido. `}
            {proximo && `O próximo prazo, de ${proximo.clienteNome}, vence ${prazoRelativo(proximo.prazo)}.`}
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, width: 320, maxWidth: '100%', height: 44, padding: '0 14px', border: '1px solid var(--linha-forte)', borderRadius: 10, background: 'var(--areia-elevada)' }}>
          <Icone nome="lupa" tamanho={18} />
          <input
            placeholder="Buscar cliente ou protocolo"
            aria-label="Buscar cliente ou protocolo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', font: 'inherit', fontSize: 15, color: 'var(--tinta)' }}
          />
        </label>
      </div>

      <div className="linha">
        {(Object.keys(listas) as (keyof typeof listas)[]).map((id) => (
          <button key={id} type="button" className="filtro" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
            {rotulos[id]} · {listas[id].length}
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
        <p className="texto-suave">Nenhum balcão por aqui.</p>
      )}
    </>
  );
}
