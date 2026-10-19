import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Balcao } from '../funcionalidades/balcoes/balcao/Balcao';
import { EditarLista } from '../funcionalidades/balcoes/EditarLista';
import { EnviarLink } from '../funcionalidades/balcoes/EnviarLink';
import { ListaBalcoes } from '../funcionalidades/balcoes/ListaBalcoes';
import { NovoBalcao } from '../funcionalidades/balcoes/NovoBalcao';
import { Clientes } from '../funcionalidades/clientes/Clientes';
import { Conta, ContaEquipe, ContaEscritorio, ContaPlano } from '../funcionalidades/conta/Conta';
import { EditorModelo } from '../funcionalidades/modelos/EditorModelo';
import { Modelos } from '../funcionalidades/modelos/Modelos';
import { Convite, CriarConta, Entrar, EscolherArea, SegundoFator } from '../funcionalidades/publico/entrada';
import { Landing } from '../funcionalidades/publico/Landing';
import { Planos } from '../funcionalidades/publico/Planos';
import { Relatorio } from '../funcionalidades/relatorio/Relatorio';
import { Turu } from '../funcionalidades/turu/Turu';
import { LayoutApp } from './LayoutApp';

function NaoEncontrada() {
  return (
    <div className="ui entrada-tela">
      <div className="entrada-tela__caixa">
        <div className="entrada-tela__titulo">
          <h1>Página não encontrada</h1>
          <Link to="/">Voltar para o início</Link>
        </div>
      </div>
    </div>
  );
}

/** Ao trocar de página, volta ao topo (ou à âncora, na landing). */
function RolarAoTopo() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function App() {
  return (
    <>
      <RolarAoTopo />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/planos" element={<Planos />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/entrar/2fa" element={<SegundoFator />} />
        <Route path="/convite/:token" element={<Convite />} />
        <Route path="/criar-conta" element={<CriarConta />} />
        <Route path="/criar-conta/area" element={<EscolherArea />} />

        <Route path="/app" element={<LayoutApp />}>
          <Route index element={<ListaBalcoes />} />
          <Route path="novo" element={<NovoBalcao />} />
          <Route path="balcao/:id" element={<Balcao />} />
          <Route path="balcao/:id/link" element={<EnviarLink />} />
          <Route path="balcao/:id/lista" element={<EditarLista />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="modelos" element={<Modelos />} />
          <Route path="modelos/novo" element={<EditorModelo />} />
          <Route path="modelos/:id" element={<EditorModelo />} />
          <Route path="relatorio" element={<Relatorio />} />
          {import.meta.env.VITE_TURU === '1' && <Route path="turu" element={<Turu />} />}
          <Route path="conta" element={<Conta />}>
            <Route index element={<Navigate to="plano" replace />} />
            <Route path="plano" element={<ContaPlano />} />
            <Route path="escritorio" element={<ContaEscritorio />} />
            <Route path="equipe" element={<ContaEquipe />} />
          </Route>
          {/* Endereço antigo da Equipe, agora dentro de Minha conta. */}
          <Route path="equipe" element={<Navigate to="/app/conta/equipe" replace />} />
        </Route>

        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
    </>
  );
}
