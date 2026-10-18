import { Router } from 'express';
import { naOrganizacao } from '@trames/db';
import { ModeloEntrada, type ModeloDto } from '@trames/shared';
import { naoEncontrado } from '../../infra/erros';
import { rota, validar } from '../../infra/http';
import { exigirMontar, exigirRecurso } from '../auth/permissoes';

export const rotasModelos = Router();

/** Modelos da Trames (organizacao_id nulo) e os do escritório; o RLS esconde os dos outros. */
rotasModelos.get(
  '/',
  rota(async (req, res) => {
    const lista = await naOrganizacao(req.empresa!.organizacao.id, (tx) =>
      tx.modelo.findMany({ include: { itens: { orderBy: { ordem: 'asc' } } }, orderBy: [{ organizacaoId: 'asc' }, { criadoEm: 'asc' }] }),
    );
    res.json(
      lista.map(
        (m): ModeloDto => ({
          id: m.id,
          nome: m.nome,
          quando: m.quando,
          area: m.area,
          proprio: !!m.organizacaoId,
          itens: m.itens.map((i) => ({ nome: i.nome, detalhe: i.detalhe, obrigatorio: i.obrigatorio })),
        }),
      ),
    );
  }),
);

rotasModelos.post(
  '/',
  rota(async (req, res) => {
    exigirRecurso(req, 'modelosProprios');
    exigirMontar(req);
    const d = validar(ModeloEntrada, req.body);
    const { organizacao } = req.empresa!;
    const m = await naOrganizacao(organizacao.id, (tx) =>
      tx.modelo.create({
        data: { organizacaoId: organizacao.id, area: organizacao.area, nome: d.nome, quando: d.quando, itens: { create: d.itens.map((it, k) => ({ ...it, ordem: k, organizacaoId: organizacao.id })) } },
      }),
    );
    res.status(201).json({ id: m.id });
  }),
);

rotasModelos.put(
  '/:id',
  rota(async (req, res) => {
    exigirRecurso(req, 'modelosProprios');
    exigirMontar(req);
    const d = validar(ModeloEntrada, req.body);
    const org = req.empresa!.organizacao.id;
    await naOrganizacao(org, async (tx) => {
      const m = await tx.modelo.findFirst({ where: { id: req.params.id, organizacaoId: org } });
      if (!m) throw naoEncontrado('Modelo não encontrado.');
      await tx.itemModelo.deleteMany({ where: { modeloId: m.id } });
      await tx.modelo.update({
        where: { id: m.id },
        data: { nome: d.nome, quando: d.quando, itens: { create: d.itens.map((it, k) => ({ ...it, ordem: k, organizacaoId: org })) } },
      });
    });
    res.status(204).end();
  }),
);

rotasModelos.delete(
  '/:id',
  rota(async (req, res) => {
    exigirRecurso(req, 'modelosProprios');
    exigirMontar(req);
    const org = req.empresa!.organizacao.id;
    const n = await naOrganizacao(org, (tx) => tx.modelo.deleteMany({ where: { id: req.params.id, organizacaoId: org } }));
    if (!n.count) throw naoEncontrado('Modelo não encontrado.');
    res.status(204).end();
  }),
);
