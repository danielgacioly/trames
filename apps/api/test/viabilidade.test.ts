/*
 * Regras de docs/viabilidade.md: excedente do Ultra, canais por plano, sessão
 * de 30 dias do cliente por balcão, edição da lista e retenção por plano.
 * Rodam contra o banco de desenvolvimento (pnpm db:seed antes) e apagam o que criam.
 */
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { abrir, criarKms, PrismaClient, prisma, usuarioParaLogin } from '@trames/db';
import { CONTAS_TESTE, SENHA_TESTE } from '@trames/db/contas-teste';
import { mesDe } from '@trames/shared';
import { criarApp } from '../src/app';

const app = criarApp();
const ORIGEM = process.env.URL_WEB!;
const kms = criarKms();
/** Dono do banco, só para preparar e limpar (ignora o RLS). */
const dono = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_DONO });
const criados: string[] = [];
/** Os balcões criados aqui somam no contador do mês: guarda e devolve o valor de antes. */
const usoAntes = await dono.usoMensal.findMany({ where: { mes: mesDe() } });

afterAll(async () => {
  if (criados.length) await dono.balcao.deleteMany({ where: { id: { in: criados } } });
  for (const u of usoAntes) await dono.usoMensal.update({ where: { organizacaoId_mes: { organizacaoId: u.organizacaoId, mes: u.mes } }, data: { balcoesCriados: u.balcoesCriados } });
  await dono.$disconnect();
});

async function ultimoSelado<T>(filtro: { tipo: string; campo: 'usuarioId' | 'balcaoId'; valor: string }, org: string): Promise<T> {
  const [job] = await prisma.$queryRaw<{ data: { selado: string } }[]>`
    SELECT data FROM pgboss.job WHERE name = 'enviar-mensagem' AND data->>'tipo' = ${filtro.tipo} AND data->>${filtro.campo} = ${filtro.valor}
    ORDER BY created_on DESC LIMIT 1`;
  return JSON.parse(await abrir(kms, Buffer.from(job.data.selado, 'base64'), `fila:${org}`)) as T;
}

async function entrar(plano: 0 | 1 | 2) {
  const agente = request.agent(app);
  const conta = CONTAS_TESTE[plano];
  const u = (await usuarioParaLogin(conta.email))!;
  await agente.post('/api/auth/entrar').set('origin', ORIGEM).send({ email: conta.email, senha: SENHA_TESTE }).expect(200);
  const { codigo } = await ultimoSelado<{ codigo: string }>({ tipo: 'login', campo: 'usuarioId', valor: u.id }, u.organizacao_id);
  await agente.post('/api/auth/2fa/verificar').set('origin', ORIGEM).send({ codigo }).expect(200);
  return { agente, org: u.organizacao_id };
}

const novoBalcao = (extra: Record<string, unknown> = {}) => ({
  cliente: { nome: 'Teste Automático', whatsapp: '81990000001', email: 'teste@exemplo.com' },
  prazo: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
  itens: [
    { nome: 'RG', detalhe: '', obrigatorio: true },
    { nome: 'Comprovante de residência', detalhe: '', obrigatorio: true },
  ],
  ...extra,
});

async function criar(agente: request.Agent, extra: Record<string, unknown> = {}) {
  const r = await agente.post('/api/balcoes').set('origin', ORIGEM).send(novoBalcao(extra)).expect(201);
  criados.push(r.body.id);
  return r.body as { id: string; link: { url: string }; excedente: boolean };
}

describe('planos e canais', () => {
  it('Grátis: código só por e-mail; sem e-mail do cliente, não cria', async () => {
    const { agente } = await entrar(0);
    // Nenhum dos dois pedidos chega a criar balcão.
    await agente.post('/api/balcoes').set('origin', ORIGEM).send(novoBalcao({ canalCodigo: 'whatsapp' })).expect(402);
    const r = await agente.post('/api/balcoes').set('origin', ORIGEM).send(novoBalcao({ cliente: { nome: 'Sem Email', whatsapp: '81990000002', email: '' } }));
    expect(r.status).toBe(400);
  });

  it('Ultra: além dos 200 do mês, o balcão é excedente e vira item de cobrança', async () => {
    const { agente, org } = await entrar(2);
    const mes = mesDe();
    const antes = await dono.usoMensal.findUnique({ where: { organizacaoId_mes: { organizacaoId: org, mes } } });
    await dono.usoMensal.upsert({ where: { organizacaoId_mes: { organizacaoId: org, mes } }, update: { balcoesCriados: 200 }, create: { organizacaoId: org, mes, balcoesCriados: 200 } });
    try {
      const b = await criar(agente);
      expect(b.excedente).toBe(true);
      const item = await dono.itemCobranca.findFirst({ where: { organizacaoId: org, balcaoId: b.id } });
      expect(item?.valorCentavos).toBe(100);
      expect(item?.mesReferencia).toBe(mes);
      const uso = (await agente.get('/api/cobranca').expect(200)).body;
      expect(uso.balcoesNoMes).toBe(201);
      // Apagar o balcão não devolve a vaga do mês nem o excedente.
      await dono.balcao.delete({ where: { id: b.id } });
      expect((await dono.usoMensal.findUnique({ where: { organizacaoId_mes: { organizacaoId: org, mes } } }))?.balcoesCriados).toBe(201);
      expect(await dono.itemCobranca.count({ where: { organizacaoId: org, balcaoId: b.id } })).toBe(1);
      await dono.itemCobranca.deleteMany({ where: { balcaoId: b.id } });
    } finally {
      await dono.usoMensal.update({ where: { organizacaoId_mes: { organizacaoId: org, mes } }, data: { balcoesCriados: antes?.balcoesCriados ?? 0, aviso200Em: antes?.aviso200Em ?? null } });
    }
  });
});

describe('acesso do cliente', () => {
  it('sessão de 30 dias vale só para aquele balcão e cai quando o escritório encerra ou conclui', async () => {
    const { agente, org } = await entrar(1);
    const b1 = await criar(agente);
    const b2 = await criar(agente);
    const token1 = b1.link.url.split('#')[1];
    const token2 = b2.link.url.split('#')[1];
    const cliente = request.agent(app);

    await cliente.post('/api/acesso/codigo').set('origin', ORIGEM).set('x-link', token1).send({}).expect(202);
    const { codigo } = await ultimoSelado<{ codigo: string }>({ tipo: 'codigo', campo: 'balcaoId', valor: b1.id }, org);
    const entrou = await cliente.post('/api/acesso/entrar').set('origin', ORIGEM).set('x-link', token1).send({ codigo }).expect(200);
    const cookie = String(entrou.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Max-Age=2592000/);

    await cliente.get('/api/cliente/balcao').set('x-link', token1).expect(200);
    // O mesmo aparelho, com o link de outro balcão, não entra.
    await cliente.get('/api/cliente/balcao').set('x-link', token2).expect(401);

    // Lembrete leva o mesmo link: a sessão continua.
    await agente.post(`/api/balcoes/${b1.id}/lembrar`).set('origin', ORIGEM).expect(202);
    expect((await agente.get(`/api/balcoes/${b1.id}/link`).expect(200)).body.url).toBe(b1.link.url);
    await cliente.get('/api/cliente/balcao').set('x-link', token1).expect(200);

    await agente.delete(`/api/balcoes/${b1.id}/sessoes`).set('origin', ORIGEM).expect(204);
    await cliente.get('/api/cliente/balcao').set('x-link', token1).expect(401);

    // Link novo derruba o antigo.
    const novo = (await agente.post(`/api/balcoes/${b2.id}/link`).set('origin', ORIGEM).expect(200)).body.url as string;
    expect(novo).not.toBe(b2.link.url);
    await cliente.get('/api/acesso').set('x-link', token2).expect(410);
  });
});

describe('editar a lista', () => {
  it('adiciona, edita, pede de novo, reordena e remove com as regras do documento', async () => {
    const { agente } = await entrar(1);
    const b = await criar(agente);
    const det = async () => (await agente.get(`/api/balcoes/${b.id}`).expect(200)).body as { itens: { id: string; nome: string; status: string }[]; contagem: { total: number } };

    const { ids } = (await agente.post(`/api/balcoes/${b.id}/itens`).set('origin', ORIGEM).send({ itens: [{ nome: 'Certidão de casamento', detalhe: '', obrigatorio: false }] }).expect(201)).body;
    expect((await det()).contagem.total).toBe(3);

    await agente.patch(`/api/itens/${ids[0]}`).set('origin', ORIGEM).send({ nome: 'Certidão de casamento atualizada' }).expect(204);
    const ev = await dono.eventoAuditoria.findFirst({ where: { acao: 'item.editado', alvoId: ids[0] } });
    expect(ev?.detalhes).toMatchObject({ antes: { nome: 'Certidão de casamento' }, depois: { nome: 'Certidão de casamento atualizada' } });

    const atuais = (await det()).itens.map((i) => i.id);
    await agente.put(`/api/balcoes/${b.id}/ordem`).set('origin', ORIGEM).send({ ids: [...atuais].reverse() }).expect(204);
    expect((await det()).itens.map((i) => i.id)).toEqual([...atuais].reverse());

    // Item com arquivo: remover pede confirmação.
    const [primeiro] = atuais;
    const doc = await dono.documento.create({
      data: { organizacaoId: (await dono.balcao.findUniqueOrThrow({ where: { id: b.id } })).organizacaoId, balcaoId: b.id, itemId: primeiro, chave: `teste/${primeiro}`, nomeArquivo: 'rg.pdf', tipoDeclarado: 'application/pdf', tamanho: 10, status: 'disponivel' },
    });
    await dono.itemBalcao.update({ where: { id: primeiro }, data: { status: 'aprovado' } });
    await agente.patch(`/api/itens/${primeiro}`).set('origin', ORIGEM).send({ detalhe: 'Frente e verso' }).expect(204);
    expect((await det()).itens.find((i) => i.id === primeiro)?.status).toBe('aprovado'); // editar não muda o status

    await agente.patch(`/api/itens/${primeiro}`).set('origin', ORIGEM).send({ pedirDeNovo: true }).expect(204);
    const depois = (await agente.get(`/api/balcoes/${b.id}`).expect(200)).body.itens.find((i: { id: string }) => i.id === primeiro);
    expect(depois.status).toBe('pendente');
    expect(depois.documento).toBeNull();
    expect(depois.historico.map((h: { id: string }) => h.id)).toEqual([doc.id]);

    const r = await agente.delete(`/api/itens/${primeiro}`).set('origin', ORIGEM).expect(409);
    expect(r.body.codigo).toBe('confirmar');
    await agente.delete(`/api/itens/${primeiro}?confirmar=1`).set('origin', ORIGEM).expect(204);
    expect((await dono.documento.findUniqueOrThrow({ where: { id: doc.id } })).status).toBe('disponivel'); // não apaga na hora

    const restantes = (await det()).itens;
    await agente.delete(`/api/itens/${restantes[0].id}`).set('origin', ORIGEM).expect(204);
    const ultimo = await agente.delete(`/api/itens/${restantes[1].id}`).set('origin', ORIGEM).expect(400);
    expect(ultimo.body.codigo).toBe('ultimo_item');
  });

  it('balcão concluído não aceita edição e ganha a data de exclusão do plano', async () => {
    const { agente } = await entrar(1);
    const b = await criar(agente);
    await dono.itemBalcao.updateMany({ where: { balcaoId: b.id }, data: { status: 'aprovado' } });
    await agente.post(`/api/balcoes/${b.id}/concluir`).set('origin', ORIGEM).expect(204);
    const det = (await agente.get(`/api/balcoes/${b.id}`).expect(200)).body;
    const dias = Math.round((new Date(det.apagarArquivosEm).getTime() - new Date(det.concluidoEm).getTime()) / 86_400_000);
    expect(dias).toBe(90); // Pro
    await agente.post(`/api/balcoes/${b.id}/itens`).set('origin', ORIGEM).send({ itens: [{ nome: 'Outro', detalhe: '', obrigatorio: true }] }).expect(409);
    await agente.patch(`/api/itens/${det.itens[0].id}`).set('origin', ORIGEM).send({ nome: 'x' }).expect(409);
  });
});
