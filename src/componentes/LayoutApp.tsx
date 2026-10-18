import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { acoes, balcoesAtivos, tem, useDb, useSessao, type Sessao } from '../dados/store';
import type { Recurso } from '../dados/planos';
import { iniciais, pct } from '../util';
import { Logo } from './comuns';
import { Icone, type NomeIcone } from './Icone';

const NAV: { para: string; rotulo: string; icone: NomeIcone; recurso?: Recurso; fim?: boolean }[] = [
  { para: '/app', rotulo: 'Balcões', icone: 'balcoes', fim: true },
  { para: '/app/modelos', rotulo: 'Modelos', icone: 'modelos' },
  { para: '/app/clientes', rotulo: 'Clientes', icone: 'clientes' },
  { para: '/app/turu', rotulo: 'Turu', icone: 'turu', recurso: 'turu' },
  { para: '/app/relatorio', rotulo: 'Relatório', icone: 'relatorio', recurso: 'relatorio' },
  { para: '/app/equipe', rotulo: 'Equipe', icone: 'equipe' },
  { para: '/app/conta', rotulo: 'Conta e marca', icone: 'ajustes' },
];

function Medidor({ sessao }: { sessao: Sessao }) {
  const db = useDb();
  const ativos = balcoesAtivos(db, sessao.conta.id).length;
  const limite = sessao.plano.limiteBalcoes;
  const cheio = limite !== null && ativos >= limite;
  return (
    <div className={`medidor${cheio ? ' medidor--cheio' : ''}`}>
      <div className="linha linha--entre miudo">
        <span style={{ fontWeight: 500 }}>Plano {sessao.plano.nome}</span>
        <span className="texto-suave">{limite === null ? `${ativos} abertos` : `${ativos} de ${limite}`}</span>
      </div>
      <div className="tr-progresso__trilho">
        <div className="tr-progresso__barra" style={{ '--p': `${limite === null ? 100 : pct(ativos, limite)}%` } as React.CSSProperties} />
      </div>
      <span className="miudo texto-suave">{limite === null ? 'Balcões ativos sem limite' : cheio ? 'Você chegou no limite de balcões' : 'balcões ativos'}</span>
      {sessao.plano.id !== 'ultra' && (
        <Link to="/planos" className="miudo" style={{ fontWeight: 500 }}>
          Ver planos
        </Link>
      )}
    </div>
  );
}

export function LayoutApp() {
  const sessao = useSessao();
  const navegar = useNavigate();
  const local = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [local.pathname]);

  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;

  return (
    <div className={`app${menu ? ' app--menu-aberto' : ''}`}>
      <div className="topo-movel">
        <Logo altura={26} para="/app" />
        <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" aria-label="Abrir menu" onClick={() => setMenu(true)}>
          <Icone nome="menu" />
        </button>
      </div>
      <div className="veu" onClick={() => setMenu(false)} />
      <aside className="lateral">
        <Logo altura={28} para="/app" />
        <Link to="/app/novo" className="tr-btn tr-btn--primario tr-btn--bloco">
          <Icone nome="mais" />
          Novo balcão
        </Link>
        <nav className="lateral__nav" aria-label="Principal">
          {NAV.map((n) => (
            <NavLink key={n.para} to={n.para} end={n.fim}>
              <Icone nome={n.icone} />
              {n.rotulo}
              {n.recurso && !tem(sessao, n.recurso) && (
                <svg className="tr-icone cadeado" viewBox="0 0 24 24" aria-label={`Não incluso no plano ${sessao.plano.nome}`}>
                  <path d="M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="lateral__rodape">
          <Medidor sessao={sessao} />
          <div className="pessoa">
            <span className="avatar">{iniciais(sessao.usuario.nome)}</span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span className="pequeno" style={{ fontWeight: 500 }}>
                {sessao.usuario.nome}
              </span>
              <span className="texto-suave" style={{ fontSize: 12, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sessao.conta.nome}
              </span>
            </span>
            <button
              type="button"
              className="tr-btn tr-btn--discreto tr-btn--sm"
              style={{ padding: '0 8px' }}
              aria-label="Sair"
              title="Sair"
              onClick={() => {
                acoes.sair();
                navegar('/entrar');
              }}
            >
              <Icone nome="sair" />
            </button>
          </div>
        </div>
      </aside>
      <main className="principal">
        <Outlet />
      </main>
    </div>
  );
}
