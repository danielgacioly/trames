import pino from 'pino';

/** Mesmo cuidado da API: nada de dado pessoal no log (só ids, contagens e nomes de erro). */
export const log = pino({ level: process.env.NIVEL_LOG ?? 'info', base: { proc: 'worker' } });
