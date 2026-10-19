import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@trames/shared/estilos/tokens.css';
import '@trames/shared/estilos/componentes.css';
import { App } from './app/App';
import { LimiteErro } from './app/LimiteErro';
import './estilos/app.css';
import { ProvedorConfirmacao } from './ui/Confirmar';
import { ProvedorNotificacoes } from './ui/Notificacoes';
import { aplicarTema } from './ui/tema';

// Antes de desenhar, para o painel não piscar claro quando o tema é escuro.
if (location.pathname.startsWith('/app')) aplicarTema();

const consultas = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 10_000 } } });

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <BrowserRouter>
        <ProvedorNotificacoes>
          <ProvedorConfirmacao>
          <LimiteErro>
            <App />
          </LimiteErro>
          </ProvedorConfirmacao>
        </ProvedorNotificacoes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
