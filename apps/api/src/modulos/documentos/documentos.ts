import { Router } from 'express';
import { naOrganizacao } from '@trames/db';
import { BUCKET_DOCUMENTOS, urlDeDownload } from '@trames/db/armazenamento';
import { ErroHttp, naoEncontrado } from '../../infra/erros';
import { enfileirar } from '../../infra/fila';
import { rota } from '../../infra/http';
import { auditar } from '../auditoria/auditoria';
import { exigirAdmin } from '../auth/permissoes';

/*
 * Download do original: a API confere a permissão (o RLS só deixa achar documento do próprio
 * escritório), registra na auditoria e devolve uma URL assinada de ~60 segundos.
 * O arquivo vai direto do storage para o navegador.
 */

export const rotasDocumentos = Router();

/** "Baixar original": é o único caminho para o arquivo original. Conferir usa a miniatura. */
rotasDocumentos.get(
  '/:id/url',
  rota(async (req, res) => {
    const url = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const d = await tx.documento.findUnique({ where: { id: req.params.id } });
      if (!d) throw naoEncontrado('Documento não encontrado.');
      if (d.status !== 'disponivel') throw new ErroHttp(409, d.status === 'quarentena' ? 'O arquivo ainda está sendo verificado.' : 'Este arquivo não está disponível.');
      await auditar(tx, req, { acao: 'documento.baixou', alvoTipo: 'documento', alvoId: d.id, detalhes: { balcaoId: d.balcaoId, original: true } });
      return urlDeDownload(BUCKET_DOCUMENTOS, d.chave, d.nomeArquivo, d.tipoReal ?? d.tipoDeclarado, true);
    });
    res.json({ url });
  }),
);

rotasDocumentos.get(
  '/:id/miniatura',
  rota(async (req, res) => {
    const url = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const d = await tx.documento.findUnique({ where: { id: req.params.id } });
      if (!d?.chaveMiniatura || d.status !== 'disponivel') throw naoEncontrado('Sem miniatura.');
      await auditar(tx, req, { acao: 'documento.viu', alvoTipo: 'documento', alvoId: d.id, detalhes: { balcaoId: d.balcaoId, miniatura: true } });
      return urlDeDownload(BUCKET_DOCUMENTOS, d.chaveMiniatura, 'miniatura.webp', 'image/webp', false);
    });
    res.json({ url });
  }),
);

/** Apaga o arquivo (o item volta a pendente). Só administradores. */
rotasDocumentos.delete(
  '/:id',
  rota(async (req, res) => {
    exigirAdmin(req);
    const org = req.empresa!.organizacao.id;
    const chaves = await naOrganizacao(org, async (tx) => {
      const d = await tx.documento.findUnique({ where: { id: req.params.id } });
      if (!d || d.status === 'apagado') throw naoEncontrado('Documento não encontrado.');
      await tx.documento.update({ where: { id: d.id }, data: { status: 'apagado', apagadoEm: new Date() } });
      await tx.itemBalcao.update({ where: { id: d.itemId }, data: { status: 'pendente', motivoRecusa: null } });
      await auditar(tx, req, { acao: 'documento.apagou', alvoTipo: 'documento', alvoId: d.id, detalhes: { balcaoId: d.balcaoId } });
      return [d.chave, d.chaveMiniatura].filter((c): c is string => !!c);
    });
    await enfileirar('apagar-arquivos', { organizacaoId: org, chaves });
    res.status(204).end();
  }),
);

/** Histórico de um balcão (auditoria). */
export const rotasAuditoria = Router();

rotasAuditoria.get(
  '/balcao/:id',
  rota(async (req, res) => {
    const eventos = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const ev = await tx.eventoAuditoria.findMany({
        where: { OR: [{ alvoTipo: 'balcao', alvoId: req.params.id }, { detalhes: { path: ['balcaoId'], equals: req.params.id } }] },
        orderBy: { criadoEm: 'desc' },
        take: 100,
      });
      const ids = [...new Set(ev.map((e) => e.atorId).filter((x): x is string => !!x))];
      const pessoas = new Map((await tx.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })).map((u) => [u.id, u.nome]));
      return ev.map((e) => ({
        id: String(e.id),
        acao: e.acao,
        ator: e.atorTipo === 'usuario' ? (pessoas.get(e.atorId ?? '') ?? 'Pessoa removida') : e.atorTipo === 'cliente' ? 'Cliente' : 'Trames',
        criadoEm: e.criadoEm.toISOString(),
        ip: e.ip,
      }));
    });
    res.json(eventos);
  }),
);
