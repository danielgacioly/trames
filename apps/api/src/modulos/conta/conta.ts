import argon2 from 'argon2';
import { Router } from 'express';
import { naOrganizacao } from '@trames/db';
import { PerfilEntrada, TrocarSenhaEntrada, type AparelhoDto } from '@trames/shared';
import { ErroHttp, naoEncontrado } from '../../infra/erros';
import { limites, rota, validar } from '../../infra/http';
import { auditar } from '../auditoria/auditoria';
import { avisarSenhaTrocada, hashSenha } from '../auth/auth';

/**
 * A conta da pessoa (não a do escritório): nome, cargo, senha e os aparelhos
 * em que ela está conectada. Cada pessoa só mexe no que é dela.
 */
export const rotasConta = Router();

rotasConta.put(
  '/perfil',
  rota(async (req, res) => {
    const d = validar(PerfilEntrada, req.body);
    const { organizacao, usuario } = req.empresa!;
    await naOrganizacao(organizacao.id, async (tx) => {
      await tx.usuario.update({ where: { id: usuario.id }, data: { nome: d.nome, cargo: d.cargo || null } });
      await auditar(tx, req, { acao: 'perfil.alterado', alvoTipo: 'usuario', alvoId: usuario.id });
    });
    res.status(204).end();
  }),
);

/** Troca a senha sabendo a atual. As outras sessões caem; esta continua. */
rotasConta.put(
  '/senha',
  limites.login,
  rota(async (req, res) => {
    const { atual, nova } = validar(TrocarSenhaEntrada, req.body);
    const { organizacao, usuario, sessaoId } = req.empresa!;
    if (!usuario.senhaHash || !(await argon2.verify(usuario.senhaHash, atual))) throw new ErroHttp(400, 'A senha atual não confere.', 'senha_errada');
    const senhaHash = await hashSenha(nova);
    await naOrganizacao(organizacao.id, async (tx) => {
      await tx.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });
      await tx.sessao.deleteMany({ where: { usuarioId: usuario.id, id: { not: sessaoId } } });
      await auditar(tx, req, { acao: 'senha.trocada', alvoTipo: 'usuario', alvoId: usuario.id });
    });
    await avisarSenhaTrocada(organizacao.id, usuario.id);
    res.status(204).end();
  }),
);

rotasConta.get(
  '/aparelhos',
  rota(async (req, res) => {
    const { organizacao, usuario, sessaoId } = req.empresa!;
    const sessoes = await naOrganizacao(organizacao.id, (tx) =>
      tx.sessao.findMany({ where: { usuarioId: usuario.id, segundoFator: true, expiraEm: { gt: new Date() } }, orderBy: { criadaEm: 'desc' } }),
    );
    res.json(sessoes.map((s): AparelhoDto => ({ id: s.id, aparelho: s.aparelho ?? 'Navegador desconhecido', criadaEm: s.criadaEm.toISOString(), atual: s.id === sessaoId })));
  }),
);

/** Desconecta um aparelho, ou todos menos este (id "outros"). */
rotasConta.delete(
  '/aparelhos/:id',
  rota(async (req, res) => {
    const { organizacao, usuario, sessaoId } = req.empresa!;
    const outros = req.params.id === 'outros';
    if (req.params.id === sessaoId) throw new ErroHttp(400, 'Para sair deste aparelho, use Sair no menu.');
    await naOrganizacao(organizacao.id, async (tx) => {
      const n = await tx.sessao.deleteMany({ where: outros ? { usuarioId: usuario.id, id: { not: sessaoId } } : { usuarioId: usuario.id, id: req.params.id } });
      if (!outros && !n.count) throw naoEncontrado('Aparelho não encontrado.');
      await auditar(tx, req, { acao: 'sessao.encerrada', alvoTipo: 'usuario', alvoId: usuario.id, detalhes: { quantas: n.count } });
    });
    res.status(204).end();
  }),
);
