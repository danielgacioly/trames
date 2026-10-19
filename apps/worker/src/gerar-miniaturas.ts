/*
 * Gera as miniaturas que faltam (arquivos do seed ou de antes desta versão).
 * Roda depois do seed: pnpm db:seed já chama. Usa o papel da aplicação (RLS).
 */
import { naOrganizacao, prisma, todasAsOrganizacoes } from '@trames/db';
import { baixar, BUCKET_DOCUMENTOS, chaveMiniatura, enviar } from '@trames/db/armazenamento';
import { gerarMiniatura } from './miniatura';

let feitas = 0;
for (const org of await todasAsOrganizacoes()) {
  const docs = await naOrganizacao(org, (tx) => tx.documento.findMany({ where: { status: 'disponivel', chaveMiniatura: null } }));
  for (const d of docs) {
    const corpo = await gerarMiniatura(await baixar(BUCKET_DOCUMENTOS, d.chave), d.tipoReal ?? d.tipoDeclarado);
    if (!corpo) continue;
    const chave = chaveMiniatura(org, d.id);
    await enviar(BUCKET_DOCUMENTOS, chave, corpo, 'image/webp');
    await naOrganizacao(org, (tx) => tx.documento.update({ where: { id: d.id }, data: { chaveMiniatura: chave } }));
    feitas++;
  }
}
await prisma.$disconnect();
console.log(`Miniaturas geradas: ${feitas}.`);
