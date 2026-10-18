import { connect } from 'node:net';

/*
 * Antivírus pelo clamd (protocolo INSTREAM). Em produção o clamd roda ao lado do
 * worker, com as assinaturas atualizadas pelo freshclam. Se o clamd não responde,
 * o job falha e é tentado de novo: arquivo nunca sai da quarentena sem passar aqui.
 */

const HOST = process.env.CLAMD_HOST ?? '127.0.0.1';
const PORTA = Number(process.env.CLAMD_PORTA ?? 3310);
const PEDACO = 64 * 1024;

export function escanear(arquivo: Buffer): Promise<{ limpo: true } | { limpo: false; ameaca: string }> {
  return new Promise((resolve, reject) => {
    const s = connect(PORTA, HOST);
    const resposta: Buffer[] = [];
    s.setTimeout(60_000, () => s.destroy(new Error('clamd não respondeu')));
    s.on('error', reject);
    s.on('data', (d) => resposta.push(d));
    s.on('end', () => {
      const r = Buffer.concat(resposta).toString('utf8').replace(/\0/g, '').trim();
      if (r.endsWith('OK')) return resolve({ limpo: true });
      const achou = r.match(/stream: (.+) FOUND/);
      if (achou) return resolve({ limpo: false, ameaca: achou[1] });
      reject(new Error(`clamd: resposta inesperada`));
    });
    s.on('connect', () => {
      s.write('zINSTREAM\0');
      for (let i = 0; i < arquivo.length; i += PEDACO) {
        const pedaco = arquivo.subarray(i, i + PEDACO);
        const tam = Buffer.alloc(4);
        tam.writeUInt32BE(pedaco.length);
        s.write(tam);
        s.write(pedaco);
      }
      s.end(Buffer.alloc(4));
    });
  });
}
