/*
 * Testes de integração contra o banco de desenvolvimento (rode `pnpm db:seed` antes).
 * Conferem as barreiras que não podem falhar: isolamento entre escritórios,
 * limites de plano, origem das requisições e auditoria só de inclusão.
 */
import request from 'supertest';
import { authenticator } from 'otplib';
import { describe, expect, it } from 'vitest';
import { prisma, usuarioParaLogin } from '@trames/db';
import { CONTAS_TESTE, SENHA_TESTE } from '@trames/db/contas-teste';
import { criarApp } from '../src/app';

const app = criarApp();
const ORIGEM = process.env.URL_WEB!;

async function entrar(plano: 0 | 1 | 2) {
  const agente = request.agent(app);
  const conta = CONTAS_TESTE[plano];
  await agente.post('/api/auth/entrar').set('origin', ORIGEM).send({ email: conta.email, senha: SENHA_TESTE }).expect(200);
  await agente.post('/api/auth/2fa/verificar').set('origin', ORIGEM).send({ codigo: authenticator.generate(conta.totp) }).expect(200);
  return agente;
}

describe('segurança', () => {
  it('não entra sem o segundo fator', async () => {
    const a = request.agent(app);
    await a.post('/api/auth/entrar').set('origin', ORIGEM).send({ email: CONTAS_TESTE[1].email, senha: SENHA_TESTE }).expect(200);
    await a.get('/api/balcoes').expect(401);
  });

  it('um escritório não enxerga balcão de outro', async () => {
    const pro = await entrar(1);
    const ultra = await entrar(2);
    const [balcaoUltra] = (await ultra.get('/api/balcoes').expect(200)).body;
    await pro.get(`/api/balcoes/${balcaoUltra.id}`).expect(404);
    const listaPro = (await pro.get('/api/balcoes').expect(200)).body as { id: string }[];
    expect(listaPro.some((b) => b.id === balcaoUltra.id)).toBe(false);
  });

  it('sem organizacao_id definido, o banco não devolve nada (RLS)', async () => {
    expect(await prisma.balcao.count()).toBe(0);
    expect(await prisma.cliente.count()).toBe(0);
  });

  it('recusa requisição que muda estado vinda de outra origem', async () => {
    const pro = await entrar(1);
    await pro.post('/api/balcoes').set('origin', 'https://site-malicioso.com').send({}).expect(403);
  });

  it('recursos fora do plano dão 402', async () => {
    const gratis = await entrar(0);
    await gratis.post('/api/turu').set('origin', ORIGEM).send({ mensagens: [{ de: 'eu', texto: 'inventário' }], lista: null }).expect(402);
    await gratis.get('/api/relatorio').expect(402);
    const pro = await entrar(1);
    await pro.get('/api/relatorio').expect(402);
  });

  it('auditoria é só de inclusão', async () => {
    const u = await usuarioParaLogin(CONTAS_TESTE[1].email);
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.organizacao_id', ${u!.organizacao_id}, TRUE)`;
        await tx.$executeRaw`UPDATE eventos_auditoria SET acao = 'x'`;
      }),
    ).rejects.toThrow();
  });

  it('logs de acesso não levam o token do link', async () => {
    const r = await request(app).get('/api/acesso').set('x-link', 'a'.repeat(43)).expect(404);
    expect(r.body.codigo).toBe('link_invalido');
  });
});
