import { useState, type FormEvent, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ORDEM_PLANOS, PLANOS } from '../dados/planos';
import { CONTAS_TESTE, SENHA_TESTE } from '../dados/seed';
import { acoes, useSessao } from '../dados/store';
import type { AreaId } from '../dados/tipos';
import { Logo } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import htmlLanding from '../landing/landing.html?raw';
import '../landing/landing.css';

/** Links internos da landing (HTML estático do protótipo) passam pelo roteador. */
function useLinksInternos() {
  const navegar = useNavigate();
  return (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (!href || !href.startsWith('/') || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    navegar(href);
    window.scrollTo(0, 0);
  };
}

export function Landing() {
  const aoClicar = useLinksInternos();
  return <div onClick={aoClicar} dangerouslySetInnerHTML={{ __html: htmlLanding }} />;
}

function CabecalhoSite() {
  const sessao = useSessao();
  return (
    <header style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <Logo altura={34} para="/" />
      <nav style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28, fontSize: 15 }}>
        <a href="/#como-funciona" style={{ color: 'var(--tinta)', textDecoration: 'none' }}>
          Como funciona
        </a>
        <a href="/#para-quem" style={{ color: 'var(--tinta)', textDecoration: 'none' }}>
          Para quem é
        </a>
        <Link to="/planos" style={{ color: 'var(--mangue)', textDecoration: 'none', fontWeight: 500 }} aria-current="page">
          Planos
        </Link>
      </nav>
      <div className="linha">
        {sessao ? (
          <Link to="/app" className="tr-btn tr-btn--primario">
            Voltar para a conta
          </Link>
        ) : (
          <>
            <Link to="/entrar" className="tr-btn tr-btn--discreto">
              Entrar
            </Link>
            <Link to="/criar-conta" className="tr-btn tr-btn--primario">
              Criar conta grátis
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

const COMPARACAO: { rotulo: string; valores: [string, string, string] }[] = [
  { rotulo: 'Balcões ativos', valores: ['3', '40', 'Ilimitados'] },
  { rotulo: 'Modelos prontos da sua área', valores: ['Sim', 'Sim', 'Sim'] },
  { rotulo: 'Seus próprios modelos', valores: ['Não', 'Sem limite', 'Sem limite'] },
  { rotulo: 'Turu', valores: ['Não', 'Sim', 'Sim'] },
  { rotulo: 'Lembretes automáticos', valores: ['Não', 'Sim', 'Sim'] },
  { rotulo: 'Sua marca no balcão', valores: ['Não', 'Sim', 'Sim'] },
  { rotulo: 'Pessoas na conta', valores: ['1', '3', 'Ilimitadas'] },
  { rotulo: 'Permissões por pessoa', valores: ['Não', 'Não', 'Sim'] },
  { rotulo: 'Relatório de prazos e pendências', valores: ['Não', 'Não', 'Sim'] },
];

export function Planos() {
  const sessao = useSessao();
  const navegar = useNavigate();
  const atual = sessao?.plano.id;

  function escolher(id: (typeof ORDEM_PLANOS)[number]) {
    if (!sessao) return navegar('/criar-conta');
    const p = PLANOS[id];
    const ok = window.confirm(`Mudar a conta ${sessao.conta.nome} para o plano ${p.nome}? (No protótipo não há cobrança.)`);
    if (ok) {
      acoes.mudarPlano(sessao.conta.id, id);
      navegar('/app');
    }
  }

  return (
    <div>
      <CabecalhoSite />
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20 }}>
        <h1 style={{ fontSize: 'clamp(40px, 5vw, 60px)', lineHeight: 1.05, letterSpacing: '-.03em' }}>Planos</h1>
        <p style={{ maxWidth: 640, fontSize: 20, lineHeight: '30px' }} className="texto-suave">
          Todos os planos têm o mesmo balcão, o mesmo link para o cliente e o mesmo cuidado com os arquivos. O que muda é quantos clientes você atende ao mesmo tempo.
        </p>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 64px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 24 }}>
        {ORDEM_PLANOS.map((id) => {
          const p = PLANOS[id];
          const destaque = id === 'pro';
          const eAtual = atual === id;
          return (
            <div
              key={id}
              style={{
                background: 'var(--areia-elevada)',
                border: destaque || eAtual ? '2px solid var(--mangue)' : '1px solid var(--linha)',
                borderRadius: 20,
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
                R$ {p.preco}
                {p.preco > 0 && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, letterSpacing: 0, color: 'var(--tinta-suave)' }}> por mês</span>}
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
        Balcões concluídos não contam no limite. Você pode trocar de plano ou cancelar quando quiser.
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
          ['O que acontece quando chego no limite de balcões?', 'Os balcões abertos continuam funcionando normalmente. Para abrir um novo, você conclui um que já terminou ou muda de plano.'],
          ['Como posso pagar?', 'Por cartão de crédito ou Pix, todo mês. A nota fiscal chega no seu e-mail.'],
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

      <footer style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 56px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24, fontSize: 14, borderTop: '1px solid var(--linha)' }} className="texto-suave">
        <div className="linha" style={{ gap: 16 }}>
          <Logo altura={26} />
          <span>Feito no Recife</span>
        </div>
        <nav className="linha" style={{ gap: 24 }}>
          <a href="#" style={{ color: 'var(--tinta-suave)' }}>Termos</a>
          <a href="#" style={{ color: 'var(--tinta-suave)' }}>Privacidade</a>
          <a href="#" style={{ color: 'var(--tinta-suave)' }}>Contato</a>
        </nav>
      </footer>
    </div>
  );
}

function ArteEntrar() {
  return (
    <div className="dividida__arte" style={{ background: 'var(--lama)' }} aria-hidden="true">
      <svg viewBox="0 0 640 900" preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect x="64" y="520" width="120" height="420" rx="60" style={{ fill: 'var(--areia)' }} />
        <rect x="216" y="420" width="120" height="520" rx="60" style={{ fill: 'var(--mangue)' }} />
        <rect x="368" y="560" width="120" height="380" rx="60" style={{ fill: 'var(--areia)' }} />
        <rect x="520" y="640" width="120" height="300" rx="60" style={{ fill: 'var(--raiz)' }} />
        <rect x="64" y="96" width="260" height="56" rx="28" style={{ fill: 'var(--broto)' }} />
      </svg>
    </div>
  );
}

export function Entrar() {
  const navegar = useNavigate();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  function entrar(e?: FormEvent, em = email, se = senha) {
    e?.preventDefault();
    if (acoes.entrar(em, se)) {
      navegar((local.state as { de?: string } | null)?.de ?? '/app');
    } else {
      setErro('E-mail ou senha não conferem.');
    }
  }

  return (
    <div className="dividida">
      <div className="dividida__form">
        <Logo altura={32} para="/" />
        <form className="formulario" style={{ maxWidth: 380 }} onSubmit={entrar}>
          <div className="coluna">
            <h1 style={{ fontSize: 36, lineHeight: '40px', letterSpacing: '-.02em' }}>Entrar na Trames</h1>
            <p className="texto-suave">Bom te ver de novo.</p>
          </div>
          <label className="tr-campo tr-campo--largo">
            <span className="tr-campo__rotulo">E-mail</span>
            <input className="tr-campo__entrada" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className={`tr-campo tr-campo--largo${erro ? ' tr-campo--erro' : ''}`}>
            <span className="tr-campo__rotulo">Senha</span>
            <input className="tr-campo__entrada" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            {erro && (
              <span className="tr-campo__erro">
                <Icone nome="info" />
                {erro}
              </span>
            )}
          </label>
          <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 48 }}>
            Entrar
          </button>
          <div className="linha linha--entre pequeno" style={{ gap: 12 }}>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Esqueci a senha
            </a>
            <span className="texto-suave">
              Ainda não tem conta? <Link to="/criar-conta">Criar conta grátis</Link>
            </span>
          </div>

          <div className="cartao cartao--fundo" style={{ padding: 16, gap: 10 }}>
            <div className="linha linha--entre">
              <span className="miudo" style={{ fontWeight: 500 }}>Contas de teste</span>
              <span className="miudo texto-suave">
                senha <code className="tr-protocolo">{SENHA_TESTE}</code>
              </span>
            </div>
            {CONTAS_TESTE.map((c) => (
              <button
                key={c.email}
                type="button"
                className="tr-btn tr-btn--secundario tr-btn--bloco"
                style={{ height: 'auto', padding: '10px 14px', justifyContent: 'space-between', textAlign: 'left' }}
                onClick={() => {
                  setEmail(c.email);
                  setSenha(SENHA_TESTE);
                  entrar(undefined, c.email, SENHA_TESTE);
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Entrar como {c.plano}</span>
                  <span className="miudo texto-suave" style={{ fontWeight: 400 }}>
                    {c.email} · {c.quem}
                  </span>
                </span>
                <Icone nome="seta" />
              </button>
            ))}
            <button
              type="button"
              className="tr-btn tr-btn--discreto tr-btn--sm"
              style={{ alignSelf: 'flex-start', paddingLeft: 4 }}
              onClick={() => {
                if (window.confirm('Apagar tudo o que foi feito neste navegador e voltar aos dados de teste?')) acoes.restaurar();
              }}
            >
              Restaurar dados de teste
            </button>
          </div>
        </form>
      </div>
      <ArteEntrar />
    </div>
  );
}

function ArteCriarConta() {
  return (
    <div className="dividida__arte" style={{ background: 'var(--mangue)', display: 'flex', flexDirection: 'column', padding: '56px 48px' }}>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--sobre-mangue)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: '34px', fontWeight: 600, letterSpacing: '-.01em' }}>
          No plano grátis você já pode abrir 3 balcões e mandar o link para os seus clientes.
        </p>
        <p style={{ color: '#d9ece4' }}>Não pedimos cartão. Se um dia precisar de mais, você muda de plano por dentro da conta.</p>
      </div>
      <svg viewBox="0 0 600 420" preserveAspectRatio="xMidYMax meet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '55%' }} aria-hidden="true">
        <rect x="40" y="200" width="110" height="260" rx="55" style={{ fill: 'var(--areia)' }} />
        <rect x="180" y="120" width="110" height="340" rx="55" style={{ fill: 'var(--lama)' }} />
        <rect x="320" y="220" width="110" height="240" rx="55" style={{ fill: 'var(--broto)' }} />
        <rect x="460" y="280" width="110" height="180" rx="55" style={{ fill: 'var(--raiz)' }} />
      </svg>
    </div>
  );
}

export function CriarConta() {
  const navegar = useNavigate();
  const [f, setF] = useState({ nome: '', escritorio: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (f.senha.length < 8) return setErro('A senha precisa de pelo menos 8 caracteres.');
    const problema = acoes.criarConta(f);
    if (problema) return setErro(problema);
    navegar('/criar-conta/area');
  }

  return (
    <div className="dividida">
      <div className="dividida__form">
        <div className="linha linha--entre" style={{ gap: 16 }}>
          <Logo altura={32} para="/" />
          <span className="pequeno texto-suave">Passo 1 de 2</span>
        </div>
        <form className="formulario" onSubmit={enviar}>
          <div className="coluna">
            <h1 style={{ fontSize: 36, lineHeight: '40px', letterSpacing: '-.02em' }}>Crie sua conta</h1>
            <p className="texto-suave">Leva um minuto. Os modelos da sua área chegam no passo seguinte.</p>
          </div>
          <label className="tr-campo tr-campo--largo">
            <span className="tr-campo__rotulo">Seu nome</span>
            <input className="tr-campo__entrada" required autoComplete="name" {...campo('nome')} />
          </label>
          <label className="tr-campo tr-campo--largo">
            <span className="tr-campo__rotulo">Nome do escritório ou da clínica</span>
            <input className="tr-campo__entrada" required autoComplete="organization" {...campo('escritorio')} />
            <span className="tr-campo__dica">É o nome que o seu cliente vai ver no balcão.</span>
          </label>
          <label className="tr-campo tr-campo--largo">
            <span className="tr-campo__rotulo">E-mail</span>
            <input className="tr-campo__entrada" type="email" required autoComplete="email" {...campo('email')} />
          </label>
          <label className={`tr-campo tr-campo--largo${erro ? ' tr-campo--erro' : ''}`}>
            <span className="tr-campo__rotulo">Senha</span>
            <input className="tr-campo__entrada" type="password" required autoComplete="new-password" {...campo('senha')} />
            {erro ? (
              <span className="tr-campo__erro">
                <Icone nome="info" />
                {erro}
              </span>
            ) : (
              <span className="tr-campo__dica">Pelo menos 8 caracteres.</span>
            )}
          </label>
          <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 48 }}>
            Continuar
          </button>
          <p className="miudo texto-suave">
            Ao continuar, você concorda com os <a href="#">Termos de uso</a> e a <a href="#">Política de privacidade</a>.
          </p>
          <p className="pequeno texto-suave">
            Já tem conta? <Link to="/entrar">Entrar</Link>
          </p>
        </form>
      </div>
      <ArteCriarConta />
    </div>
  );
}

const AREAS: { id: AreaId; nome: string; exemplos: string; icone: string }[] = [
  { id: 'contabilidade', nome: 'Contabilidade', exemplos: 'Imposto de Renda, abertura de empresa, rotina do mês.', icone: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 7h6M9 11h1M14 11h1M9 15h1M14 15h1' },
  { id: 'advocacia', nome: 'Advocacia', exemplos: 'Inventário, previdenciário, família e imóveis.', icone: 'M12 3v18M7 21h10M5 7h14M5 7l-2.5 6a3 3 0 0 0 5 0zM19 7l-2.5 6a3 3 0 0 0 5 0z' },
  { id: 'saude', nome: 'Saúde', exemplos: 'Consultas, exames, cirurgias e reembolsos.', icone: 'M6 3v6a6 6 0 0 0 12 0V3M6 3h2M16 3h2M12 15v2a4 4 0 0 0 8 0v-1' },
];

export function EscolherArea() {
  const sessao = useSessao();
  const navegar = useNavigate();
  const [area, setArea] = useState<AreaId>(sessao?.conta.area ?? 'advocacia');
  if (!sessao) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '32px 24px' }} className="linha linha--entre">
        <Logo altura={32} />
        <span className="pequeno texto-suave">Passo 2 de 2</span>
      </div>
      <div style={{ flex: 1, maxWidth: 1040, width: '100%', margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 40, justifyContent: 'center' }}>
        <div className="coluna" style={{ gap: 12, maxWidth: 620 }}>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)', lineHeight: 1.1, letterSpacing: '-.02em' }}>Em que área você trabalha?</h1>
          <p className="texto-suave" style={{ fontSize: 18, lineHeight: '28px' }}>
            Assim já separamos os modelos certos para você. Se precisar, dá para usar modelos de outra área depois.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 20 }}>
          {AREAS.map((a) => {
            const sel = a.id === area;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={sel}
                onClick={() => setArea(a.id)}
                style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14, borderRadius: 16, background: 'var(--areia-elevada)', minHeight: 230, padding: sel ? 27 : 28, border: sel ? '2px solid var(--mangue)' : '1px solid var(--linha)', color: 'var(--tinta)' }}
              >
                <span style={{ width: 48, height: 48, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--mangue-suave)', color: 'var(--mangue)' }}>
                  <svg className="tr-icone" viewBox="0 0 24 24" style={{ width: 24, height: 24 }} aria-hidden="true">
                    <path d={a.icone} />
                  </svg>
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: '30px', fontWeight: 600 }}>{a.nome}</span>
                <span className="texto-suave" style={{ fontSize: 15, lineHeight: '22px' }}>
                  {a.exemplos}
                </span>
                {sel && (
                  <span className="pequeno" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500, color: 'var(--mangue)' }}>
                    <Icone nome="check" tamanho={18} />
                    Selecionada
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="linha linha--entre" style={{ gap: 16, paddingTop: 8 }}>
          <p className="pequeno texto-suave">Trabalha em outra área? Por enquanto, escolha a mais próxima e ajuste os modelos.</p>
          <button
            type="button"
            className="tr-btn tr-btn--primario"
            style={{ height: 48, padding: '0 28px' }}
            onClick={() => {
              acoes.definirArea(sessao.conta.id, area);
              navegar('/app');
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
