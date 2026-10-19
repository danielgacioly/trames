import { useState, type FormEvent } from 'react';
import { diasRetencao, NOMES_AREA } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useSessao } from '../../dados/consultas';
import { AvisoErro, Bloqueio, SeloConta, useToast } from '../../ui/comuns';

const CORES = ['#13594b', '#8a5330', '#1c5d84', '#a9361b', '#865600', '#2e241b'];

/** O escritório: nome, marca que o cliente vê e por quanto tempo os arquivos ficam guardados. Só quem administra muda. */
export function Escritorio() {
  const s = useSessao();
  const { organizacao: o, plano } = s;
  const [f, setF] = useState({ nome: o.nome, sigla: o.sigla, cor: o.cor, diasRetencao: o.diasRetencao });
  const [toast, avisar] = useToast();
  const salvar = useAcao((corpo: typeof f) => api('PUT', '/organizacao', corpo), [chaves.eu]);
  const marca = s.tem('marca');
  const admin = s.usuario.permissao === 'admin';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await salvar.mutateAsync({ ...f, sigla: f.sigla.toUpperCase().slice(0, 2), diasRetencao: diasRetencao(plano.id, f.diasRetencao) });
    avisar('Alterações salvas.');
  }

  return (
    <form onSubmit={enviar} style={{ display: 'contents' }}>
      <fieldset disabled={!admin} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <section className="secao">
          <div className="secao__cabeca">
            <h2>Escritório</h2>
            <p className="pequeno texto-suave">{admin ? 'Aparece para o cliente no balcão e nos e-mails.' : 'Só quem administra a conta pode mudar estes dados.'}</p>
          </div>
          <div className="secao__corpo">
            <AvisoErro erro={salvar.error} />
            <div className="campos-2">
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">Nome do escritório ou da clínica</span>
                <input className="tr-campo__entrada" required minLength={2} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
              </label>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">Área</span>
                <input className="tr-campo__entrada" value={NOMES_AREA[o.area]} disabled />
                <span className="tr-campo__dica">Define os modelos prontos que aparecem primeiro.</span>
              </label>
            </div>
          </div>
        </section>

        <section className="secao">
          <div className="secao__cabeca">
            <h2>Marca no balcão</h2>
            <p className="pequeno texto-suave">A sigla e a cor aparecem no topo da página do cliente.</p>
          </div>
          <div className="secao__corpo">
            {marca ? (
              <>
                <div className="linha" style={{ gap: 24, alignItems: 'flex-end' }}>
                  <label className="tr-campo" style={{ maxWidth: 120 }}>
                    <span className="tr-campo__rotulo">Sigla</span>
                    <input className="tr-campo__entrada" maxLength={2} value={f.sigla} onChange={(e) => setF({ ...f, sigla: e.target.value.toUpperCase() })} />
                  </label>
                  <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <legend className="tr-campo__rotulo" style={{ marginBottom: 8 }}>
                      Cor
                    </legend>
                    <div className="linha">
                      {CORES.map((cor) => (
                        <button key={cor} type="button" className="amostra" aria-label={`Cor ${cor}`} role="radio" aria-checked={f.cor === cor} onClick={() => setF({ ...f, cor })} style={{ width: 32, height: 32, background: cor }} />
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="aviso" style={{ alignItems: 'center' }}>
                  <SeloConta conta={f} />
                  <span>
                    <strong style={{ fontWeight: 500 }}>{f.nome}</strong> · assim aparece no topo do balcão do cliente.
                  </span>
                </div>
              </>
            ) : (
              <Bloqueio recurso="marca" compacto />
            )}
          </div>
        </section>

        <section className="secao">
          <div className="secao__cabeca">
            <h2>Guarda dos arquivos</h2>
            <p className="pequeno texto-suave">Depois de concluído o balcão, os arquivos saem do armazenamento; fica só o registro de que existiram. Uma semana antes, você recebe um e-mail.</p>
          </div>
          <div className="secao__corpo">
            {plano.retencao.opcoes.length > 1 ? (
              <label className="tr-campo" style={{ maxWidth: 300 }}>
                <span className="tr-campo__rotulo">Apagar os arquivos depois de</span>
                <select className="tr-campo__entrada" value={diasRetencao(plano.id, f.diasRetencao)} onChange={(e) => setF({ ...f, diasRetencao: Number(e.target.value) })}>
                  {plano.retencao.opcoes.map((d) => (
                    <option key={d} value={d}>
                      {d < 365 ? `${d} dias` : '12 meses'}
                    </option>
                  ))}
                </select>
                <span className="tr-campo__dica">Vale para os balcões concluídos daqui em diante.</span>
              </label>
            ) : (
              <p className="pequeno">
                No plano {plano.nome}, os arquivos ficam guardados por <strong style={{ fontWeight: 500 }}>{plano.retencao.padrao} dias</strong> depois de concluído o balcão. No Ultra, dá para escolher de 30 dias a 12 meses.
              </p>
            )}
          </div>
        </section>

        {admin && (
          <div className="linha" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="tr-btn tr-btn--primario" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </fieldset>
      {toast}
    </form>
  );
}
