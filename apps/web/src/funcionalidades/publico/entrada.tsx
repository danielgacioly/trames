import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { AreaId, EtapaSessao } from '@trames/shared';
import { api, mensagemDe } from '../../dados/api';
import { chaves, useEu } from '../../dados/consultas';
import { AvisoErro, Carregando, Logo } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';

/** Contas criadas pelo seed (só aparecem em desenvolvimento). */
const CONTAS_TESTE = [
  { plano: 'Grátis', email: 'gratis@trames.app', quem: 'Carla Menezes · Clínica Boa Vista' },
  { plano: 'Pro', email: 'pro@trames.app', quem: 'Ana Albuquerque · Albuquerque & Lima' },
  { plano: 'Ultra', email: 'ultra@trames.app', quem: 'Rafael Moura · Lins & Moura Contabilidade' },
];
const SENHA_TESTE = 'trames-teste-123';

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
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e?: FormEvent, em = email, se = senha) {
    e?.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { etapa } = await api<{ etapa: EtapaSessao }>('POST', '/auth/entrar', { email: em, senha: se });
      await qc.invalidateQueries({ queryKey: chaves.eu });
      const destino = (local.state as { de?: string } | null)?.de ?? '/app';
      navegar(etapa === 'completa' ? destino : '/entrar/2fa', { state: { de: destino, email: em } });
    } catch (x) {
      setErro(mensagemDe(x));
    } finally {
      setEnviando(false);
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
            <span className="linha linha--entre">
              <span className="tr-campo__rotulo">Senha</span>
              <Link to="/esqueci-senha" state={{ email }} className="miudo" style={{ fontWeight: 500 }}>
                Esqueci a senha
              </Link>
            </span>
            <input className="tr-campo__entrada" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            {erro && (
              <span className="tr-campo__erro">
                <Icone nome="info" />
                {erro}
              </span>
            )}
          </label>
          <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 48 }} disabled={enviando}>
            Entrar
          </button>
          <div className="linha linha--entre pequeno" style={{ gap: 12 }}>
            <span className="texto-suave">
              Ainda não tem conta? <Link to="/criar-conta">Criar conta grátis</Link>
            </span>
          </div>

          {import.meta.env.DEV && (
            <div className="cartao cartao--fundo" style={{ padding: 16, gap: 10 }}>
              <div className="linha linha--entre">
                <span className="miudo" style={{ fontWeight: 500 }}>
                  Contas de teste (só em desenvolvimento)
                </span>
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
              <span className="miudo texto-suave">Depois da senha vem o código enviado por e-mail. Em desenvolvimento, ele fica na caixa de saída e a tela tem um botão que o preenche.</span>
            </div>
          )}
        </form>
      </div>
      <ArteEntrar />
    </div>
  );
}

/** Mostra só o começo do e-mail: "an***@albuquerquelima.adv.br". */
const mascararEmail = (email: string) => email.replace(/^(.{1,2})[^@]*@/, '$1***@');

/** Segunda etapa do login: o código de 6 dígitos que chegou no e-mail. */
export function SegundoFator() {
  const eu = useEu();
  const navegar = useNavigate();
  const local = useLocation();
  const qc = useQueryClient();
  const estado = local.state as { de?: string; novo?: boolean } | null;
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const etapa = eu.data?.etapa;

  if (eu.isPending) return <Carregando />;
  if (!eu.data) return <Navigate to="/entrar" replace />;
  if (etapa === 'completa') return <Navigate to={estado?.novo ? '/criar-conta/area' : (estado?.de ?? '/app')} replace />;

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await api('POST', '/auth/2fa/verificar', { codigo });
      await qc.invalidateQueries({ queryKey: chaves.eu });
      navegar(estado?.novo ? '/criar-conta/area' : (estado?.de ?? '/app'), { replace: true });
    } catch (x) {
      setErro(mensagemDe(x));
    }
  }

  async function reenviar() {
    setErro('');
    setCodigo('');
    try {
      await api('POST', '/auth/2fa/reenviar');
      setAviso('Mandamos um código novo. O anterior deixou de valer.');
    } catch (x) {
      setErro(mensagemDe(x));
    }
  }

  return (
    <div className="dividida">
      <div className="dividida__form">
        <Logo altura={32} para="/" />
        <form className="formulario" style={{ maxWidth: 400 }} onSubmit={confirmar}>
          <div className="coluna">
            <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>Confira o seu e-mail</h1>
            <p className="texto-suave">
              Enviamos um código de 6 números para <strong style={{ fontWeight: 500, color: 'var(--tinta)' }}>{mascararEmail(eu.data.usuario.email)}</strong>. Ele vale por 10 minutos.
            </p>
          </div>
          <label className={`tr-campo tr-campo--largo${erro ? ' tr-campo--erro' : ''}`}>
            <span className="tr-campo__rotulo">Código</span>
            <input className="tr-campo__entrada tr-protocolo" inputMode="numeric" autoComplete="one-time-code" required pattern="\d{6}" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} autoFocus />
            {erro && (
              <span className="tr-campo__erro">
                <Icone nome="info" />
                {erro}
              </span>
            )}
          </label>
          {aviso && !erro && <p className="pequeno texto-suave">{aviso}</p>}
          <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 48 }} disabled={codigo.length !== 6}>
            Entrar
          </button>
          <div className="linha linha--entre pequeno">
            <span className="texto-suave">
              Não chegou? Veja a caixa de spam ou{' '}
              <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ padding: 0, height: 'auto' }} onClick={reenviar}>
                peça outro código
              </button>
            </span>
          </div>
          {import.meta.env.DEV && (
            <button
              type="button"
              className="tr-btn tr-btn--discreto tr-btn--sm"
              style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
              onClick={() => api<{ codigo: string | null }>('GET', '/auth/dev/codigo').then((r) => r.codigo && setCodigo(r.codigo))}
            >
              Desenvolvimento: preencher o código da caixa de saída
            </button>
          )}
          <button
            type="button"
            className="tr-btn tr-btn--discreto tr-btn--sm"
            style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
            onClick={async () => {
              await api('POST', '/auth/sair');
              qc.clear();
              navegar('/entrar');
            }}
          >
            Entrar com outra conta
          </button>
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

  const qc = useQueryClient();
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (f.senha.length < 10) return setErro('A senha precisa de pelo menos 10 caracteres.');
    try {
      await api('POST', '/auth/criar-conta', f);
      await qc.invalidateQueries({ queryKey: chaves.eu });
      navegar('/entrar/2fa', { state: { novo: true } });
    } catch (x) {
      setErro(mensagemDe(x));
    }
  }

  return (
    <div className="dividida">
      <div className="dividida__form">
        <div className="linha linha--entre" style={{ gap: 16 }}>
          <Logo altura={32} para="/" />
          <span className="pequeno texto-suave">Passo 1 de 3</span>
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
              <span className="tr-campo__dica">Pelo menos 10 caracteres.</span>
            )}
          </label>
          <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 48 }}>
            Continuar
          </button>
          <p className="miudo texto-suave">
            Ao continuar, você concorda com os{' '}
            <Link to="/termos" target="_blank">
              Termos de uso
            </Link>{' '}
            e a{' '}
            <Link to="/privacidade" target="_blank">
              Política de privacidade
            </Link>
            .
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
  const eu = useEu();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [area, setArea] = useState<AreaId>('advocacia');
  const [erro, setErro] = useState<unknown>(null);
  if (eu.isPending) return <Carregando />;
  if (eu.data?.etapa !== 'completa') return <Navigate to="/entrar" replace />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '32px 24px' }} className="linha linha--entre">
        <Logo altura={32} />
        <span className="pequeno texto-suave">Passo 3 de 3</span>
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
                style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14, borderRadius: 12, background: 'var(--areia-elevada)', minHeight: 230, padding: sel ? 27 : 28, border: sel ? '2px solid var(--mangue)' : '1px solid var(--linha)', color: 'var(--tinta)' }}
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
        <AvisoErro erro={erro} />
        <div className="linha linha--entre" style={{ gap: 16, paddingTop: 8 }}>
          <p className="pequeno texto-suave">Trabalha em outra área? Por enquanto, escolha a mais próxima e ajuste os modelos.</p>
          <button
            type="button"
            className="tr-btn tr-btn--primario"
            style={{ height: 48, padding: '0 28px' }}
            onClick={async () => {
              try {
                await api('PUT', '/organizacao/area', { area });
                await qc.invalidateQueries();
                navegar('/app');
              } catch (x) {
                setErro(x);
              }
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Aceitar convite de equipe: cria a senha e segue para o 2FA quando for admin. */
export function Convite() {
  const { token = '' } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [dados, setDados] = useState<{ nome: string; email: string; organizacao: string } | null>(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    api<{ nome: string; email: string; organizacao: string }>('GET', `/auth/convite/${token}`).then(setDados, (e) => setErro(mensagemDe(e)));
  }, [token]);

  async function aceitar(e: FormEvent) {
    e.preventDefault();
    try {
      const { etapa } = await api<{ etapa: EtapaSessao }>('POST', `/auth/convite/${token}`, { senha });
      await qc.invalidateQueries({ queryKey: chaves.eu });
      navegar(etapa === 'completa' ? '/app' : '/entrar/2fa');
    } catch (x) {
      setErro(mensagemDe(x));
    }
  }

  return (
    <div className="dividida">
      <div className="dividida__form">
        <Logo altura={32} para="/" />
        <form className="formulario" onSubmit={aceitar}>
          <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>{dados ? `Olá, ${dados.nome.split(' ')[0]}` : 'Convite'}</h1>
          {dados && <p className="texto-suave">Você foi convidado para a conta {dados.organizacao}. Crie uma senha para entrar.</p>}
          {dados && (
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Senha</span>
              <input className="tr-campo__entrada" type="password" autoComplete="new-password" required minLength={10} value={senha} onChange={(e) => setSenha(e.target.value)} />
              <span className="tr-campo__dica">Pelo menos 10 caracteres.</span>
            </label>
          )}
          {erro && <AvisoErro erro={new Error(erro)} />}
          {dados && (
            <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 48 }}>
              Criar senha e entrar
            </button>
          )}
        </form>
      </div>
      <ArteEntrar />
    </div>
  );
}

/** Pede o link para criar uma senha nova. A resposta é a mesma exista ou não a conta. */
export function EsqueciSenha() {
  const local = useLocation();
  const [email, setEmail] = useState((local.state as { email?: string } | null)?.email ?? '');
  const [enviado, setEnviado] = useState(false);
  const [urlDev, setUrlDev] = useState<string | undefined>();
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function pedir(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const r = await api<{ urlDev?: string }>('POST', '/auth/esqueci', { email });
      setUrlDev(r.urlDev);
      setEnviado(true);
    } catch (x) {
      setErro(mensagemDe(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="dividida">
      <div className="dividida__form">
        <Logo altura={32} para="/" />
        {enviado ? (
          <div className="formulario" style={{ maxWidth: 380 }}>
            <span className="selo-ok">
              <Icone nome="envio" tamanho={24} />
            </span>
            <div className="coluna">
              <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>Confira o seu e-mail</h1>
              <p className="texto-suave">
                Se existir uma conta com <strong style={{ fontWeight: 500, color: 'var(--tinta)' }}>{email}</strong>, mandamos um link para criar uma senha nova. Ele vale por 1 hora.
              </p>
            </div>
            {urlDev && (
              <a href={urlDev} className="tr-btn tr-btn--secundario tr-btn--bloco">
                Desenvolvimento: abrir o link do e-mail
              </a>
            )}
            <p className="pequeno texto-suave">
              Não chegou? Veja a caixa de spam ou{' '}
              <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ padding: 0, height: 'auto' }} onClick={() => setEnviado(false)}>
                tente de novo
              </button>
              .
            </p>
            <Link to="/entrar" className="pequeno" style={{ fontWeight: 500 }}>
              Voltar para entrar
            </Link>
          </div>
        ) : (
          <form className="formulario" style={{ maxWidth: 380 }} onSubmit={pedir}>
            <div className="coluna">
              <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>Esqueceu a senha?</h1>
              <p className="texto-suave">Diga o e-mail da sua conta e mandamos um link para criar uma senha nova.</p>
            </div>
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">E-mail</span>
              <input className="tr-campo__entrada" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {erro && <AvisoErro erro={new Error(erro)} />}
            <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 48 }} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Mandar o link'}
            </button>
            <Link to="/entrar" className="pequeno" style={{ fontWeight: 500 }}>
              Voltar para entrar
            </Link>
          </form>
        )}
      </div>
      <ArteEntrar />
    </div>
  );
}

/** Link do e-mail: cria a senha nova e segue para o código, como num login. */
export function RedefinirSenha() {
  const { token = '' } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');
  const [invalido, setInvalido] = useState('');
  useEffect(() => {
    api<{ email: string }>('GET', `/auth/redefinir/${token}`).then((r) => setEmail(r.email), (e) => setInvalido(mensagemDe(e)));
  }, [token]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (senha.length < 10) return setErro('A senha precisa de pelo menos 10 caracteres.');
    if (senha !== repetir) return setErro('As duas senhas não são iguais.');
    try {
      await api<{ etapa: EtapaSessao }>('POST', `/auth/redefinir/${token}`, { senha });
      await qc.invalidateQueries({ queryKey: chaves.eu });
      navegar('/entrar/2fa', { state: { email } });
    } catch (x) {
      setErro(mensagemDe(x));
    }
  }

  return (
    <div className="dividida">
      <div className="dividida__form">
        <Logo altura={32} para="/" />
        {invalido ? (
          <div className="formulario" style={{ maxWidth: 380 }}>
            <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>Link vencido</h1>
            <p className="texto-suave">{invalido}</p>
            <Link to="/esqueci-senha" className="tr-btn tr-btn--primario tr-btn--bloco">
              Pedir outro link
            </Link>
          </div>
        ) : !email ? (
          <Carregando />
        ) : (
          <form className="formulario" style={{ maxWidth: 380 }} onSubmit={salvar}>
            <div className="coluna">
              <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>Crie uma senha nova</h1>
              <p className="texto-suave">Para {email}. Os aparelhos conectados saem da conta.</p>
            </div>
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Senha nova</span>
              <input className="tr-campo__entrada" type="password" autoComplete="new-password" required minLength={10} autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
              <span className="tr-campo__dica">Pelo menos 10 caracteres.</span>
            </label>
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Repita a senha</span>
              <input className="tr-campo__entrada" type="password" autoComplete="new-password" required value={repetir} onChange={(e) => setRepetir(e.target.value)} />
            </label>
            {erro && <AvisoErro erro={new Error(erro)} />}
            <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 48 }}>
              Salvar e entrar
            </button>
          </form>
        )}
      </div>
      <ArteEntrar />
    </div>
  );
}
