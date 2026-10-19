/*
 * Desenvolvimento: mostra as últimas mensagens que "sairiam" por e-mail ou WhatsApp.
 *   pnpm caixa        (as 10 últimas)
 *   pnpm caixa 30     (as 30 últimas)
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const n = Number(process.argv[2] ?? 10);
const msgs = await db.caixaSaidaDev.findMany({ orderBy: { criadaEm: 'desc' }, take: n });
for (const m of msgs.reverse()) {
  console.log(`\n── ${m.criadaEm.toLocaleString('pt-BR')} · ${m.canal} · ${m.destino}`);
  console.log(m.texto);
}
if (!msgs.length) console.log('Caixa de saída vazia.');
await db.$disconnect();
