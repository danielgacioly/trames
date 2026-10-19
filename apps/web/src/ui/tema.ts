/**
 * Tema do painel: claro, escuro ou automático (segue o sistema). Fica neste
 * navegador; a página do cliente continua sempre clara.
 */
export type Tema = 'claro' | 'escuro' | 'sistema';

const CHAVE = 'trames.tema';
const escuroNoSistema = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export function temaSalvo(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    if (t === 'claro' || t === 'escuro' || t === 'sistema') return t;
  } catch {
    /* sem storage: usa o padrão */
  }
  return 'claro';
}

export function aplicarTema(t: Tema = temaSalvo()) {
  document.documentElement.dataset.tema = t === 'escuro' || (t === 'sistema' && escuroNoSistema()) ? 'escuro' : 'claro';
}

export function salvarTema(t: Tema) {
  try {
    localStorage.setItem(CHAVE, t);
  } catch {
    /* sem storage: vale só até recarregar */
  }
  aplicarTema(t);
}

/** Fora do painel (site, entrada), sempre claro. */
export function limparTema() {
  delete document.documentElement.dataset.tema;
}

/** No automático, acompanha quando o sistema muda. */
export function acompanharSistema() {
  const m = window.matchMedia?.('(prefers-color-scheme: dark)');
  const mudou = () => temaSalvo() === 'sistema' && aplicarTema('sistema');
  m?.addEventListener('change', mudou);
  return () => m?.removeEventListener('change', mudou);
}
