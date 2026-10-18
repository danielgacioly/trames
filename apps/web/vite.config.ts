import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * CSP só no build (o servidor de desenvolvimento do Vite usa scripts inline).
 * Em produção vale também mandar a mesma política como cabeçalho no CDN.
 */
const csp = (connect: string): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${connect}; connect-src 'self' ${connect}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" />`,
    ),
});

export default defineConfig({
  plugins: [react(), csp(process.env.CSP_STORAGE ?? 'https://*.amazonaws.com')],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } },
});
