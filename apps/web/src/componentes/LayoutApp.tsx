import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PLANOS, type Recurso } from '@trames/shared';
import { api, ErroDaApi } from '../dados/api';
import { useCobranca, useEu, useSessao } from '../dados/consultas';
import { iniciais, pct } from '../util';
import { Carregando, Logo } from './comuns';
import { Icone, type NomeIcone } from './Icone';
import { LimiteErro } from './LimiteErro';

const NAV: { para: string; rotulo: string; icone: NomeIcone; recurso?: Recurso; fim?: boolean }[] = [
  { para: '/app', rotulo: 'Balcões', icone: 'balcoes', fim: true },
  { para: '/app/modelos', rotulo: 'Modelos', icone: 'modelos' },
  { para: '/app/clientes', rotulo: 'Clientes', icone: 'clientes' },
  { para: '/app/turu', rotulo: 'Turu', icone: 'turu', recurso: 'turu' },
  { para: '/app/relatorio', rotulo: 'Relatório', icone: 'relatorio', recurso: 'relatorio' },
  { para: '/app/equipe', rotulo: 'Equipe', icone: 'equipe' },
  { para: '/app/conta', rotulo: 'Conta e marca', icone: 'ajustes' },
];

function Medidor() {
  const { plano } = useSessao();
  const ativos = useCobranca().data?.balcoesAtivos ?? 0;
  const limite = plano.limiteBalcoes;
  const cheio = limite !== null && ativos >= limite;
  return (
    <div className={`medidor${cheio ? ' medidor--cheio' : ''}`}>
      <div className="linha linha--entre miudo">
        <span style={{ fontWeight: 500 }}>Plano {plano.nome}</span>
        <span className="texto-suave">{limite === null ? `${ativos} abertos` : `${ativos} de ${limite}`}</span>
      </div>
      <div className="tr-progresso__trilho">
        <div className="tr-progresso__barra" style={{ '--p': `${limite === null ? 100 : pct(ativos, limite)}%` } as React.CSSProperties} />
      </div>
      <span className="miudo texto-suave">{limite === null ? 'Balcões ativos sem limite' : cheio ? 'Você chegou no limite de balcões' : 'balcões ativos'}</span>
      {plano.id !== 'ultra' && (
        <Link to="/planos" className="miudo" style={{ fontWeight: 500 }}>
          Ver planos
        </Link>
      )}
    </div>
  );
}

export function LayoutApp() {
  const eu = useEu();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const local = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setMenu(false);
  }, [local.pathname]);

  if (eu.isPending) return <Carregando />;
  if (eu.error) {
    const e = eu.error;
    if (e instanceof ErroDaApi && e.status === 401) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
    return <Carregando erro={e.message} />;
  }
  if (eu.data.etapa !== 'completa') return <Navigate to="/entrar/2fa" replace />;

  const { usuario, organizacao } = eu.data;
  const plano = PLANOS[eu.data.plano];

  async function sair() {
    await api('POST', '/auth/sair').catch(() => {});
    qc.clear();
    navegar('/entrar');
  }

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
              {n.recurso && !plano.recursos[n.recurso] && (
                <svg className="tr-icone cadeado" viewBox="0 0 24 24" aria-label={`Não incluso no plano ${plano.nome}`}>
                  <path d="M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="lateral__rodape">
          <Medidor />
          <div className="pessoa">
            <span className="avatar">{iniciais(usuario.nome)}</span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span className="pequeno" style={{ fontWeight: 500 }}>
                {usuario.nome}
              </span>
              <span className="texto-suave" style={{ fontSize: 12, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {organizacao.nome}
              </span>
            </span>
            <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ padding: '0 8px' }} aria-label="Sair" title="Sair" onClick={sair}>
              <Icone nome="sair" />
            </button>
          </div>
        </div>
      </aside>
      <main className="principal">
        <LimiteErro chave={local.pathname}>
          <Outlet />
        </LimiteErro>
      </main>
    </div>
  );
}
