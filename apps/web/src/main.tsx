import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@trames/shared/estilos/tokens.css';
import '@trames/shared/estilos/componentes.css';
import { App } from './app/App';
import { LimiteErro } from './app/LimiteErro';
import './estilos/app.css';
import { ProvedorNotificacoes } from './ui/Notificacoes';

const consultas = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 10_000 } } });

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <BrowserRouter>
        <ProvedorNotificacoes>
          <LimiteErro>
            <App />
          </LimiteErro>
        </ProvedorNotificacoes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
