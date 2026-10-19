import { Router } from 'express';
import { naOrganizacao } from '@trames/db';
import { ModeloEntrada, type ModeloDto } from '@trames/shared';
import { naoEncontrado } from '../../infra/erros';
import { rota, validar } from '../../infra/http';
import { exigirMontar, exigirRecurso } from '../auth/permissoes';

export const rotasModelos = Router();

/**
 * Modelos prontos da área do escritório e os do escritório; o RLS esconde os dos
 * outros. Um pronto que o escritório editou some e aparece a edição no lugar.
 */
rotasModelos.get(
  '/',
  rota(async (req, res) => {
    const { organizacao } = req.empresa!;
    const lista = await naOrganizacao(organizacao.id, (tx) =>
      tx.modelo.findMany({
        where: { OR: [{ organizacaoId: organizacao.id }, { organizacaoId: null, area: organizacao.area }] },
        include: { itens: { orderBy: { ordem: 'asc' } } },
        orderBy: [{ organizacaoId: 'asc' }, { criadoEm: 'asc' }],
      }),
    );
    const editados = new Set(lista.map((m) => m.baseId).filter(Boolean));
    // A edição de um pronto fica na posição do pronto, para a lista não mudar de ordem.
    const prontos = lista.filter((m) => !m.organizacaoId);
    const doEscritorio = lista.filter((m) => m.organizacaoId);
    const emOrdem = [...prontos.flatMap((p) => (editados.has(p.id) ? doEscritorio.filter((m) => m.baseId === p.id) : [p])), ...doEscritorio.filter((m) => !m.baseId)];
    res.json(
      emOrdem.map(
        (m): ModeloDto => ({
          id: m.id,
          nome: m.nome,
          quando: m.quando,
          area: m.area,
          proprio: !!m.organizacaoId,
          baseId: m.baseId,
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
    const novo = await naOrganizacao(org, async (tx) => {
      const alvo = await tx.modelo.findFirst({ where: { id: req.params.id } });
      if (!alvo) throw naoEncontrado('Modelo não encontrado.');
      // Editar um pronto cria (uma vez) a versão do escritório, que passa a valer no lugar dele.
      if (!alvo.organizacaoId) {
        const ja = await tx.modelo.findFirst({ where: { organizacaoId: org, baseId: alvo.id } });
        if (!ja) {
          const m = await tx.modelo.create({
            data: { organizacaoId: org, baseId: alvo.id, area: alvo.area, nome: d.nome, quando: d.quando, itens: { create: d.itens.map((it, k) => ({ ...it, ordem: k, organizacaoId: org })) } },
          });
          return m.id;
        }
        req.params.id = ja.id;
      }
      const m = await tx.modelo.findFirst({ where: { id: req.params.id, organizacaoId: org } });
      if (!m) throw naoEncontrado('Modelo não encontrado.');
      await tx.itemModelo.deleteMany({ where: { modeloId: m.id } });
      await tx.modelo.update({
        where: { id: m.id },
        data: { nome: d.nome, quando: d.quando, itens: { create: d.itens.map((it, k) => ({ ...it, ordem: k, organizacaoId: org })) } },
      });
      return m.id;
    });
    res.json({ id: novo });
  }),
);

/** Apaga um modelo do escritório. Se for a edição de um pronto, o pronto volta a aparecer. */
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
