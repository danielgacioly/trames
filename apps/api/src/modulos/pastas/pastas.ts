import { Router } from 'express';
import { naOrganizacao, type Tx } from '@trames/db';
import { PastaEntrada, type PastaDto } from '@trames/shared';
import { ErroHttp, naoEncontrado } from '../../infra/erros';
import { rota, validar } from '../../infra/http';
import { auditar } from '../auditoria/auditoria';
import { exigirMontar } from '../auth/permissoes';

/*
 * Pastas que o escritório cria para organizar os balcões. As pastas automáticas
 * (por situação, tipo de caso e pessoa) são calculadas na tela a partir da lista.
 * Apagar uma pasta só tira os balcões dela (pasta_id vira nulo).
 */
export const rotasPastas = Router();

/** Limite por escritório: o bastante para organizar, sem virar um lugar para guardar texto livre. */
const MAXIMO_PASTAS = 100;

const dto = (p: { id: string; nome: string; cor: string }): PastaDto => ({ id: p.id, nome: p.nome, cor: p.cor });

async function semNomeRepetido(tx: Tx, nome: string, outraQue?: string) {
  const igual = await tx.pasta.findFirst({ where: { nome: { equals: nome, mode: 'insensitive' }, ...(outraQue ? { id: { not: outraQue } } : {}) }, select: { id: true } });
  if (igual) throw new ErroHttp(409, 'Já existe uma pasta com esse nome.');
}

rotasPastas.get(
  '/',
  rota(async (req, res) => {
    const lista = await naOrganizacao(req.empresa!.organizacao.id, (tx) => tx.pasta.findMany({ orderBy: { nome: 'asc' } }));
    res.json(lista.map(dto));
  }),
);

rotasPastas.post(
  '/',
  rota(async (req, res) => {
    exigirMontar(req);
    const d = validar(PastaEntrada, req.body);
    const org = req.empresa!.organizacao.id;
    const p = await naOrganizacao(org, async (tx) => {
      if ((await tx.pasta.count()) >= MAXIMO_PASTAS) throw new ErroHttp(400, `O escritório pode ter até ${MAXIMO_PASTAS} pastas.`);
      await semNomeRepetido(tx, d.nome);
      const p = await tx.pasta.create({ data: { organizacaoId: org, nome: d.nome, cor: d.cor } });
      await auditar(tx, req, { acao: 'pasta.criada', alvoTipo: 'pasta', alvoId: p.id });
      return p;
    });
    res.status(201).json(dto(p));
  }),
);

rotasPastas.patch(
  '/:id',
  rota(async (req, res) => {
    exigirMontar(req);
    const d = validar(PastaEntrada, req.body);
    const p = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const atual = await tx.pasta.findUnique({ where: { id: req.params.id } });
      if (!atual) throw naoEncontrado('Pasta não encontrada.');
      await semNomeRepetido(tx, d.nome, atual.id);
      const p = await tx.pasta.update({ where: { id: atual.id }, data: { nome: d.nome, cor: d.cor } });
      await auditar(tx, req, { acao: 'pasta.alterada', alvoTipo: 'pasta', alvoId: p.id });
      return p;
    });
    res.json(dto(p));
  }),
);

rotasPastas.delete(
  '/:id',
  rota(async (req, res) => {
    exigirMontar(req);
    await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const p = await tx.pasta.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!p) throw naoEncontrado('Pasta não encontrada.');
      const { count } = await tx.balcao.updateMany({ where: { pastaId: p.id }, data: { pastaId: null } });
      await tx.pasta.delete({ where: { id: p.id } });
      await auditar(tx, req, { acao: 'pasta.apagada', alvoTipo: 'pasta', alvoId: p.id, detalhes: { balcoes: count } });
    });
    res.status(204).end();
  }),
);
