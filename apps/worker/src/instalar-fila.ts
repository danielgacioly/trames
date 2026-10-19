/*
 * Instala o schema do pg-boss e cria as filas. Roda com o papel dono, no deploy,
 * depois das migrações (pnpm fila:instalar). A API e o worker conectam como
 * trames_app e não mexem na estrutura.
 */
import PgBoss from 'pg-boss';
import { FILAS } from '@trames/shared/filas';

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL_DONO, schema: 'pgboss', supervise: false, schedule: false });
await boss.start();
// avisar-mudanca é stately: com um aviso esperando, os pedidos seguintes do mesmo balcão entram nele.
const POLITICA: Partial<Record<(typeof FILAS)[number], PgBoss.QueuePolicy>> = { 'avisar-mudanca': 'stately' };
for (const f of FILAS) if (!(await boss.getQueue(f))) await boss.createQueue(f, { name: f, policy: POLITICA[f] ?? 'standard' });
await boss.stop({ graceful: false });
console.log('Fila pronta.');
