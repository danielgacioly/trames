import { Link } from 'react-router-dom';
import type { BalcaoResumo } from '@trames/shared';
import { Status } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { dataLonga, diasAte, prazoRelativo } from '../../util/formatos';

/** Uma situação só por balcão, a que mais pede atenção. */
function Situacao({ b }: { b: BalcaoResumo }) {
  const c = b.contagem;
  if (b.concluidoEm) return <Status status={b.arquivadoEm ? 'pendente' : 'aprovado'} texto={b.arquivadoEm ? 'Arquivado' : 'Concluído'} />;
  if (c.analise) return <Status status="analise" texto={`${c.analise} para conferir`} />;
  if (c.recusado) return <Status status="recusado" texto={`${c.recusado} para reenviar`} />;
  if (c.pendente) return <Status status="pendente" texto="Com o cliente" />;
  return <Status status="aprovado" texto="Pronto para concluir" />;
}

function Prazo({ b }: { b: BalcaoResumo }) {
  if (b.concluidoEm) return <span className="texto-suave">{dataLonga(b.concluidoEm.slice(0, 10))}</span>;
  const d = diasAte(b.prazo);
  if (d < 0) return <span style={{ color: 'var(--recusado)' }}>Venceu {prazoRelativo(b.prazo)}</span>;
  return <span className={d <= 3 ? undefined : 'texto-suave'}>{d <= 6 ? `Vence ${prazoRelativo(b.prazo)}` : dataLonga(b.prazo)}</span>;
}

/** Lista enxuta de balcões: uma linha por balcão, a linha inteira abre o balcão. */
export function ListaBalcoes({ balcoes }: { balcoes: BalcaoResumo[] }) {
  return (
    <ul className="lista-balcoes">
      {balcoes.map((b) => {
        const c = b.contagem;
        return (
          <li key={b.id}>
            <Link to={`/app/balcao/${b.id}`} className="linha-balcao">
              <span className="linha-balcao__nome">
                <strong>{b.clienteNome}</strong>
                <span className="miudo texto-suave">
                  <span className="tr-protocolo">{b.protocolo}</span>
                  {b.tipo && ` · ${b.tipo}`}
                </span>
              </span>
              <span className="linha-balcao__progresso miudo texto-suave" title={`${c.aprovado} de ${c.total} documentos aprovados`}>
                <span className="tr-progresso__trilho">
                  <span className="tr-progresso__barra" style={{ '--p': `${c.total ? (c.aprovado / c.total) * 100 : 0}%`, display: 'block' } as React.CSSProperties} />
                </span>
                {c.aprovado}/{c.total}
              </span>
              <span className="linha-balcao__situacao">
                <Situacao b={b} />
              </span>
              <span className="linha-balcao__prazo miudo">
                <Prazo b={b} />
              </span>
              <Icone nome="avancar" tamanho={18} className="tr-icone linha-balcao__seta" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
