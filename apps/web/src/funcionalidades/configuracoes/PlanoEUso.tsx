import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ORDEM_PLANOS, PLANOS, type PlanoId } from '@trames/shared';
import { api } from '../../dados/api';
import { useCobranca, useSessao } from '../../dados/consultas';
import { AvisoErro, useToast } from '../../ui/comuns';
import { moeda, pct, plural } from '../../util/formatos';
import { COMPARACAO } from '../publico/Planos';

function Uso({ rotulo, usado, total, dica }: { rotulo: string; usado: number; total: number | null; dica?: string }) {
  const p = total ? pct(usado, total) : 0;
  return (
    <div className="uso">
      <div className="uso__topo">
        <span>{rotulo}</span>
        <span className="texto-suave">{total === null ? `${usado.toLocaleString('pt-BR')} · sem limite` : `${usado.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`}</span>
      </div>
      {total !== null && (
        <div className="tr-progresso__trilho">
          <div className="tr-progresso__barra" style={{ '--p': `${Math.min(p, 100)}%`, background: p >= 100 ? 'var(--recusado)' : p >= 90 ? 'var(--pendente)' : undefined } as React.CSSProperties} />
        </div>
      )}
      {dica && <span className="miudo texto-suave">{dica}</span>}
    </div>
  );
}

const precoDe = (id: PlanoId, anual: boolean) => {
  const p = PLANOS[id];
  if (!p.preco) return 'Grátis';
  return anual && p.precoAnual ? `R$ ${p.precoAnual.toLocaleString('pt-BR')} por ano` : `R$ ${p.preco} por mês`;
};

/** O plano do escritório, o uso do mês e a troca de plano. */
export function PlanoEUso() {
  const s = useSessao();
  const qc = useQueryClient();
  const uso = useCobranca().data;
  const { plano } = s;
  const admin = s.usuario.permissao === 'admin';
  const anual = s.periodicidade === 'anual';
  const [escolhido, setEscolhido] = useState<PlanoId | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [mudando, setMudando] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [toast, avisar] = useToast();

  async function mudar(id: PlanoId) {
    setErro(null);
    setMudando(true);
    try {
      await api('POST', '/cobranca/plano', { plano: id, periodicidade: id === 'gratis' ? 'mensal' : s.periodicidade });
      await qc.invalidateQueries();
      setEscolhido(null);
      avisar(`Pronto: a conta agora está no plano ${PLANOS[id].nome}.`);
    } catch (e) {
      setErro(e);
    } finally {
      setMudando(false);
    }
  }

  return (
    <>
      <section className="secao">
        <div className="secao__cabeca">
          <span className="miudo texto-suave" style={{ fontWeight: 500 }}>
            Plano atual
          </span>
          <div className="linha linha--entre">
            <h2 style={{ fontSize: 26, lineHeight: '32px' }}>{plano.nome}</h2>
            <span className="pequeno texto-suave">
              {precoDe(plano.id, anual)}
              {plano.preco > 0 && ` · ${anual ? 'anual' : 'mensal'}`}
            </span>
          </div>
          <p className="pequeno texto-suave">{plano.descricao}</p>
        </div>
        <div className="secao__corpo">
          {uso && (
            <div className="uso-grade">
              {plano.balcoesNoMes !== null ? (
                <Uso
                  rotulo="Balcões novos neste mês"
                  usado={uso.balcoesNoMes}
                  total={plano.balcoesNoMes}
                  dica={
                    uso.excedentes
                      ? `${plural(uso.excedentes, 'balcão adicional', 'balcões adicionais')} neste mês: ${moeda(uso.valorExcedentesCentavos)} na próxima fatura${anual ? ', à parte do plano anual' : ''}.`
                      : 'Depois do limite, você continua criando; cada balcão a mais entra na fatura seguinte.'
                  }
                />
              ) : (
                <Uso rotulo="Balcões ativos" usado={uso.balcoesAtivos} total={plano.limiteBalcoes} dica="Balcões concluídos não contam." />
              )}
              {plano.cotaWhatsapp > 0 && <Uso rotulo="Mensagens de WhatsApp neste mês" usado={uso.whatsappEnviados} total={plano.cotaWhatsapp} dica="Quando acaba, códigos e lembretes vão por e-mail até o mês virar." />}
              <Uso rotulo="Pessoas na conta" usado={uso.pessoas} total={plano.limitePessoas} />
            </div>
          )}
        </div>
      </section>

      <section className="secao">
        <div className="secao__cabeca">
          <h2>Mudar de plano</h2>
          <p className="pequeno texto-suave">Todos os planos têm o mesmo balcão e o mesmo cuidado com os arquivos. Muda quantos clientes você atende ao mesmo tempo e o que dá para personalizar.</p>
        </div>
        <div className="secao__corpo">
          <AvisoErro erro={erro} />
          <div className="planos-mini">
            {ORDEM_PLANOS.map((id) => {
              const p = PLANOS[id];
              const atual = id === plano.id;
              return (
                <div key={id} className={`plano-mini${atual ? ' plano-mini--atual' : ''}`}>
                  <div className="coluna" style={{ gap: 2 }}>
                    <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{p.nome}</strong>
                    <span className="pequeno texto-suave">{precoDe(id, anual)}</span>
                  </div>
                  <ul>
                    {p.destaques.slice(0, 4).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  {atual ? (
                    <span className="tr-btn tr-btn--sm" style={{ background: 'var(--mangue-suave)', color: 'var(--mangue)', cursor: 'default' }}>
                      Seu plano
                    </span>
                  ) : escolhido === id ? (
                    <div className="coluna" style={{ gap: 6 }}>
                      <span className="miudo">Mudar para o {p.nome}?</span>
                      <div className="linha" style={{ gap: 6 }}>
                        <button type="button" className="tr-btn tr-btn--primario tr-btn--sm" style={{ flex: 1 }} disabled={mudando} onClick={() => mudar(id)}>
                          {mudando ? 'Mudando…' : 'Confirmar'}
                        </button>
                        <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => setEscolhido(null)}>
                          Voltar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" disabled={!admin} onClick={() => setEscolhido(id)}>
                      {ORDEM_PLANOS.indexOf(id) > ORDEM_PLANOS.indexOf(plano.id) ? `Passar para o ${p.nome}` : `Voltar para o ${p.nome}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {uso?.trocaSimulada && <p className="miudo texto-suave">Em desenvolvimento, a troca é simulada e não gera cobrança.</p>}
        </div>
        <div className="secao__rodape">
          <span className="miudo texto-suave">{admin ? 'Pode mudar quando quiser.' : 'Só quem administra a conta muda o plano.'}</span>
          <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" aria-expanded={comparando} onClick={() => setComparando(!comparando)}>
            {comparando ? 'Esconder a comparação' : 'Comparar tudo'}
          </button>
        </div>
        {comparando && (
          <div className="comparacao">
            <table className="tabela">
              <thead>
                <tr>
                  <th />
                  {ORDEM_PLANOS.map((id) => (
                    <th key={id} className={id === plano.id ? 'comparacao__atual' : undefined}>
                      {PLANOS[id].nome}
                      {id === plano.id && <span className="miudo"> · seu plano</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARACAO.map((l) => (
                  <tr key={l.rotulo}>
                    <td className="texto-suave">{l.rotulo}</td>
                    {l.valores.map((v, k) => (
                      <td key={k} className={ORDEM_PLANOS[k] === plano.id ? 'comparacao__atual' : undefined} style={v === 'Não' ? { color: 'var(--tinta-suave)' } : undefined}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {toast}
    </>
  );
}
