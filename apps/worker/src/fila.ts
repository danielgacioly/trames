import type PgBoss from 'pg-boss';
import type { Fila, PayloadFila } from '@trames/shared/filas';

export type Enfileirar = <F extends Fila>(fila: F, dados: PayloadFila[F]) => Promise<unknown>;

export const criarEnfileirar =
  (boss: PgBoss): Enfileirar =>
  (fila, dados) =>
    boss.send(fila, dados as object, { retryLimit: 5, retryBackoff: true });
