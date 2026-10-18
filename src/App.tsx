import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutApp } from './componentes/LayoutApp';
import { ClienteAcesso, ClienteEnviar, ClienteLista, ClientePronto } from './paginas/cliente';
import { Conferir } from './paginas/Conferir';
import { Clientes, Conta, Equipe, Relatorio } from './paginas/gestao';
import { EditorModelo, Modelos } from './paginas/Modelos';
import { LinkBalcao, NovoBalcao } from './paginas/NovoBalcao';
import { Painel } from './paginas/Painel';
import { CriarConta, Entrar, EscolherArea, Landing, Planos } from './paginas/publico';
import { Turu } from './paginas/Turu';

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
        <Route path="/criar-conta" element={<CriarConta />} />
        <Route path="/criar-conta/area" element={<EscolherArea />} />

        <Route path="/app" element={<LayoutApp />}>
          <Route index element={<Painel />} />
          <Route path="novo" element={<NovoBalcao />} />
          <Route path="balcao/:id" element={<Conferir />} />
          <Route path="balcao/:id/link" element={<LinkBalcao />} />
          <Route path="modelos" element={<Modelos />} />
          <Route path="modelos/novo" element={<EditorModelo />} />
          <Route path="modelos/:id" element={<EditorModelo />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="turu" element={<Turu />} />
          <Route path="relatorio" element={<Relatorio />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="conta" element={<Conta />} />
        </Route>

        <Route path="/b/:codigo" element={<ClienteAcesso />} />
        <Route path="/b/:codigo/lista" element={<ClienteLista />} />
        <Route path="/b/:codigo/enviar/:docId" element={<ClienteEnviar />} />
        <Route path="/b/:codigo/pronto" element={<ClientePronto />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
    </>
  );
}
