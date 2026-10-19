import { Prisma, PrismaClient } from '@prisma/client';

export * from '@prisma/client';
export * from './cripto';

/**
 * Cliente do Prisma conectado com o papel trames_app, que NÃO é dono das tabelas:
 * para ele o Row-Level Security vale sempre.
 */
export const prisma = new PrismaClient();

export type Tx = Prisma.TransactionClient;

const definirOrganizacao = (organizacaoId: string) => Prisma.sql`SELECT set_config('app.organizacao_id', ${organizacaoId}, TRUE)`;

/**
 * Roda fn numa transação com o escritório definido. É o jeito de fazer várias
 * operações seguidas; o RLS limita tudo ao organizacao_id dado.
 */
export function naOrganizacao<T>(organizacaoId: string, fn: (tx: Tx) => Promise<T>, opcoes?: { timeout?: number }) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(definirOrganizacao(organizacaoId));
      return fn(tx);
    },
    { timeout: opcoes?.timeout ?? 10_000 },
  );
}

/**
 * Extensão do client: cada operação roda numa transação curta que antes define
 * o organizacao_id da sessão (set_config ... TRUE vale só para a transação).
 * O Prisma não tem RLS nativo; é este o padrão recomendado.
 */
export function prismaDaOrganizacao(organizacaoId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, resultado] = await prisma.$transaction([prisma.$executeRaw(definirOrganizacao(organizacaoId)), query(args)]);
          return resultado;
        },
      },
    },
  });
}

/*
 * Buscas que acontecem ANTES de saber o escritório (login, cookie de sessão,
 * link do cliente). São funções SECURITY DEFINER no banco que devolvem só o
 * mínimo para em seguida abrir a transação no escritório certo.
 */

export interface UsuarioParaLogin {
  id: string;
  organizacao_id: string;
  senha_hash: string | null;
  permissao: 'admin' | 'monta' | 'confere';
}

export async function usuarioParaLogin(email: string) {
  const r = await prisma.$queryRaw<UsuarioParaLogin[]>`SELECT * FROM auth_usuario_por_email(${email})`;
  return r[0] ?? null;
}

export async function sessaoPorToken(tokenHash: string) {
  const r = await prisma.$queryRaw<{ id: string; organizacao_id: string; usuario_id: string; segundo_fator: boolean; expira_em: Date }[]>`
    SELECT * FROM auth_sessao(${tokenHash})`;
  return r[0] ?? null;
}

export async function convitePorToken(tokenHash: string) {
  const r = await prisma.$queryRaw<{ usuario_id: string; organizacao_id: string; expira_em: Date | null }[]>`SELECT * FROM auth_convite(${tokenHash})`;
  return r[0] ?? null;
}

export async function linkPorToken(tokenHash: string) {
  const r = await prisma.$queryRaw<{ id: string; organizacao_id: string; balcao_id: string; expira_em: Date; revogado_em: Date | null }[]>`
    SELECT * FROM acesso_link(${tokenHash})`;
  return r[0] ?? null;
}

export async function sessaoClientePorToken(tokenHash: string) {
  const r = await prisma.$queryRaw<{ id: string; organizacao_id: string; balcao_id: string; link_id: string; expira_em: Date }[]>`
    SELECT * FROM acesso_sessao_cliente(${tokenHash})`;
  return r[0] ?? null;
}

/** Para os jobs do worker que passam por todos os escritórios, um de cada vez. */
export async function todasAsOrganizacoes() {
  const r = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM worker_organizacoes()`;
  return r.map((x) => x.id);
}
export * from './dados-cliente';
export * from './uso';
