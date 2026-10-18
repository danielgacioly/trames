/*
 * Instala o schema do pg-boss e cria as filas. Roda com o papel dono, no deploy,
 * depois das migrações (pnpm fila:instalar). A API e o worker conectam como
 * trames_app e não mexem na estrutura.
 */
import PgBoss from 'pg-boss';
import { FILAS } from '@trames/shared/filas';

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL_DONO, schema: 'pgboss', supervise: false, schedule: false });
await boss.start();
for (const f of FILAS) if (!(await boss.getQueue(f))) await boss.createQueue(f);
await boss.stop({ graceful: false });
console.log('Fila pronta.');
