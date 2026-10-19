import { Link } from 'react-router-dom';
import type { BalcaoResumo } from '@trames/shared';
import { dataLonga, diasAte, prazoRelativo } from '../../util/formatos';

/** Uma situação só por balcão, a que mais pede atenção: ponto colorido + texto. */
function Situacao({ b }: { b: BalcaoResumo }) {
  const c = b.contagem;
  if (b.concluidoEm) return <span className={`ponto ${b.arquivadoEm ? 'ponto--encerrado' : 'ponto--aprovado'}`}>{b.arquivadoEm ? 'Arquivado' : 'Concluído'}</span>;
  if (c.analise) return <span className="ponto ponto--analise">{`${c.analise} para conferir`}</span>;
  if (c.recusado) return <span className="ponto ponto--recusado">{`${c.recusado} para reenviar`}</span>;
  if (c.pendente) return <span className="ponto ponto--pendente">Com o cliente</span>;
  return <span className="ponto ponto--aprovado">Pronto para concluir</span>;
}

function Prazo({ b }: { b: BalcaoResumo }) {
  if (b.concluidoEm) return <span className="num texto-suave">{dataLonga(b.concluidoEm.slice(0, 10))}</span>;
  const d = diasAte(b.prazo);
  if (d < 0) return <span className="num" style={{ color: 'var(--recusado)' }}>Venceu {prazoRelativo(b.prazo)}</span>;
  return <span className={d <= 3 ? 'num' : 'num texto-suave'}>{d <= 6 ? `Vence ${prazoRelativo(b.prazo)}` : dataLonga(b.prazo)}</span>;
}

/** Cabeçalho das colunas; vai uma vez por lista. */
export function CabecaLinhas() {
  return (
    <div className="linhas__cabeca" aria-hidden="true">
      <span className="rotulo">Cliente</span>
      <span className="rotulo">Progresso</span>
      <span className="rotulo">Situação</span>
      <span className="rotulo">Prazo</span>
      <span className="rotulo">Responsável</span>
    </div>
  );
}

/** Lista de balcões em linhas: a linha inteira abre o balcão. */
export function ListaBalcoes({ balcoes, cabeca = true }: { balcoes: BalcaoResumo[]; cabeca?: boolean }) {
  return (
    <div>
      {cabeca && <CabecaLinhas />}
      <ul className="linhas">
        {balcoes.map((b) => {
          const c = b.contagem;
          return (
            <li key={b.id}>
              <Link to={`/app/balcao/${b.id}`} className="linha-b">
                <span className="linha-b__nome">
                  <strong>{b.clienteNome}</strong>
                  <span>{b.tipo || <span className="tr-protocolo">{b.protocolo}</span>}</span>
                </span>
                <span className="linha-b__progresso" title={`${c.aprovado} de ${c.total} documentos aprovados`}>
                  <span className="num" style={{ whiteSpace: 'nowrap' }}>
                    {c.aprovado} de {c.total}
                  </span>
                  <span className="barra">
                    <span style={{ '--p': `${c.total ? (c.aprovado / c.total) * 100 : 0}%` } as React.CSSProperties} />
                  </span>
                </span>
                <span className="linha-b__situacao">
                  <Situacao b={b} />
                </span>
                <span className="linha-b__prazo">
                  <Prazo b={b} />
                </span>
                <span className="linha-b__quem">{b.responsavel?.nome ?? '—'}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
