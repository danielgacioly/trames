import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { acompanharSistema, aplicarTema, limparTema } from '../ui/tema';
import { useTermoNaTela } from '../ui/termo';
import { TERMO_PADRAO } from '@trames/shared';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PLANOS, type Recurso } from '@trames/shared';
import { api, ErroDaApi } from '../dados/api';
import { useEu } from '../dados/consultas';
import { iniciais } from '../util/formatos';
import { Carregando, Logo } from '../ui/comuns';
import { Icone, type NomeIcone } from '../ui/Icone';
import { AvisosDeUso } from './AvisosDeUso';
import { LimiteErro } from './LimiteErro';

const NAV: { para: string; rotulo: string; icone: NomeIcone; recurso?: Recurso; fim?: boolean }[] = [
  { para: '/app', rotulo: 'Início', icone: 'inicio', fim: true },
  { para: '/app/balcoes', rotulo: 'Balcões', icone: 'balcoes' },
  { para: '/app/modelos', rotulo: 'Modelos', icone: 'modelos' },
  { para: '/app/clientes', rotulo: 'Clientes', icone: 'clientes' },
  { para: '/app/relatorio', rotulo: 'Relatório', icone: 'relatorio', recurso: 'relatorio' },
  { para: '/app/equipe', rotulo: 'Equipe', icone: 'equipe' },
  { para: '/app/configuracoes', rotulo: 'Configurações', icone: 'ajustes' },
];

export function LayoutApp() {
  const eu = useEu();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const local = useLocation();
  const [menu, setMenu] = useState(false);
  // O tema escolhido vale só dentro do painel; o site e as telas de entrada ficam claros.
  useEffect(() => {
    aplicarTema();
    const parar = acompanharSistema();
    return () => {
      parar();
      limparTema();
    };
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [local.pathname]);

  useTermoNaTela(eu.data?.organizacao.termo ?? TERMO_PADRAO);

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
        <nav className="lateral__nav" aria-label="Principal">
          {NAV.map((n) => (
            <NavLink key={n.para} to={n.para} end={n.fim} className={({ isActive }) => (isActive || (n.fim && local.pathname.startsWith('/app/pastas')) ? 'active' : undefined)}>
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
          <div className="pessoa">
            <NavLink to="/app/configuracoes/perfil" className="avatar" title="Meu perfil" style={{ textDecoration: 'none' }}>
              {iniciais(usuario.nome)}
            </NavLink>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span className="pequeno" style={{ fontWeight: 500 }}>
                {usuario.nome}
              </span>
              <span className="texto-suave" style={{ fontSize: 12, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {organizacao.nome} · {plano.nome}
              </span>
            </span>
            <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ padding: '0 8px' }} aria-label="Sair" title="Sair" onClick={sair}>
              <Icone nome="sair" />
            </button>
          </div>
        </div>
      </aside>
      <main className="principal">
        <div className="principal__conteudo">
          <LimiteErro chave={local.pathname}>
            <Outlet />
          </LimiteErro>
        </div>
      </main>
      <AvisosDeUso />
    </div>
  );
}
