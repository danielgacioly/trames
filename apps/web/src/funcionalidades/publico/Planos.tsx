import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ORDEM_PLANOS, PLANOS, type PlanoId } from '@trames/shared';
import { api } from '../../dados/api';
import { useEu } from '../../dados/consultas';
import { AvisoErro, Botao, BotaoLink, Icone, Logo, Segmentado, useDialogos, useNotificar } from '../../ui';

const COMPARACAO: { rotulo: string; valores: [string, string, string] }[] = [
  { rotulo: 'Balcões', valores: ['3 ativos', '40 ativos', '200 novos por mês; depois, R$ 1,00 cada'] },
  { rotulo: 'Pessoas na conta', valores: ['1', 'Até 3', 'Ilimitadas'] },
  { rotulo: 'Arquivos guardados depois de concluir', valores: ['30 dias', '90 dias', 'De 30 dias a 12 meses'] },
  { rotulo: 'Código de acesso do cliente', valores: ['E-mail', 'E-mail ou WhatsApp', 'E-mail ou WhatsApp'] },
  { rotulo: 'Lembretes por e-mail', valores: ['Sim', 'Sim', 'Sim'] },
  { rotulo: 'Lembretes por WhatsApp', valores: ['—', '300 mensagens/mês', '1.500 mensagens/mês'] },
  { rotulo: 'Modelos prontos da sua área', valores: ['Sim', 'Sim', 'Sim'] },
  { rotulo: 'Seus próprios modelos', valores: ['—', 'Ilimitados', 'Ilimitados'] },
  { rotulo: 'Marca do escritório no balcão', valores: ['—', 'Sim', 'Sim'] },
  { rotulo: 'Permissões por pessoa e relatório', valores: ['—', '—', 'Sim'] },
];

const PERGUNTAS = [
  ['O que acontece quando chego no limite de balcões?', 'No Grátis e no Pro, os balcões abertos continuam funcionando. Para abrir um novo, conclua um que já terminou ou mude de plano.'],
  ['E no Ultra, se eu passar dos 200 balcões do mês?', 'Nada é bloqueado. Cada balcão novo além dos 200 custa R$ 1,00 e entra na próxima fatura. Você recebe um aviso ao chegar em 180 e outro ao passar de 200. No plano anual, o excedente é cobrado mês a mês, à parte.'],
  ['E quando a cota de WhatsApp acaba?', 'Códigos e lembretes passam a ir por e-mail até o mês virar, e quem administra a conta recebe um aviso.'],
  ['Como posso pagar?', 'Por Pix ou cartão. No mensal, todo mês; no anual, de uma vez, com 2 meses grátis. A nota fiscal chega no seu e-mail.'],
  ['Meu cliente paga alguma coisa?', 'Não. Quem abre o balcão é que tem a conta. Para o cliente, enviar documentos é sempre de graça.'],
];

const reais = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function Planos() {
  const eu = useEu().data;
  const sessao = eu?.etapa === 'completa' ? eu : null;
  const qc = useQueryClient();
  const navegar = useNavigate();
  const { confirmar } = useDialogos();
  const notificar = useNotificar();
  const [erro, setErro] = useState<unknown>(null);
  const [anual, setAnual] = useState(sessao?.periodicidade === 'anual');
  const periodicidade = (id: PlanoId) => (anual && id !== 'gratis' ? 'anual' : 'mensal');

  async function escolher(id: PlanoId) {
    if (!sessao) return navegar('/criar-conta');
    const p = PLANOS[id];
    const per = periodicidade(id);
    const ok = await confirmar({
      titulo: `Mudar para o ${p.nome} ${per}?`,
      texto: `A conta ${sessao.organizacao.nome} passa para o plano ${p.nome} agora. Em desenvolvimento, a troca é simulada, sem cobrança.`,
      confirmar: 'Mudar de plano',
    });
    if (!ok) return;
    try {
      await api('POST', '/cobranca/plano', { plano: id, periodicidade: per });
      await qc.invalidateQueries();
      notificar({ titulo: `Plano ${p.nome} ativado` });
      navegar('/app/conta/plano');
    } catch (e) {
      setErro(e);
    }
  }

  return (
    <div className="ui">
      <header className="site-topo">
        <Logo altura={24} para="/" />
        <nav aria-label="Site">
          <a href="/#como-funciona">Como funciona</a>
          <a href="/#para-quem">Para quem é</a>
          <Link to="/planos" aria-current="page" style={{ color: 'var(--acento)', fontWeight: 500 }}>
            Planos
          </Link>
        </nav>
        <div className="fila">
          {sessao ? (
            <BotaoLink to="/app" variante="primario">
              Voltar para a conta
            </BotaoLink>
          ) : (
            <>
              <BotaoLink to="/entrar" variante="simples">
                Entrar
              </BotaoLink>
              <BotaoLink to="/criar-conta" variante="primario">
                Criar conta grátis
              </BotaoLink>
            </>
          )}
        </div>
      </header>

      <main className="pagina" style={{ gap: 40 }}>
        <section className="pilha" style={{ alignItems: 'center', textAlign: 'center', gap: 14, paddingTop: 32 }}>
          <h1 style={{ fontSize: 44, lineHeight: '50px', fontWeight: 700, letterSpacing: '-0.03em' }}>Planos</h1>
          <p className="secundario" style={{ fontSize: 17, lineHeight: '25px', maxWidth: 600 }}>
            O mesmo balcão, o mesmo link para o cliente e o mesmo cuidado com os arquivos em todos os planos. Muda quantos clientes você atende ao mesmo tempo.
          </p>
          <Segmentado
            rotulo="Forma de pagamento"
            valor={anual ? 'anual' : 'mensal'}
            mudar={(v) => setAnual(v === 'anual')}
            opcoes={[
              { id: 'mensal', rotulo: 'Mensal' },
              { id: 'anual', rotulo: 'Anual · 2 meses grátis' },
            ]}
          />
        </section>

        <AvisoErro erro={erro} />

        <section className="planos">
          {ORDEM_PLANOS.map((id) => {
            const p = PLANOS[id];
            const eAtual = sessao?.plano === id && (id === 'gratis' || sessao.periodicidade === periodicidade(id));
            const comAnual = anual && p.precoAnual;
            return (
              <article key={id} className={`plano${id === 'pro' && !sessao ? ' plano--destaque' : ''}${eAtual ? ' plano--destaque' : ''}`}>
                <div className="pilha" style={{ gap: 4 }}>
                  <div className="fila fila--entre">
                    <h2 className="titulo">{p.nome}</h2>
                    {eAtual ? <span className="etiqueta">Seu plano</span> : id === 'pro' && !sessao && <span className="etiqueta">Recomendado</span>}
                  </div>
                  <p className="secundario">{p.descricao}</p>
                </div>
                <div>
                  <span className="plano__preco">R$ {comAnual ? reais(p.precoAnual!) : p.preco}</span>
                  {p.preco > 0 && <span className="secundario"> {comAnual ? 'por ano' : 'por mês'}</span>}
                  <p className="pequeno terciario" style={{ minHeight: 16 }}>
                    {comAnual ? `Pago de uma vez. Equivale a R$ ${(p.precoAnual! / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por mês.` : p.preco === 0 ? 'Para sempre.' : ''}
                  </p>
                </div>
                {eAtual ? (
                  <Botao grande bloco disabled>
                    Plano atual
                  </Botao>
                ) : (
                  <Botao grande bloco variante={id === 'pro' ? 'primario' : 'padrao'} onClick={() => escolher(id)}>
                    {sessao ? `Mudar para o ${p.nome}` : id === 'gratis' ? 'Criar conta grátis' : `Assinar o ${p.nome}`}
                  </Botao>
                )}
                <ul>
                  {p.destaques.map((d) => (
                    <li key={d}>
                      <Icone nome="check" />
                      {d}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>
        <p className="pequeno secundario" style={{ textAlign: 'center', marginTop: -20 }}>
          No Grátis e no Pro, balcões concluídos não contam no limite. No Ultra, contam os balcões novos do mês, sem bloqueio. Troque de plano ou cancele quando quiser.
        </p>

        <section className="secao">
          <div className="secao__cabeca">
            <h2 className="titulo">Comparar os planos</h2>
          </div>
          <div className="tabela-caixa">
            <table className="tabela">
              <thead>
                <tr>
                  <th />
                  {ORDEM_PLANOS.map((id) => (
                    <th key={id}>{PLANOS[id].nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARACAO.map((l) => (
                  <tr key={l.rotulo}>
                    <td>{l.rotulo}</td>
                    {l.valores.map((v, k) => (
                      <td key={k} className={v === '—' ? 'terciario' : undefined}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="secao" style={{ maxWidth: 760, width: '100%', margin: '0 auto' }}>
          <div className="secao__cabeca">
            <h2 className="titulo">Sobre cobrança</h2>
          </div>
          <div className="grupo">
            {PERGUNTAS.map(([p, r]) => (
              <details key={p} className="pergunta">
                <summary className="linha">
                  <span className="linha__corpo">{p}</span>
                  <Icone nome="avancar" className="icone linha__seta" />
                </summary>
                <p className="secundario">{r}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="fila fila--entre pequeno secundario" style={{ borderTop: '0.5px solid var(--separador)', paddingTop: 20 }}>
          <span className="fila">
            <Logo altura={18} /> Feito no Recife
          </span>
          <nav className="fila" style={{ gap: 18 }}>
            <a href="#">Termos</a>
            <a href="#">Privacidade</a>
            <a href="#">Contato</a>
          </nav>
        </footer>
      </main>
    </div>
  );
}
