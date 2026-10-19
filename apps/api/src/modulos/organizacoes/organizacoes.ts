import { Router } from 'express';
import { naOrganizacao, novoToken, usuarioParaLogin } from '@trames/db';
import { AreaEntrada, ConviteEntrada, OrganizacaoEntrada, PermissaoEntrada, type PessoaDto } from '@trames/shared';
import { config } from '../../infra/config';
import { ErroHttp, naoEncontrado } from '../../infra/erros';
import { enfileirar } from '../../infra/fila';
import { rota, validar } from '../../infra/http';
import { selarConteudo } from '../acesso-cliente/links';
import { auditar } from '../auditoria/auditoria';
import { exigirAdmin, exigirRecurso, plano } from '../auth/permissoes';
import { limitarRetencao } from '../balcoes/balcoes';

const VALIDADE_CONVITE_MS = 7 * 86_400_000;

export const rotasOrganizacao = Router();

rotasOrganizacao.put(
  '/',
  rota(async (req, res) => {
    exigirAdmin(req);
    const d = validar(OrganizacaoEntrada, req.body);
    const p = plano(req);
    const comMarca = p.recursos.marca;
    // A retenção só é escolhida no Ultra; nos outros planos vale a do plano e o campo é ignorado.
    const escolheRetencao = p.retencao.opcoes.length > 1;
    if (escolheRetencao && !p.retencao.opcoes.includes(d.diasRetencao)) throw new ErroHttp(400, 'Retenção fora das opções do plano.');
    const org = req.empresa!.organizacao.id;
    await naOrganizacao(org, async (tx) => {
      await tx.organizacao.update({
        where: { id: org },
        data: { nome: d.nome, ...(d.termo ? { termoSingular: d.termo.singular.toLocaleLowerCase('pt-BR'), termoPlural: d.termo.plural.toLocaleLowerCase('pt-BR'), termoFeminino: d.termo.feminino } : {}), ...(escolheRetencao ? { diasRetencao: d.diasRetencao } : {}), ...(comMarca && d.sigla ? { sigla: d.sigla } : {}), ...(comMarca && d.cor ? { cor: d.cor } : {}) },
      });
      if (escolheRetencao) await limitarRetencao(tx, d.diasRetencao);
      await auditar(tx, req, {
        acao: 'organizacao.alterada',
        alvoTipo: 'organizacao',
        alvoId: org,
        detalhes: { antes: { diasRetencao: req.empresa!.organizacao.diasRetencao }, depois: { diasRetencao: escolheRetencao ? d.diasRetencao : req.empresa!.organizacao.diasRetencao } },
      });
    });
    res.status(204).end();
  }),
);

rotasOrganizacao.put(
  '/area',
  rota(async (req, res) => {
    exigirAdmin(req);
    const { area } = validar(AreaEntrada, req.body);
    const org = req.empresa!.organizacao.id;
    await naOrganizacao(org, (tx) => tx.organizacao.update({ where: { id: org }, data: { area } }));
    res.status(204).end();
  }),
);

/* ---------- Equipe ---------- */

rotasOrganizacao.get(
  '/equipe',
  rota(async (req, res) => {
    const pessoas = await naOrganizacao(req.empresa!.organizacao.id, (tx) => tx.usuario.findMany({ orderBy: { criadoEm: 'asc' } }));
    res.json(pessoas.map((p): PessoaDto => ({ id: p.id, nome: p.nome, email: p.email, permissao: p.permissao, convitePendente: !p.senhaHash })));
  }),
);

rotasOrganizacao.post(
  '/equipe',
  rota(async (req, res) => {
    exigirAdmin(req);
    const d = validar(ConviteEntrada, req.body);
    const p = plano(req);
    const org = req.empresa!.organizacao.id;
    if (await usuarioParaLogin(d.email)) throw new ErroHttp(409, 'Já existe uma conta com este e-mail.');
    const { token, hash } = novoToken();
    const usuario = await naOrganizacao(org, async (tx) => {
      if (p.limitePessoas !== null && (await tx.usuario.count()) >= p.limitePessoas) {
        throw new ErroHttp(402, `O plano ${p.nome} permite até ${p.limitePessoas} ${p.limitePessoas === 1 ? 'pessoa' : 'pessoas'}.`, 'limite_pessoas');
      }
      // Sem permissões por pessoa (Grátis e Pro), todo mundo administra.
      const permissao = p.recursos.permissoes ? d.permissao : 'admin';
      const u = await tx.usuario.create({ data: { organizacaoId: org, nome: d.nome, email: d.email, permissao, conviteHash: hash, conviteExpiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS) } });
      await auditar(tx, req, { acao: 'equipe.convidou', alvoTipo: 'usuario', alvoId: u.id, detalhes: { permissao } });
      return u;
    });
    await enfileirar('enviar-mensagem', { organizacaoId: org, usuarioId: usuario.id, tipo: 'convite', canal: 'email', selado: await selarConteudo(org, { url: `${config.URL_WEB}/convite/${token}` }) });
    res.status(201).json({ id: usuario.id });
  }),
);

rotasOrganizacao.patch(
  '/equipe/:id',
  rota(async (req, res) => {
    exigirAdmin(req);
    exigirRecurso(req, 'permissoes');
    const { permissao } = validar(PermissaoEntrada, req.body);
    if (req.params.id === req.empresa!.usuario.id) throw new ErroHttp(400, 'Você não pode mudar a sua própria permissão.');
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const n = await tx.usuario.updateMany({ where: { id: req.params.id }, data: { permissao } });
      if (!n.count) throw naoEncontrado('Pessoa não encontrada.');
      await auditar(tx, req, { acao: 'equipe.permissao', alvoTipo: 'usuario', alvoId: req.params.id, detalhes: { permissao } });
    });
    res.status(204).end();
  }),
);

rotasOrganizacao.delete(
  '/equipe/:id',
  rota(async (req, res) => {
    exigirAdmin(req);
    if (req.params.id === req.empresa!.usuario.id) throw new ErroHttp(400, 'Você não pode se remover.');
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const n = await tx.usuario.deleteMany({ where: { id: req.params.id } }); // sessões caem em cascata
      if (!n.count) throw naoEncontrado('Pessoa não encontrada.');
      await auditar(tx, req, { acao: 'equipe.removeu', alvoTipo: 'usuario', alvoId: req.params.id });
    });
    res.status(204).end();
  }),
);
