import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Conferir } from '../funcionalidades/balcoes/Conferir';
import { EditarLista } from '../funcionalidades/balcoes/EditarLista';
import { LinkBalcao } from '../funcionalidades/balcoes/LinkBalcao';
import { NovoBalcao } from '../funcionalidades/balcoes/NovoBalcao';
import { Inicio } from '../funcionalidades/balcoes/Inicio';
import { PastaPagina } from '../funcionalidades/balcoes/PastaPagina';
import { Clientes } from '../funcionalidades/clientes/Clientes';
import { Conta } from '../funcionalidades/conta/Conta';
import { Equipe } from '../funcionalidades/conta/Equipe';
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
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div className="coluna" style={{ alignItems: 'center', gap: 12 }}>
        <h1 className="titulo-1">Página não encontrada</h1>
        <Link to="/">Voltar para o início</Link>
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
          <Route index element={<Inicio />} />
          <Route path="pastas/:grupo/:valor" element={<PastaPagina />} />
          <Route path="novo" element={<NovoBalcao />} />
          <Route path="balcao/:id" element={<Conferir />} />
          <Route path="balcao/:id/link" element={<LinkBalcao />} />
          <Route path="balcao/:id/lista" element={<EditarLista />} />
          <Route path="modelos" element={<Modelos />} />
          <Route path="modelos/novo" element={<EditorModelo />} />
          <Route path="modelos/:id" element={<EditorModelo />} />
          <Route path="clientes" element={<Clientes />} />
          {import.meta.env.VITE_TURU === '1' && <Route path="turu" element={<Turu />} />}
          <Route path="relatorio" element={<Relatorio />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="conta" element={<Conta />} />
        </Route>

        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
    </>
  );
}
