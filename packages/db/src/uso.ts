import { Prisma } from '@prisma/client';
import { mesDe, PLANOS, type PlanoId } from '@trames/shared';
import type { Tx } from './index';

/*
 * Uso do mês: um contador por escritório e mês, atualizado de forma atômica
 * (INSERT ... ON CONFLICT). É contador, não contagem: apagar um balcão não
 * devolve a vaga do mês, e o excedente do Ultra não depende de ninguém olhar.
 */

/** Soma um balcão criado no mês e devolve quantos já foram criados (incluindo este). */
export async function contarBalcaoCriado(tx: Tx, organizacaoId: string, mes = mesDe()) {
  const [r] = await tx.$queryRaw<{ balcoes_criados: number }[]>(Prisma.sql`
    INSERT INTO uso_mensal (organizacao_id, mes, balcoes_criados) VALUES (${organizacaoId}::uuid, ${mes}, 1)
    ON CONFLICT (organizacao_id, mes) DO UPDATE SET balcoes_criados = uso_mensal.balcoes_criados + 1
    RETURNING balcoes_criados`);
  return r.balcoes_criados;
}

/**
 * Reserva uma mensagem de WhatsApp na cota do mês. Devolve false quando a cota
 * acabou: aí a mensagem vai por e-mail até o mês virar.
 */
export async function reservarWhatsapp(tx: Tx, organizacaoId: string, plano: PlanoId, mes = mesDe()) {
  const cota = PLANOS[plano].cotaWhatsapp;
  if (cota <= 0) return false;
  await tx.$executeRaw(Prisma.sql`INSERT INTO uso_mensal (organizacao_id, mes) VALUES (${organizacaoId}::uuid, ${mes}) ON CONFLICT DO NOTHING`);
  const n = await tx.$executeRaw(Prisma.sql`
    UPDATE uso_mensal SET whatsapp_enviados = whatsapp_enviados + 1
     WHERE organizacao_id = ${organizacaoId}::uuid AND mes = ${mes} AND whatsapp_enviados < ${cota}`);
  return n > 0;
}

/**
 * Marca um aviso do mês como enviado. Devolve true só para quem marcou primeiro,
 * para o mesmo aviso não sair duas vezes.
 */
export async function marcarAviso(tx: Tx, organizacaoId: string, campo: 'aviso_180_em' | 'aviso_200_em' | 'aviso_cota_whatsapp_em', mes = mesDe()) {
  await tx.$executeRaw(Prisma.sql`INSERT INTO uso_mensal (organizacao_id, mes) VALUES (${organizacaoId}::uuid, ${mes}) ON CONFLICT DO NOTHING`);
  const n = await tx.$executeRaw(
    Prisma.sql`UPDATE uso_mensal SET ${Prisma.raw(campo)} = now() WHERE organizacao_id = ${organizacaoId}::uuid AND mes = ${mes} AND ${Prisma.raw(campo)} IS NULL`,
  );
  return n > 0;
}

export async function planoDe(tx: Tx, organizacaoId: string): Promise<PlanoId> {
  const a = await tx.assinatura.findFirst({ where: { organizacaoId, status: 'ativa' }, orderBy: { inicioEm: 'desc' } });
  return a?.plano ?? 'gratis';
}
