import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ORDEM_PLANOS, PLANOS } from '@trames/shared';
import { useEu } from '../../dados/consultas';
import { CabecalhoSite, RodapeSite } from './Site';
import { Icone } from '../../ui/Icone';

const COMPARACAO: { rotulo: string; valores: [string, string, string] }[] = [
  { rotulo: 'Balcões', valores: ['3 ativos', '40 ativos', '200 novos por mês; depois, R$ 1,00 cada'] },
  { rotulo: 'Pessoas na conta', valores: ['1', 'Até 3', 'Ilimitadas'] },
  { rotulo: 'Arquivos guardados depois de concluir', valores: ['30 dias', '90 dias', '90 dias (de 30 dias a 12 meses)'] },
  { rotulo: 'Código de acesso do cliente', valores: ['E-mail', 'E-mail ou WhatsApp', 'E-mail ou WhatsApp'] },
  { rotulo: 'Lembretes automáticos por e-mail', valores: ['Sim', 'Sim', 'Sim'] },
  { rotulo: 'Lembretes automáticos por WhatsApp', valores: ['Não', 'Até 300 mensagens/mês', 'Até 1.500 mensagens/mês'] },
  { rotulo: 'Modelos prontos da sua área', valores: ['Sim', 'Sim', 'Sim'] },
  { rotulo: 'Seus próprios modelos', valores: ['Não', 'Ilimitados', 'Ilimitados'] },
  { rotulo: 'Logo do escritório no balcão', valores: ['Não', 'Sim', 'Sim'] },
  { rotulo: 'Permissões por pessoa e relatórios', valores: ['Não', 'Não', 'Sim'] },
];

export function Planos() {
  const eu = useEu().data;
  const sessao = eu?.etapa === 'completa' ? eu : null;
  const navegar = useNavigate();
  const atual = sessao?.plano;
  const [anual, setAnual] = useState(sessao?.periodicidade === 'anual');
  const periodicidade = (id: string) => (anual && id !== 'gratis' ? 'anual' : 'mensal');

  /** Com conta, a troca acontece em Configurações › Plano e uso; sem conta, começa pelo cadastro. */
  function escolher(id: (typeof ORDEM_PLANOS)[number]) {
    if (!sessao) return navegar('/criar-conta', { state: { plano: id } });
    navegar('/app/configuracoes/plano');
  }

  return (
    <div>
      <CabecalhoSite atual="planos" />
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20 }}>
        <h1 style={{ fontSize: 'clamp(40px, 5vw, 60px)', lineHeight: 1.05, letterSpacing: '-.03em' }}>Planos</h1>
        <p style={{ maxWidth: 640, fontSize: 20, lineHeight: '30px' }} className="texto-suave">
          Todos os planos têm o mesmo balcão, o mesmo link para o cliente e o mesmo cuidado com os arquivos. O que muda é quantos clientes você atende ao mesmo tempo.
        </p>
        <div role="group" aria-label="Forma de pagamento" className="linha" style={{ gap: 0, border: '1px solid var(--linha-forte)', borderRadius: 9999, padding: 4 }}>
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={anual === v}
              onClick={() => setAnual(v)}
              className="tr-btn tr-btn--sm"
              style={{ borderRadius: 9999, border: 0, background: anual === v ? 'var(--mangue)' : 'transparent', color: anual === v ? 'var(--sobre-mangue)' : 'var(--tinta)' }}
            >
              {v ? 'Anual (2 meses grátis)' : 'Mensal'}
            </button>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 64px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 24 }}>
        {ORDEM_PLANOS.map((id) => {
          const p = PLANOS[id];
          const destaque = id === 'pro';
          const eAtual = atual === id && (id === 'gratis' || sessao?.periodicidade === periodicidade(id));
          return (
            <div
              key={id}
              style={{
                background: 'var(--areia-elevada)',
                border: destaque || eAtual ? '2px solid var(--mangue)' : '1px solid var(--linha)',
                borderRadius: 14,
                padding: destaque || eAtual ? 31 : 32,
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                position: 'relative',
              }}
            >
              {(destaque || eAtual) && (
                <span style={{ position: 'absolute', top: -14, left: 31, padding: '4px 12px', borderRadius: 9999, background: 'var(--mangue)', color: 'var(--sobre-mangue)', fontSize: 12, lineHeight: '16px', fontWeight: 500 }}>
                  {eAtual ? 'Seu plano' : 'Recomendado'}
                </span>
              )}
              <div className="coluna">
                <h2 style={{ fontSize: 24, lineHeight: '30px' }}>{p.nome}</h2>
                <p className="texto-suave">{p.descricao}</p>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, lineHeight: '52px', fontWeight: 600, letterSpacing: '-.02em' }}>
                R$ {anual && p.precoAnual ? p.precoAnual.toLocaleString('pt-BR') : p.preco}
                {p.preco > 0 && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, letterSpacing: 0, color: 'var(--tinta-suave)' }}>{anual ? ' por ano' : ' por mês'}</span>}
                {anual && p.precoAnual && (
                  <span className="miudo texto-suave" style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 400, letterSpacing: 0 }}>
                    Pago de uma vez. Equivale a R$ {(p.precoAnual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por mês.
                  </span>
                )}
              </div>
              {eAtual ? (
                <button type="button" className="tr-btn tr-btn--secundario tr-btn--bloco" disabled>
                  Plano atual
                </button>
              ) : (
                <button type="button" onClick={() => escolher(id)} className={`tr-btn tr-btn--bloco ${destaque ? 'tr-btn--primario' : 'tr-btn--secundario'}`}>
                  {sessao ? `Mudar para o ${p.nome}` : id === 'gratis' ? 'Criar conta grátis' : `Assinar o ${p.nome}`}
                </button>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 15, lineHeight: '22px' }}>
                {p.destaques.map((d, k) => (
                  <li key={d} style={{ display: 'flex', gap: 10 }}>
                    <Icone nome="check" tamanho={20} />
                    {k === 0 ? <strong style={{ fontWeight: 600 }}>{d}</strong> : d}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <p style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px', textAlign: 'center', fontSize: 15 }} className="texto-suave">
        No Grátis e no Pro, balcões concluídos não contam no limite. No Ultra, o que conta são os balcões novos do mês, e não há bloqueio. Você pode trocar de plano ou cancelar quando quiser.
      </p>

      <section style={{ background: 'var(--areia-funda)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '88px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <h2 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>Comparar os planos</h2>
          <div className="tabela-caixa">
            <table className="tabela">
              <thead>
                <tr>
                  <th />
                  {ORDEM_PLANOS.map((id) => (
                    <th key={id} style={{ color: 'var(--tinta)', fontWeight: 600, fontSize: 15 }}>
                      {PLANOS[id].nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARACAO.map((l) => (
                  <tr key={l.rotulo}>
                    <td>{l.rotulo}</td>
                    {l.valores.map((v, k) => (
                      <td key={k} style={v === 'Não' ? { color: 'var(--tinta-suave)' } : undefined}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 800, margin: '0 auto', padding: '88px 24px 112px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em', marginBottom: 8 }}>Sobre cobrança</h2>
        {[
          ['O que acontece quando chego no limite de balcões?', 'No Grátis e no Pro, os balcões abertos continuam funcionando normalmente. Para abrir um novo, você conclui um que já terminou ou muda de plano.'],
          ['E no Ultra, se eu passar dos 200 balcões do mês?', 'Nada é bloqueado. Cada balcão novo além dos 200 do mês custa R$ 1,00 e entra na próxima fatura. Você recebe um aviso ao chegar em 180 e outro ao passar de 200. No plano anual, o excedente é cobrado mês a mês, à parte.'],
          ['E quando a cota de WhatsApp acaba?', 'Códigos e lembretes passam a ir por e-mail até o mês virar, e quem administra a conta recebe um aviso.'],
          ['Como posso pagar?', 'Por Pix ou cartão. No mensal, todo mês; no anual, de uma vez, com 2 meses grátis. A nota fiscal chega no seu e-mail.'],
          ['Meu cliente paga alguma coisa?', 'Não. Quem abre o balcão é que tem a conta. Para o cliente, enviar documentos é sempre de graça.'],
        ].map(([p, r]) => (
          <details key={p} style={{ borderBottom: '1px solid var(--linha)', paddingBottom: 20 }}>
            <summary style={{ fontSize: 18, lineHeight: '26px', fontWeight: 500 }}>{p}</summary>
            <p style={{ marginTop: 12 }} className="texto-suave">
              {r}
            </p>
          </details>
        ))}
      </section>

      <RodapeSite />
    </div>
  );
}
