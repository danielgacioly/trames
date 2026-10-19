import PgBoss from 'pg-boss';
import type { Fila, PayloadFila } from '@trames/shared/filas';

/**
 * A API só põe trabalho na fila (pg-boss, no próprio Postgres). Quem executa é o worker.
 */
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: 'pgboss', supervise: false, schedule: false, migrate: false });
let pronto: Promise<void> | null = null;

function iniciar() {
  pronto ??= boss.start().then(() => undefined);
  return pronto;
}

export async function enfileirar<F extends Fila>(fila: F, dados: PayloadFila[F], opcoes: PgBoss.SendOptions = {}) {
  await iniciar();
  await boss.send(fila, dados as object, { retryLimit: 5, retryBackoff: true, ...opcoes });
}

export const pararFila = () => boss.stop({ graceful: true });
