import PgBoss from 'pg-boss';
import { prisma } from '@trames/db';
import type { PayloadFila } from '@trames/shared/filas';
import { criarEnfileirar } from './fila';
import { apagarArquivos, verificarDocumento } from './jobs/documentos';
import { enviarMensagem } from './jobs/mensagens';
import { expirar, lembretes, retencao } from './jobs/rotinas';
import { log } from './log';

/*
 * Worker: tudo o que é pesado ou demorado sai da API e roda aqui.
 * Fila pg-boss no próprio Postgres (decisão: pg-boss no começo; dá para trocar por BullMQ depois).
 */
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: 'pgboss', migrate: false });
boss.on('error', (e) => log.error({ erro: e.name }, 'pg-boss'));

await boss.start();
const enfileirar = criarEnfileirar(boss);

function trabalhar<F extends keyof PayloadFila>(fila: F, fn: (dados: PayloadFila[F]) => Promise<unknown>, opcoes: PgBoss.WorkOptions = {}) {
  return boss.work<PayloadFila[F]>(fila, opcoes, async (jobs) => {
    for (const job of jobs) {
      try {
        await fn(job.data);
      } catch (e) {
        log.error({ fila, job: job.id, erro: (e as Error).name }, 'job falhou');
        throw e; // pg-boss tenta de novo
      }
    }
  });
}

await trabalhar('verificar-documento', verificarDocumento, { batchSize: 2 });
await trabalhar('enviar-mensagem', enviarMensagem, { batchSize: 5 });
await trabalhar('apagar-arquivos', apagarArquivos);
await trabalhar('lembretes', () => lembretes(enfileirar));
await trabalhar('expirar', expirar);
await trabalhar('retencao', retencao);

// Horários em Brasília
await boss.schedule('lembretes', '0 10 * * *', {}, { tz: 'America/Recife' });
await boss.schedule('expirar', '15 * * * *', {}, { tz: 'America/Recife' });
await boss.schedule('retencao', '30 3 * * *', {}, { tz: 'America/Recife' });

log.info('worker no ar');

async function encerrar() {
  await boss.stop({ graceful: true });
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
