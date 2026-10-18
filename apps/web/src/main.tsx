import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@trames/shared/estilos/tokens.css';
import '@trames/shared/estilos/componentes.css';
import { App } from './App';
import { LimiteErro } from './componentes/LimiteErro';
import './styles/app.css';

const consultas = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 10_000 } } });

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <BrowserRouter>
        <LimiteErro>
          <App />
        </LimiteErro>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
