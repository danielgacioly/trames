import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { abrir, convitePorToken, hashToken, naOrganizacao, novoToken, selar, sessaoPorToken, usuarioParaLogin, type Tx } from '@trames/db';
import { CONTAS_TESTE } from '@trames/db/contas-teste';
import { AceitarConviteEntrada, CodigoTotpEntrada, CriarContaEntrada, EntrarEntrada, type EtapaSessao, type Eu, type PlanoId } from '@trames/shared';
import { emDesenvolvimento } from '../../infra/config';
import { COOKIE_EMPRESA, definirCookie, limparCookie } from '../../infra/cookies';
import { ErroHttp } from '../../infra/erros';
import { ipDe, limites, rota, validar } from '../../infra/http';
import { kms } from '../../infra/kms';
import { auditarComo } from '../auditoria/auditoria';

const VALIDADE_SESSAO_MS = 12 * 60 * 60 * 1000;
const ARGON = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
/** Usado quando o e-mail não existe, para o tempo de resposta não revelar isso. */
const HASH_FALSO = argon2.hash('senha-que-nao-existe', ARGON);

authenticator.options = { window: 1 };

export const hashSenha = (senha: string) => argon2.hash(senha, ARGON);

export async function planoAtual(tx: Tx, organizacaoId: string): Promise<PlanoId> {
  const a = await tx.assinatura.findFirst({ where: { organizacaoId, status: 'ativa' }, orderBy: { inicioEm: 'desc' } });
  return a?.plano ?? 'gratis';
}

/** 2FA é obrigatório para quem administra o escritório; para os outros, vale se estiver ativado. */
function etapaDe(u: { permissao: string; totpAtivo: boolean }, segundoFator: boolean): EtapaSessao {
  if (u.totpAtivo) return segundoFator ? 'completa' : 'verificar_2fa';
  return u.permissao === 'admin' ? 'configurar_2fa' : 'completa';
}

async function abrirSessao(tx: Tx, res: Response, organizacaoId: string, usuarioId: string) {
  const { token, hash } = novoToken();
  await tx.sessao.create({ data: { organizacaoId, usuarioId, tokenHash: hash, expiraEm: new Date(Date.now() + VALIDADE_SESSAO_MS) } });
  definirCookie(res, COOKIE_EMPRESA, token, VALIDADE_SESSAO_MS);
}

/** Lê o cookie e carrega usuário, escritório e plano. Não exige que o login esteja completo. */
async function carregarSessao(req: Request) {
  const token = req.cookies?.[COOKIE_EMPRESA];
  if (typeof token !== 'string' || !token) return null;
  const s = await sessaoPorToken(hashToken(token));
  if (!s) return null;
  return naOrganizacao(s.organizacao_id, async (tx) => {
    const usuario = await tx.usuario.findUnique({ where: { id: s.usuario_id } });
    const organizacao = await tx.organizacao.findUnique({ where: { id: s.organizacao_id } });
    if (!usuario || !organizacao) return null;
    return { sessaoId: s.id, usuario, organizacao, plano: await planoAtual(tx, organizacao.id), etapa: etapaDe(usuario, s.segundo_fator) };
  });
}

/** Exige login completo (senha + 2FA quando for o caso). */
export async function exigirEmpresa(req: Request, _res: Response, next: NextFunction) {
  try {
    const s = await carregarSessao(req);
    if (!s) throw new ErroHttp(401, 'Entre na sua conta.', 'sem_sessao');
    if (s.etapa !== 'completa') throw new ErroHttp(401, 'Confirme o código do autenticador.', s.etapa);
    req.empresa = s;
    next();
  } catch (e) {
    next(e);
  }
}

async function exigirSessaoParcial(req: Request) {
  const s = await carregarSessao(req);
  if (!s) throw new ErroHttp(401, 'Entre na sua conta.', 'sem_sessao');
  return s;
}

function eu(s: NonNullable<Awaited<ReturnType<typeof carregarSessao>>>): Eu {
  const { usuario: u, organizacao: o } = s;
  return {
    usuario: { id: u.id, nome: u.nome, email: u.email, permissao: u.permissao, totpAtivo: u.totpAtivo },
    organizacao: { id: o.id, nome: o.nome, sigla: o.sigla, cor: o.cor, area: o.area, diasRetencao: o.diasRetencao },
    plano: s.plano,
    etapa: s.etapa,
  };
}

function siglaDe(nome: string) {
  const s = nome
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return s || 'TR';
}

export const rotasAuth = Router();

rotasAuth.post(
  '/entrar',
  limites.login,
  rota(async (req, res) => {
    const { email, senha } = validar(EntrarEntrada, req.body);
    const u = await usuarioParaLogin(email);
    const ok = u?.senha_hash ? await argon2.verify(u.senha_hash, senha) : (await argon2.verify(await HASH_FALSO, senha), false);
    if (!u || !ok) {
      if (u) await naOrganizacao(u.organizacao_id, (tx) => auditarComo(tx, u.organizacao_id, 'usuario', u.id, ipDe(req), { acao: 'login.falhou', alvoTipo: 'usuario', alvoId: u.id }));
      throw new ErroHttp(401, 'E-mail ou senha não conferem.');
    }
    await naOrganizacao(u.organizacao_id, async (tx) => {
      await abrirSessao(tx, res, u.organizacao_id, u.id);
      await auditarComo(tx, u.organizacao_id, 'usuario', u.id, ipDe(req), { acao: 'login.senha', alvoTipo: 'usuario', alvoId: u.id });
    });
    res.json({ etapa: etapaDe({ permissao: u.permissao, totpAtivo: u.totp_ativo }, false) });
  }),
);

rotasAuth.get(
  '/eu',
  rota(async (req, res) => {
    const s = await carregarSessao(req);
    if (!s) throw new ErroHttp(401, 'Entre na sua conta.', 'sem_sessao');
    res.json(eu(s));
  }),
);

rotasAuth.post(
  '/sair',
  rota(async (req, res) => {
    const s = await carregarSessao(req);
    if (s) await naOrganizacao(s.organizacao.id, (tx) => tx.sessao.delete({ where: { id: s.sessaoId } }));
    limparCookie(res, COOKIE_EMPRESA);
    res.status(204).end();
  }),
);

rotasAuth.post(
  '/criar-conta',
  limites.login,
  rota(async (req, res) => {
    const d = validar(CriarContaEntrada, req.body);
    if (await usuarioParaLogin(d.email)) throw new ErroHttp(409, 'Já existe uma conta com este e-mail.');
    const organizacaoId = randomUUID();
    const senhaHash = await hashSenha(d.senha);
    await naOrganizacao(organizacaoId, async (tx) => {
      await tx.organizacao.create({ data: { id: organizacaoId, nome: d.escritorio, sigla: siglaDe(d.escritorio), assinaturas: { create: { plano: 'gratis' } } } });
      const u = await tx.usuario.create({ data: { organizacaoId, nome: d.nome, email: d.email, senhaHash, permissao: 'admin' } });
      await abrirSessao(tx, res, organizacaoId, u.id);
      await auditarComo(tx, organizacaoId, 'usuario', u.id, ipDe(req), { acao: 'conta.criada', alvoTipo: 'organizacao', alvoId: organizacaoId });
    });
    res.status(201).json({ etapa: 'configurar_2fa' satisfies EtapaSessao });
  }),
);

/* ---------- 2FA (TOTP) ---------- */

rotasAuth.post(
  '/2fa/iniciar',
  rota(async (req, res) => {
    const s = await exigirSessaoParcial(req);
    if (s.usuario.totpAtivo) throw new ErroHttp(400, 'O autenticador já está ativado.');
    const segredo = authenticator.generateSecret();
    const selado = await selar(kms, segredo, `totp:${s.usuario.id}`);
    await naOrganizacao(s.organizacao.id, (tx) => tx.usuario.update({ where: { id: s.usuario.id }, data: { totpCifrado: selado } }));
    const otpauth = authenticator.keyuri(s.usuario.email, 'Trames', segredo);
    res.json({ segredo, otpauth, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) });
  }),
);

async function conferirTotp(usuario: { id: string; totpCifrado: Uint8Array | null }, codigo: string) {
  if (!usuario.totpCifrado) return false;
  const segredo = await abrir(kms, Buffer.from(usuario.totpCifrado), `totp:${usuario.id}`);
  return authenticator.check(codigo, segredo);
}

rotasAuth.post(
  '/2fa/confirmar',
  limites.segundoFator,
  rota(async (req, res) => {
    const s = await exigirSessaoParcial(req);
    const { codigo } = validar(CodigoTotpEntrada, req.body);
    if (s.usuario.totpAtivo || !(await conferirTotp(s.usuario, codigo))) throw new ErroHttp(400, 'Código errado. Confira o app autenticador.');
    await naOrganizacao(s.organizacao.id, async (tx) => {
      await tx.usuario.update({ where: { id: s.usuario.id }, data: { totpAtivo: true } });
      await tx.sessao.update({ where: { id: s.sessaoId }, data: { segundoFator: true } });
      await auditarComo(tx, s.organizacao.id, 'usuario', s.usuario.id, ipDe(req), { acao: '2fa.ativado', alvoTipo: 'usuario', alvoId: s.usuario.id });
    });
    res.json({ etapa: 'completa' });
  }),
);

rotasAuth.post(
  '/2fa/verificar',
  limites.segundoFator,
  rota(async (req, res) => {
    const s = await exigirSessaoParcial(req);
    const { codigo } = validar(CodigoTotpEntrada, req.body);
    if (!s.usuario.totpAtivo || !(await conferirTotp(s.usuario, codigo))) throw new ErroHttp(400, 'Código errado. Confira o app autenticador.');
    await naOrganizacao(s.organizacao.id, async (tx) => {
      await tx.sessao.update({ where: { id: s.sessaoId }, data: { segundoFator: true } });
      await auditarComo(tx, s.organizacao.id, 'usuario', s.usuario.id, ipDe(req), { acao: 'login.segundo_fator', alvoTipo: 'usuario', alvoId: s.usuario.id });
    });
    res.json({ etapa: 'completa' });
  }),
);

/* ---------- Convite de equipe ---------- */

rotasAuth.get(
  '/convite/:token',
  rota(async (req, res) => {
    const c = await convitePorToken(hashToken(req.params.token));
    if (!c || !c.expira_em || c.expira_em < new Date()) throw new ErroHttp(404, 'Este convite não vale mais. Peça um novo a quem administra a conta.');
    const dados = await naOrganizacao(c.organizacao_id, async (tx) => {
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: c.usuario_id } });
      const o = await tx.organizacao.findUniqueOrThrow({ where: { id: c.organizacao_id } });
      return { nome: u.nome, email: u.email, organizacao: o.nome };
    });
    res.json(dados);
  }),
);

rotasAuth.post(
  '/convite/:token',
  limites.login,
  rota(async (req, res) => {
    const { senha } = validar(AceitarConviteEntrada, req.body);
    const c = await convitePorToken(hashToken(req.params.token));
    if (!c || !c.expira_em || c.expira_em < new Date()) throw new ErroHttp(404, 'Este convite não vale mais.');
    const senhaHash = await hashSenha(senha);
    const etapa = await naOrganizacao(c.organizacao_id, async (tx) => {
      const u = await tx.usuario.update({ where: { id: c.usuario_id }, data: { senhaHash, conviteHash: null, conviteExpiraEm: null } });
      await abrirSessao(tx, res, c.organizacao_id, u.id);
      return etapaDe(u, false);
    });
    res.json({ etapa });
  }),
);

/* ---------- Ajuda de desenvolvimento ---------- */

if (emDesenvolvimento) {
  /** Código TOTP atual das contas de teste (os segredos delas são públicos de propósito). */
  rotasAuth.get('/dev/totp/:email', (req, res) => {
    const conta = CONTAS_TESTE.find((c) => c.email === req.params.email);
    if (!conta) return res.status(404).json({ erro: 'Só para as contas de teste.' });
    res.json({ codigo: authenticator.generate(conta.totp) });
  });
}

