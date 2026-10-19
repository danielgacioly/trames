import { useHistorico } from '../../../dados/consultas';
import { AvisoErro, Carregando } from '../../../ui';
import { dataHora } from '../../../util/formatos';
import { ACOES } from './acoes';

/** Tudo o que aconteceu no balcão, do mais novo para o mais antigo (vem da auditoria, que não se apaga). */
export function Historico({ id }: { id: string }) {
  const consulta = useHistorico(id, true);
  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  const eventos = consulta.data;
  if (!eventos.length) return <div className="grupo grupo--vazio">Nada registrado ainda.</div>;
  return (
    <div className="grupo" style={{ maxWidth: 760 }}>
      {eventos.map((e) => (
        <div key={e.id} className="linha">
          <span className="linha__corpo">
            <span>
              <span style={{ fontWeight: 500 }}>{e.ator}</span> {ACOES[e.acao] ?? e.acao}
            </span>
            <span className="linha__sub">
              {dataHora(e.criadoEm)}
              {e.ip && (
                <>
                  {' · '}
                  <span className="mono">{e.ip}</span>
                </>
              )}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
