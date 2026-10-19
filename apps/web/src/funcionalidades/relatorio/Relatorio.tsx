import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRelatorio, useSessao } from '../../dados/consultas';
import { Bloqueado, Botao, Carregando, Pagina, Prazo, Segmentado, Status } from '../../ui';
import { dataLonga, diasAte } from '../../util/formatos';

type Filtro = 'todos' | 'atrasados' | 'semana';

function Numero({ valor, rotulo, cor }: { valor: number; rotulo: string; cor?: string }) {
  return (
    <div className="numeros__item">
      <span className="numeros__valor" style={{ color: cor }}>
        {valor}
      </span>
      <span className="pequeno secundario">{rotulo}</span>
    </div>
  );
}

export function Relatorio() {
  const s = useSessao();
  const liberado = s.tem('relatorio');
  const consulta = useRelatorio(liberado);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  if (!liberado)
    return (
      <Pagina titulo="Relatório">
        <Bloqueado recurso="relatorio" />
      </Pagina>
    );
  if (consulta.isPending) return <Carregando />;

  const abertos = consulta.data ?? [];
  const atrasados = abertos.filter((b) => diasAte(b.prazo) < 0);
  const semana = abertos.filter((b) => diasAte(b.prazo) >= 0 && diasAte(b.prazo) <= 7);
  const devidos = abertos.reduce((n, b) => n + b.contagem.pendente + b.contagem.recusado, 0);
  const analise = abertos.reduce((n, b) => n + b.contagem.analise, 0);
  const lista = filtro === 'atrasados' ? atrasados : filtro === 'semana' ? semana : abertos;

  return (
    <Pagina
      titulo="Relatório"
      subtitulo="Balcões abertos, do prazo mais urgente para o mais folgado."
      ferramentas={
        <Botao icone="relatorio" onClick={() => window.print()}>
          Imprimir
        </Botao>
      }
    >
      <div className="grupo numeros">
        <Numero valor={abertos.length} rotulo="abertos" />
        <Numero valor={atrasados.length} rotulo="com prazo vencido" cor={atrasados.length ? 'var(--vermelho)' : undefined} />
        <Numero valor={semana.length} rotulo="vencem em 7 dias" cor={semana.length ? 'var(--laranja)' : undefined} />
        <Numero valor={devidos} rotulo="documentos que os clientes devem" />
        <Numero valor={analise} rotulo="documentos para conferir" cor={analise ? 'var(--azul)' : undefined} />
      </div>

      <div className="barra-filtros">
        <Segmentado
          rotulo="Filtrar"
          valor={filtro}
          mudar={setFiltro}
          opcoes={[
            { id: 'todos', rotulo: 'Todos', contagem: abertos.length },
            { id: 'atrasados', rotulo: 'Atrasados', contagem: atrasados.length },
            { id: 'semana', rotulo: 'Próximos 7 dias', contagem: semana.length },
          ]}
        />
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
              const faltam = c.pendente + c.recusado;
              return (
                <tr key={b.id}>
                  <td>
                    <Link to={`/app/balcao/${b.id}`} style={{ fontWeight: 500 }}>
                      {b.clienteNome}
                    </Link>
                    <div className="mono terciario">{b.protocolo}</div>
                  </td>
                  <td className="secundario">{b.tipo || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {dataLonga(b.prazo)}
                    <div className="pequeno secundario">
                      <Prazo data={b.prazo} />
                    </div>
                  </td>
                  <td>{faltam ? <Status status={c.recusado ? 'recusado' : 'pendente'} texto={`${faltam}${c.recusado ? ` (${c.recusado} recusado)` : ''}`} /> : <span className="terciario">—</span>}</td>
                  <td>{c.analise ? <Status status="analise" texto={String(c.analise)} /> : <span className="terciario">—</span>}</td>
                  <td className="numero">
                    {c.aprovado} de {c.total}
                  </td>
                </tr>
              );
            })}
            {!lista.length && (
              <tr>
                <td colSpan={6} className="secundario" style={{ textAlign: 'center', padding: 24 }}>
                  Nenhum balcão neste filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Pagina>
  );
}
