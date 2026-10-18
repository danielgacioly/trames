import { prisma } from '@trames/db';
import { criarApp } from './app';
import { config } from './infra/config';
import { pararFila } from './infra/fila';
import { log } from './infra/logger';

const servidor = criarApp().listen(config.PORTA_API, () => log.info({ porta: config.PORTA_API }, 'API no ar'));

async function encerrar() {
  servidor.close();
  await Promise.allSettled([pararFila(), prisma.$disconnect()]);
  process.exit(0);
}
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
