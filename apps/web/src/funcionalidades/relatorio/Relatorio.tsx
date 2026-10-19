import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRelatorio, useSessao } from '../../dados/consultas';
import { Bloqueio, Carregando, Status } from '../../ui/comuns';
import { dataLonga, diasAte, prazoRelativo } from '../../util/formatos';

function Numero({ valor, rotulo, cor }: { valor: number; rotulo: string; cor?: string }) {
  return (
    <div className="cartao" style={{ padding: 20, gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: '40px', fontWeight: 600, color: cor }}>{valor}</span>
      <span className="pequeno texto-suave">{rotulo}</span>
    </div>
  );
}

export function Relatorio() {
  const s = useSessao();
  const consulta = useRelatorio(s.tem('relatorio'));
  const [so, setSo] = useState<'todos' | 'atrasados' | 'semana'>('todos');

  if (!s.tem('relatorio')) {
    return (
      <>
        <h1 className="titulo-1">Relatório de prazos e pendências</h1>
        <Bloqueio recurso="relatorio" />
      </>
    );
  }
  if (consulta.isPending) return <Carregando />;

  const abertos = consulta.data ?? [];
  const atrasados = abertos.filter((b) => diasAte(b.prazo) < 0);
  const semana = abertos.filter((b) => diasAte(b.prazo) >= 0 && diasAte(b.prazo) <= 7);
  const pendentes = abertos.reduce((n, b) => n + b.contagem.pendente + b.contagem.recusado, 0);
  const analise = abertos.reduce((n, b) => n + b.contagem.analise, 0);
  const lista = so === 'atrasados' ? atrasados : so === 'semana' ? semana : abertos;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Relatório de prazos e pendências</h1>
          <p className="subtitulo">Os balcões abertos, do prazo mais urgente para o mais folgado.</p>
        </div>
        <button type="button" className="tr-btn tr-btn--secundario" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <Numero valor={abertos.length} rotulo="balcões abertos" />
        <Numero valor={atrasados.length} rotulo="com prazo vencido" cor="var(--recusado)" />
        <Numero valor={semana.length} rotulo="vencem em até 7 dias" cor="var(--pendente)" />
        <Numero valor={pendentes} rotulo="documentos que o cliente deve" />
        <Numero valor={analise} rotulo="documentos para conferir" cor="var(--em-analise)" />
      </div>
      <div className="linha">
        {(
          [
            ['todos', `Todos · ${abertos.length}`],
            ['atrasados', `Atrasados · ${atrasados.length}`],
            ['semana', `Próximos 7 dias · ${semana.length}`],
          ] as const
        ).map(([id, rotulo]) => (
          <button key={id} type="button" className="filtro" aria-pressed={so === id} onClick={() => setSo(id)}>
            {rotulo}
          </button>
        ))}
      </div>
      <div className="tabela-caixa">
        <table className="tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Prazo</th>
              <th>Faltam do cliente</th>
              <th>Para conferir</th>
              <th>Aprovados</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((b) => {
              const c = b.contagem;
              const d = diasAte(b.prazo);
              return (
                <tr key={b.id}>
                  <td>
                    <Link to={`/app/balcao/${b.id}`} style={{ fontWeight: 500 }}>
                      {b.clienteNome}
                    </Link>
                    <div className="tr-protocolo texto-suave">{b.protocolo}</div>
                  </td>
                  <td>{b.tipo && <span className="tr-etiqueta">{b.tipo}</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {dataLonga(b.prazo)}
                    <div className="miudo" style={{ color: d < 0 ? 'var(--recusado)' : d <= 7 ? 'var(--pendente)' : 'var(--tinta-suave)' }}>
                      {d < 0 ? `venceu ${prazoRelativo(b.prazo)}` : `vence ${prazoRelativo(b.prazo)}`}
                    </div>
                  </td>
                  <td>{c.pendente + c.recusado ? <Status status={c.recusado ? 'recusado' : 'pendente'} texto={`${c.pendente + c.recusado}${c.recusado ? ` (${c.recusado} recusado)` : ''}`} /> : '—'}</td>
                  <td>{c.analise ? <Status status="analise" texto={String(c.analise)} /> : '—'}</td>
                  <td>
                    {c.aprovado} de {c.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
