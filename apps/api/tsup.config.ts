import { defineConfig } from 'tsup';

// Os pacotes do monorepo entram no bundle; as dependências de npm ficam de fora.
export default defineConfig({ entry: ['src/main.ts'], format: 'esm', target: 'node22', outDir: 'dist', noExternal: [/^@trames\//], sourcemap: true, clean: true });
