import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PLANOS } from '@trames/shared';
import { api, ErroDaApi } from '../dados/api';
import { useBalcoes, useEu } from '../dados/consultas';
import { Avatar, Botao, Carregando, Icone, Logo, type NomeIcone } from '../ui';
import { AvisosDeUso } from './AvisosDeUso';
import { LimiteErro } from './LimiteErro';

function Item({ para, icone, rotulo, contagem, fim }: { para: string; icone: NomeIcone; rotulo: string; contagem?: number; fim?: boolean }) {
  return (
    <NavLink to={para} end={fim} className="lateral__item">
      <Icone nome={icone} />
      {rotulo}
      {!!contagem && (
        <span className="lateral__contagem" aria-label={`${contagem} para conferir`}>
          {contagem}
        </span>
      )}
    </NavLink>
  );
}

/** Quantos balcões abertos têm documento esperando conferência (o número ao lado de "Balcões"). */
function useParaConferir(ativo: boolean) {
  const balcoes = useBalcoes(ativo).data;
  return balcoes?.filter((b) => !b.concluidoEm && b.contagem.analise > 0).length ?? 0;
}

export function LayoutApp() {
  const eu = useEu();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const local = useLocation();
  const [menu, setMenu] = useState(false);
  const pronto = eu.data?.etapa === 'completa';
  const paraConferir = useParaConferir(pronto);
  useEffect(() => {
    setMenu(false);
  }, [local.pathname]);

  if (eu.isPending) return <Carregando />;
  if (eu.error) {
    if (eu.error instanceof ErroDaApi && eu.error.status === 401) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
    return <Carregando texto={eu.error.message} />;
  }
  if (!pronto) return <Navigate to="/entrar/2fa" replace />;

  const { usuario, organizacao } = eu.data;
  const plano = PLANOS[eu.data.plano];

  async function sair() {
    await api('POST', '/auth/sair').catch(() => {});
    qc.clear();
    navegar('/entrar');
  }

  return (
    <div className={`ui app${menu ? ' app--menu' : ''}`}>
      <header className="topo-movel">
        <Logo altura={22} para="/app" />
        <Botao variante="icone" aria-label="Abrir menu" onClick={() => setMenu(true)}>
          <Icone nome="menu" />
        </Botao>
      </header>
      {menu && <div className="veu-menu" onClick={() => setMenu(false)} />}

      <aside className="lateral" aria-label="Navegação">
        <div className="lateral__marca">
          <Logo altura={22} para="/app" />
        </div>
        <nav className="lateral__grupo" aria-label="Principal">
          <Item para="/app" icone="balcoes" rotulo="Balcões" contagem={paraConferir} fim />
          <Item para="/app/clientes" icone="clientes" rotulo="Clientes" />
          <Item para="/app/modelos" icone="modelos" rotulo="Modelos" />
          {plano.recursos.relatorio && <Item para="/app/relatorio" icone="relatorio" rotulo="Relatório" />}
          {/* Turu fica fora do lançamento (docs/viabilidade.md); VITE_TURU=1 liga em desenvolvimento. */}
          {import.meta.env.VITE_TURU === '1' && <Item para="/app/turu" icone="turu" rotulo="Turu" />}
        </nav>
        <div className="lateral__rodape">
          <NavLink to="/app/conta" className="lateral__pessoa">
            <Avatar nome={usuario.nome} tamanho={26} />
            <span className="cresce" style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span className="corta" style={{ fontSize: 13, fontWeight: 500 }}>
                {usuario.nome}
              </span>
              <span className="corta terciario pequeno">
                {organizacao.nome} · {plano.nome}
              </span>
            </span>
          </NavLink>
          <button type="button" className="lateral__item" onClick={sair}>
            <Icone nome="sair" />
            Sair
          </button>
        </div>
      </aside>

      <main className="conteudo">
        <LimiteErro chave={local.pathname}>
          <Outlet />
        </LimiteErro>
      </main>
      <AvisosDeUso />
    </div>
  );
}
