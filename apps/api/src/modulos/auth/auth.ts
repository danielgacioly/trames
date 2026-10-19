import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { convitePorToken, hashToken, hmacBusca, iguais, naOrganizacao, novoCodigoSeisDigitos, novoToken, sessaoPorToken, usuarioParaLogin, type Tx } from '@trames/db';
import { AceitarConviteEntrada, CodigoLoginEntrada, CriarContaEntrada, EntrarEntrada, TENTATIVAS_CODIGO, VALIDADE_CODIGO_MINUTOS, type EtapaSessao, type Eu, type PlanoId } from '@trames/shared';
import { config, emDesenvolvimento } from '../../infra/config';
import { COOKIE_EMPRESA, definirCookie, limparCookie } from '../../infra/cookies';
import { ErroHttp } from '../../infra/erros';
import { enfileirar } from '../../infra/fila';
import { ipDe, limites, rota, validar } from '../../infra/http';
import { selarConteudo } from '../acesso-cliente/links';
import { auditarComo } from '../auditoria/auditoria';

const VALIDADE_SESSAO_MS = 12 * 60 * 60 * 1000;
const ARGON = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
/** Usado quando o e-mail não existe, para o tempo de resposta não revelar isso. */
const HASH_FALSO = argon2.hash('senha-que-nao-existe', ARGON);

export const hashSenha = (senha: string) => argon2.hash(senha, ARGON);

export async function planoAtual(tx: Tx, organizacaoId: string): Promise<PlanoId> {
  return (await assinaturaAtual(tx, organizacaoId)).plano;
}

async function assinaturaAtual(tx: Tx, organizacaoId: string) {
  const a = await tx.assinatura.findFirst({ where: { organizacaoId, status: 'ativa' }, orderBy: { inicioEm: 'desc' } });
  return { plano: a?.plano ?? ('gratis' as PlanoId), periodicidade: a?.periodicidade ?? ('mensal' as const) };
}

/** Segundo fator para todo mundo: depois da senha, falta o código que chegou no e-mail. */
const etapaDe = (segundoFator: boolean): EtapaSessao => (segundoFator ? 'completa' : 'verificar_2fa');

/** O código de login é guardado na sessão como HMAC (chave secreta + id da sessão), nunca em claro. */
const hashCodigo = (sessaoId: string, codigo: string) => hmacBusca(config.CHAVE_HMAC, sessaoId, codigo);

/** Gera um código novo para a sessão (invalida o anterior) e devolve o código para ser enviado. */
async function novoCodigoLogin(tx: Tx, sessaoId: string) {
  const codigo = novoCodigoSeisDigitos();
  await tx.sessao.update({
    where: { id: sessaoId },
    data: { codigoHash: hashCodigo(sessaoId, codigo), codigoExpiraEm: new Date(Date.now() + VALIDADE_CODIGO_MINUTOS * 60_000), codigoTentativas: 0 },
  });
  return codigo;
}

/** Manda o código pelo worker. Fica fora da transação: só sai depois que a sessão foi gravada. */
async function enviarCodigoLogin(organizacaoId: string, usuarioId: string, codigo: string) {
  await enfileirar('enviar-mensagem', { organizacaoId, usuarioId, tipo: 'login', canal: 'email', selado: await selarConteudo(organizacaoId, { codigo }) });
}

/** Abre uma sessão ainda sem o segundo fator e já gera o código do e-mail. */
async function abrirSessao(tx: Tx, res: Response, organizacaoId: string, usuarioId: string) {
  const { token, hash } = novoToken();
  const sessao = await tx.sessao.create({ data: { organizacaoId, usuarioId, tokenHash: hash, expiraEm: new Date(Date.now() + VALIDADE_SESSAO_MS) } });
  definirCookie(res, COOKIE_EMPRESA, token, VALIDADE_SESSAO_MS);
  return novoCodigoLogin(tx, sessao.id);
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
    const a = await assinaturaAtual(tx, organizacao.id);
    return { sessaoId: s.id, usuario, organizacao, plano: a.plano, periodicidade: a.periodicidade, etapa: etapaDe(s.segundo_fator) };
  });
}

/** Exige login completo (senha + código do e-mail). */
export async function exigirEmpresa(req: Request, _res: Response, next: NextFunction) {
  try {
    const s = await carregarSessao(req);
    if (!s) throw new ErroHttp(401, 'Entre na sua conta.', 'sem_sessao');
    if (s.etapa !== 'completa') throw new ErroHttp(401, 'Confirme o código enviado para o seu e-mail.', s.etapa);
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
    usuario: { id: u.id, nome: u.nome, email: u.email, permissao: u.permissao },
    organizacao: { id: o.id, nome: o.nome, sigla: o.sigla, cor: o.cor, area: o.area, diasRetencao: o.diasRetencao },
    plano: s.plano,
    periodicidade: s.periodicidade,
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
    const codigo = await naOrganizacao(u.organizacao_id, async (tx) => {
      const c = await abrirSessao(tx, res, u.organizacao_id, u.id);
      await auditarComo(tx, u.organizacao_id, 'usuario', u.id, ipDe(req), { acao: 'login.senha', alvoTipo: 'usuario', alvoId: u.id });
      return c;
    });
    await enviarCodigoLogin(u.organizacao_id, u.id, codigo);
    res.json({ etapa: etapaDe(false) });
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
    const { usuarioId, codigo } = await naOrganizacao(organizacaoId, async (tx) => {
      await tx.organizacao.create({ data: { id: organizacaoId, nome: d.escritorio, sigla: siglaDe(d.escritorio), assinaturas: { create: { plano: 'gratis' } } } });
      const u = await tx.usuario.create({ data: { organizacaoId, nome: d.nome, email: d.email, senhaHash, permissao: 'admin' } });
      const c = await abrirSessao(tx, res, organizacaoId, u.id);
      await auditarComo(tx, organizacaoId, 'usuario', u.id, ipDe(req), { acao: 'conta.criada', alvoTipo: 'organizacao', alvoId: organizacaoId });
      return { usuarioId: u.id, codigo: c };
    });
    await enviarCodigoLogin(organizacaoId, usuarioId, codigo);
    res.status(201).json({ etapa: etapaDe(false) });
  }),
);

/* ---------- Segundo fator: código por e-mail ---------- */

rotasAuth.post(
  '/2fa/verificar',
  limites.segundoFator,
  rota(async (req, res) => {
    const s = await exigirSessaoParcial(req);
    const { codigo } = validar(CodigoLoginEntrada, req.body);
    const ok = await naOrganizacao(s.organizacao.id, async (tx) => {
      const sessao = await tx.sessao.findUniqueOrThrow({ where: { id: s.sessaoId } });
      if (sessao.segundoFator) return true;
      if (!sessao.codigoHash || !sessao.codigoExpiraEm || sessao.codigoExpiraEm < new Date() || sessao.codigoTentativas >= TENTATIVAS_CODIGO) {
        throw new ErroHttp(400, 'O código venceu. Peça um novo.', 'codigo_vencido');
      }
      if (!iguais(sessao.codigoHash, hashCodigo(sessao.id, codigo))) {
        await tx.sessao.update({ where: { id: sessao.id }, data: { codigoTentativas: { increment: 1 } } });
        await auditarComo(tx, s.organizacao.id, 'usuario', s.usuario.id, ipDe(req), { acao: 'login.codigo_errado', alvoTipo: 'usuario', alvoId: s.usuario.id });
        return false;
      }
      await tx.sessao.update({ where: { id: sessao.id }, data: { segundoFator: true, codigoHash: null, codigoExpiraEm: null } });
      await auditarComo(tx, s.organizacao.id, 'usuario', s.usuario.id, ipDe(req), { acao: 'login.segundo_fator', alvoTipo: 'usuario', alvoId: s.usuario.id });
      return true;
    });
    if (!ok) throw new ErroHttp(400, 'Código errado. Confira o e-mail.', 'codigo_errado');
    res.json({ etapa: 'completa' satisfies EtapaSessao });
  }),
);

/** Manda um código novo (o anterior deixa de valer). */
rotasAuth.post(
  '/2fa/reenviar',
  limites.reenviarCodigo,
  rota(async (req, res) => {
    const s = await exigirSessaoParcial(req);
    if (s.etapa === 'completa') return res.json({ etapa: s.etapa });
    const codigo = await naOrganizacao(s.organizacao.id, (tx) => novoCodigoLogin(tx, s.sessaoId));
    await enviarCodigoLogin(s.organizacao.id, s.usuario.id, codigo);
    res.status(202).json({ etapa: s.etapa });
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
    const codigo = await naOrganizacao(c.organizacao_id, async (tx) => {
      await tx.usuario.update({ where: { id: c.usuario_id }, data: { senhaHash, conviteHash: null, conviteExpiraEm: null } });
      return abrirSessao(tx, res, c.organizacao_id, c.usuario_id);
    });
    await enviarCodigoLogin(c.organizacao_id, c.usuario_id, codigo);
    res.json({ etapa: etapaDe(false) });
  }),
);

/* ---------- Ajuda de desenvolvimento ---------- */

if (emDesenvolvimento) {
  /** Desenvolvimento: o último código de login "enviado" para quem está entrando, lido da caixa de saída de dev. */
  rotasAuth.get(
    '/dev/codigo',
    rota(async (req, res) => {
      const s = await exigirSessaoParcial(req);
      const codigo = await naOrganizacao(s.organizacao.id, async (tx) => {
        // Devolve só o código que vale para esta sessão (os e-mails podem chegar fora de ordem).
        const sessao = await tx.sessao.findUniqueOrThrow({ where: { id: s.sessaoId } });
        const mensagens = await tx.caixaSaidaDev.findMany({ where: { usuarioId: s.usuario.id, criadaEm: { gte: sessao.criadaEm } }, orderBy: { criadaEm: 'desc' }, take: 10 });
        const codigos = mensagens.map((m) => m.texto.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => !!c);
        return codigos.find((c) => sessao.codigoHash && iguais(sessao.codigoHash, hashCodigo(sessao.id, c))) ?? null;
      });
      res.json({ codigo });
    }),
  );
}
