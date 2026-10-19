import type { BalcaoResumo, StatusItem } from '@trames/shared';
import { prazoRelativo, diasAte } from '../util/formatos';

const TEXTO: Record<StatusItem, string> = { aprovado: 'Aprovado', analise: 'Para conferir', pendente: 'Pendente', recusado: 'Recusado' };

export function Status({ status, texto }: { status: StatusItem | 'neutro'; texto?: string }) {
  return <span className={`status status--${status}`}>{texto ?? (status === 'neutro' ? '' : TEXTO[status])}</span>;
}

/** Situação do balcão em uma frase curta, com a cor certa. */
export function situacao(b: BalcaoResumo): { status: StatusItem | 'neutro'; texto: string } {
  const c = b.contagem;
  if (b.concluidoEm) return { status: 'neutro', texto: b.arquivadoEm ? 'Arquivado' : 'Concluído' };
  if (c.analise) return { status: 'analise', texto: `${c.analise} para conferir` };
  if (c.recusado) return { status: 'recusado', texto: `${c.recusado} ${c.recusado === 1 ? 'recusado' : 'recusados'}` };
  if (c.pendente) return { status: 'pendente', texto: 'Esperando o cliente' };
  return { status: 'aprovado', texto: 'Pronto para concluir' };
}

export function StatusBalcao({ b }: { b: BalcaoResumo }) {
  const s = situacao(b);
  return <Status status={s.status} texto={s.texto} />;
}

export function Barra({ parte, total, tom }: { parte: number; total: number; tom?: 'alerta' | 'cheia' }) {
  const p = total ? Math.min(100, Math.round((parte / total) * 100)) : 0;
  return (
    <div className={`barra${tom ? ` barra--${tom}` : ''}`} role="progressbar" aria-valuenow={parte} aria-valuemin={0} aria-valuemax={total}>
      <div className="barra__valor" style={{ '--p': `${p}%` } as React.CSSProperties} />
    </div>
  );
}

/** Prazo em texto curto, vermelho quando venceu. */
export function Prazo({ data, encerrado }: { data: string; encerrado?: boolean }) {
  const vencido = !encerrado && diasAte(data) < 0;
  return <span className={vencido ? 'perigo' : undefined}>{vencido ? `Venceu ${prazoRelativo(data)}` : prazoRelativo(data).replace(/^em /, '')}</span>;
}
