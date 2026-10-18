import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@trames/shared/estilos/tokens.css';
import '@trames/shared/estilos/componentes.css';
import { App } from './App';
import './estilos.css';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
