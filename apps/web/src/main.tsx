import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Estilo do site (landing); o painel usa os estilos de ./estilos, que valem só dentro de .ui.
import '@trames/shared/estilos/tokens.css';
import '@trames/shared/estilos/componentes.css';
import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/layout.css';
import { App } from './app/App';
import { LimiteErro } from './app/LimiteErro';
import { ProvedorDialogos, ProvedorNotificacoes } from './ui';

const consultas = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 10_000 } } });

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <BrowserRouter>
        <ProvedorNotificacoes>
          <ProvedorDialogos>
            <LimiteErro>
              <App />
            </LimiteErro>
          </ProvedorDialogos>
        </ProvedorNotificacoes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
