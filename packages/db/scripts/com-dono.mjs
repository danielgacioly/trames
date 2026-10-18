/*
 * Roda um comando (migrações, seed) com o papel DONO do banco.
 * Lê o .env da raiz e põe DATABASE_URL_DONO em DATABASE_URL só para este comando.
 * Falha com uma mensagem clara se o .env ou a variável estiverem faltando.
 *
 *   node scripts/com-dono.mjs prisma migrate deploy
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const arquivo = fileURLToPath(new URL('../../../.env', import.meta.url));
if (!existsSync(arquivo)) {
  console.error(`\nNão achei o arquivo .env em ${arquivo}.\nNa raiz do repositório, rode:  cp .env.example .env\ne preencha CHAVE_MESTRA_LOCAL e CHAVE_HMAC (openssl rand -base64 32).\n`);
  process.exit(1);
}
process.loadEnvFile(arquivo);
if (!process.env.DATABASE_URL_DONO) {
  console.error('\nO .env não tem DATABASE_URL_DONO. Compare com o .env.example.\n');
  process.exit(1);
}

const [comando, ...args] = process.argv.slice(2);
const r = spawnSync(comando, args, {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_DONO },
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
