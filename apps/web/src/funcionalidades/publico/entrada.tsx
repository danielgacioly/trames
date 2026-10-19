import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { AreaId, EtapaSessao } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useEu } from '../../dados/consultas';
import { AvisoErro, Botao, Carregando, Icone, Linha, Logo, Secao } from '../../ui';

/** Contas criadas pelo seed (só aparecem em desenvolvimento). */
const CONTAS_TESTE = [
  { plano: 'Grátis', email: 'gratis@trames.app', quem: 'Carla Menezes · Clínica Boa Vista' },
  { plano: 'Pro', email: 'pro@trames.app', quem: 'Ana Albuquerque · Albuquerque & Lima' },
  { plano: 'Ultra', email: 'ultra@trames.app', quem: 'Rafael Moura · Lins & Moura Contabilidade' },
];
const SENHA_TESTE = 'trames-teste-123';

/** Moldura das telas de entrada: logo no topo, caixa estreita no centro, como o login de uma conta Apple. */
function Tela({ titulo, texto, canto, rodape, children }: { titulo: ReactNode; texto?: ReactNode; canto?: ReactNode; rodape?: ReactNode; children: ReactNode }) {
  return (
    <div className="ui entrada-tela">
      <div className="entrada-tela__topo">
        <Logo altura={24} para="/" />
        {canto && <span className="pequeno secundario">{canto}</span>}
      </div>
      <div className="entrada-tela__caixa">
        <div className="entrada-tela__titulo">
          <h1>{titulo}</h1>
          {texto && <p className="secundario">{texto}</p>}
        </div>
        {children}
        {rodape && <div className="entrada-tela__rodape">{rodape}</div>}
      </div>
    </div>
  );
}

function Campos({ children }: { children: ReactNode }) {
  return <div className="grupo grupo--campos">{children}</div>;
}

export function Entrar() {
  const navegar = useNavigate();
  const local = useLocation();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e?: FormEvent, em = email, se = senha) {
    e?.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const { etapa } = await api<{ etapa: EtapaSessao }>('POST', '/auth/entrar', { email: em, senha: se });
      await qc.invalidateQueries({ queryKey: chaves.eu });
      const destino = (local.state as { de?: string } | null)?.de ?? '/app';
      navegar(etapa === 'completa' ? destino : '/entrar/2fa', { state: { de: destino, email: em } });
    } catch (x) {
      setErro(x);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela
      titulo="Entrar na Trames"
      rodape={
        <>
          Ainda não tem conta? <Link to="/criar-conta">Criar conta grátis</Link>
        </>
      }
    >
      <form className="pilha" style={{ gap: 14 }} onSubmit={entrar}>
        <Campos>
          <input className="entrada" type="email" aria-label="E-mail" placeholder="E-mail" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="entrada" type="password" aria-label="Senha" placeholder="Senha" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campos>
        <AvisoErro erro={erro} />
        <Botao type="submit" variante="primario" grande bloco disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>
      </form>

      {import.meta.env.DEV && (
        <Secao titulo="Contas de teste" nota={<>Senha {SENHA_TESTE}. Depois vem o código por e-mail; em desenvolvimento, a tela seguinte tem um botão que o preenche.</>}>
          {CONTAS_TESTE.map((c) => (
            <Linha
              key={c.email}
              titulo={`Entrar como ${c.plano}`}
              sub={c.quem}
              onClick={() => {
                setEmail(c.email);
                setSenha(SENHA_TESTE);
                entrar(undefined, c.email, SENHA_TESTE);
              }}
            />
          ))}
        </Secao>
      )}
    </Tela>
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
  const [erro, setErro] = useState<unknown>(null);
  const [aviso, setAviso] = useState('');
  const destino = estado?.novo ? '/criar-conta/area' : (estado?.de ?? '/app');

  if (eu.isPending) return <Carregando />;
  if (!eu.data) return <Navigate to="/entrar" replace />;
  if (eu.data.etapa === 'completa') return <Navigate to={destino} replace />;

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await api('POST', '/auth/2fa/verificar', { codigo });
      await qc.invalidateQueries({ queryKey: chaves.eu });
      navegar(destino, { replace: true });
    } catch (x) {
      setErro(x);
    }
  }

  async function reenviar() {
    setErro(null);
    setCodigo('');
    try {
      await api('POST', '/auth/2fa/reenviar');
      setAviso('Mandamos um código novo. O anterior deixou de valer.');
    } catch (x) {
      setErro(x);
    }
  }

  async function outraConta() {
    await api('POST', '/auth/sair').catch(() => {});
    qc.clear();
    navegar('/entrar');
  }

  return (
    <Tela
      titulo="Confira o seu e-mail"
      texto={<>Enviamos um código de 6 números para {mascararEmail(eu.data.usuario.email)}. Ele vale por 10 minutos.</>}
      rodape={
        <span className="pilha" style={{ gap: 6, alignItems: 'center' }}>
          <span>
            Não chegou? Veja o spam ou{' '}
            <button type="button" className="botao botao--simples" style={{ height: 'auto', padding: 0 }} onClick={reenviar}>
              peça outro código
            </button>
          </span>
          <button type="button" className="botao botao--simples" style={{ height: 'auto', padding: 0 }} onClick={outraConta}>
            Entrar com outra conta
          </button>
        </span>
      }
    >
      <form className="pilha" style={{ gap: 14 }} onSubmit={confirmar}>
        <Campos>
          <input
            className="entrada mono"
            style={{ fontSize: 20, letterSpacing: '0.3em', textAlign: 'center', height: 52 }}
            aria-label="Código"
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="\d{6}"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
        </Campos>
        <AvisoErro erro={erro} />
        {aviso && !erro && <p className="pequeno secundario" style={{ textAlign: 'center' }}>{aviso}</p>}
        <Botao type="submit" variante="primario" grande bloco disabled={codigo.length !== 6}>
          Continuar
        </Botao>
        {import.meta.env.DEV && (
          <Botao variante="simples" onClick={() => api<{ codigo: string | null }>('GET', '/auth/dev/codigo').then((r) => r.codigo && setCodigo(r.codigo))}>
            Desenvolvimento: preencher o código
          </Botao>
        )}
      </form>
    </Tela>
  );
}

export function CriarConta() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({ nome: '', escritorio: '', email: '', senha: '' });
  const [erro, setErro] = useState<unknown>(null);
  const campo = (k: keyof typeof f, rotulo: string) => ({ 'aria-label': rotulo, placeholder: rotulo, value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (f.senha.length < 10) return setErro(new Error('A senha precisa de pelo menos 10 caracteres.'));
    try {
      await api('POST', '/auth/criar-conta', f);
      await qc.invalidateQueries({ queryKey: chaves.eu });
      navegar('/entrar/2fa', { state: { novo: true } });
    } catch (x) {
      setErro(x);
    }
  }

  return (
    <Tela
      titulo="Crie sua conta"
      texto="Grátis, sem cartão. Os modelos da sua área chegam no passo seguinte."
      canto="Passo 1 de 3"
      rodape={
        <>
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </>
      }
    >
      <form className="pilha" style={{ gap: 14 }} onSubmit={enviar}>
        <Campos>
          <input className="entrada" required autoComplete="name" {...campo('nome', 'Seu nome')} />
          <input className="entrada" required autoComplete="organization" {...campo('escritorio', 'Nome do escritório ou da clínica')} />
        </Campos>
        <Campos>
          <input className="entrada" type="email" required autoComplete="email" {...campo('email', 'E-mail')} />
          <input className="entrada" type="password" required autoComplete="new-password" {...campo('senha', 'Senha (pelo menos 10 caracteres)')} />
        </Campos>
        <AvisoErro erro={erro} />
        <Botao type="submit" variante="primario" grande bloco>
          Continuar
        </Botao>
        <p className="pequeno terciario" style={{ textAlign: 'center' }}>
          O nome do escritório é o que o seu cliente vê no balcão. Ao continuar, você concorda com os <a href="#">Termos de uso</a> e a <a href="#">Política de privacidade</a>.
        </p>
      </form>
    </Tela>
  );
}

const AREAS: { id: AreaId; nome: string; exemplos: string }[] = [
  { id: 'contabilidade', nome: 'Contabilidade', exemplos: 'Imposto de Renda, abertura de empresa, rotina do mês' },
  { id: 'advocacia', nome: 'Advocacia', exemplos: 'Inventário, previdenciário, família e imóveis' },
  { id: 'saude', nome: 'Saúde', exemplos: 'Consultas, exames, cirurgias e reembolsos' },
];

export function EscolherArea() {
  const eu = useEu();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [area, setArea] = useState<AreaId>('advocacia');
  const [erro, setErro] = useState<unknown>(null);
  if (eu.isPending) return <Carregando />;
  if (eu.data?.etapa !== 'completa') return <Navigate to="/entrar" replace />;

  async function continuar() {
    try {
      await api('PUT', '/organizacao/area', { area });
      await qc.invalidateQueries();
      navegar('/app');
    } catch (x) {
      setErro(x);
    }
  }

  return (
    <Tela titulo="Em que área você trabalha?" texto="Assim separamos os modelos certos. Os de outras áreas continuam disponíveis." canto="Passo 3 de 3">
      <div className="grupo" role="radiogroup" aria-label="Área">
        {AREAS.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={a.id === area} className="linha" onClick={() => setArea(a.id)}>
            <span className="linha__corpo">
              <span className="linha__titulo">{a.nome}</span>
              <span className="linha__sub">{a.exemplos}</span>
            </span>
            {a.id === area && <Icone nome="check" className="icone" />}
          </button>
        ))}
      </div>
      <AvisoErro erro={erro} />
      <Botao variante="primario" grande bloco onClick={continuar}>
        Continuar
      </Botao>
    </Tela>
  );
}

/** Aceitar convite de equipe: cria a senha e segue para o código por e-mail. */
export function Convite() {
  const { token = '' } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [dados, setDados] = useState<{ nome: string; email: string; organizacao: string } | null>(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<unknown>(null);
  useEffect(() => {
    api<{ nome: string; email: string; organizacao: string }>('GET', `/auth/convite/${token}`).then(setDados, setErro);
  }, [token]);

  async function aceitar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const { etapa } = await api<{ etapa: EtapaSessao }>('POST', `/auth/convite/${token}`, { senha });
      await qc.invalidateQueries({ queryKey: chaves.eu });
      navegar(etapa === 'completa' ? '/app' : '/entrar/2fa');
    } catch (x) {
      setErro(x);
    }
  }

  return (
    <Tela titulo={dados ? `Olá, ${dados.nome.split(' ')[0]}` : 'Convite'} texto={dados ? `Você foi convidado para a conta ${dados.organizacao}. Crie uma senha para entrar.` : undefined}>
      {dados ? (
        <form className="pilha" style={{ gap: 14 }} onSubmit={aceitar}>
          <Campos>
            <input className="entrada" value={dados.email} disabled aria-label="E-mail" />
            <input className="entrada" type="password" aria-label="Senha" placeholder="Senha (pelo menos 10 caracteres)" autoComplete="new-password" required minLength={10} value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campos>
          <AvisoErro erro={erro} />
          <Botao type="submit" variante="primario" grande bloco>
            Criar senha e entrar
          </Botao>
        </form>
      ) : (
        <AvisoErro erro={erro} />
      )}
    </Tela>
  );
}

