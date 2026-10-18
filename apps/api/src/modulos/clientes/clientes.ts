import { Router } from 'express';
import { naOrganizacao } from '@trames/db';
import type { ClienteDto } from '@trames/shared';
import { naoEncontrado } from '../../infra/erros';
import { enfileirar } from '../../infra/fila';
import { rota } from '../../infra/http';
import { auditar } from '../auditoria/auditoria';
import { exigirAdmin } from '../auth/permissoes';
import { decifrarDadosCliente } from './cifra';

export const rotasClientes = Router();

/** Lista sem decifrar nada: só o final do telefone, que fica em claro. */
rotasClientes.get(
  '/',
  rota(async (req, res) => {
    const lista = await naOrganizacao(req.empresa!.organizacao.id, (tx) =>
      tx.cliente.findMany({ include: { balcoes: { select: { id: true, concluidoEm: true, criadoEm: true }, orderBy: { criadoEm: 'desc' } } }, orderBy: { nome: 'asc' } }),
    );
    res.json(
      lista.map(
        (c): ClienteDto => ({
          id: c.id,
          nome: c.nome,
          email: c.email,
          whatsappFinal: c.telefoneFinal,
          balcoesAbertos: c.balcoes.filter((b) => !b.concluidoEm).length,
          balcoesTotal: c.balcoes.length,
          ultimoBalcaoId: (c.balcoes.find((b) => !b.concluidoEm) ?? c.balcoes[0])?.id ?? null,
        }),
      ),
    );
  }),
);

/**
 * LGPD: exportação a pedido do titular. O escritório (controlador) recebe tudo
 * o que a Trames guarda sobre o cliente, com CPF e telefone decifrados.
 */
rotasClientes.get(
  '/:id/exportar',
  rota(async (req, res) => {
    exigirAdmin(req);
    const dados = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const c = await tx.cliente.findUnique({
        where: { id: req.params.id },
        include: { balcoes: { include: { itens: { orderBy: { ordem: 'asc' } }, documentos: { orderBy: { enviadoEm: 'asc' } } } } },
      });
      if (!c) throw naoEncontrado('Cliente não encontrado.');
      const { cpf, telefone } = await decifrarDadosCliente(c);
      await auditar(tx, req, { acao: 'titular.exportou', alvoTipo: 'cliente', alvoId: c.id });
      return {
        geradoEm: new Date().toISOString(),
        controlador: req.empresa!.organizacao.nome,
        titular: { nome: c.nome, cpf, whatsapp: telefone, email: c.email, cadastradoEm: c.criadoEm },
        balcoes: c.balcoes.map((b) => ({
          protocolo: b.protocolo,
          tipo: b.tipo,
          prazo: b.prazo,
          criadoEm: b.criadoEm,
          concluidoEm: b.concluidoEm,
          arquivosApagadosEm: b.arquivosApagadosEm,
          itens: b.itens.map((i) => ({ nome: i.nome, status: i.status, motivoRecusa: i.motivoRecusa })),
          arquivos: b.documentos.map((d) => ({ nome: d.nomeArquivo, tipo: d.tipoReal ?? d.tipoDeclarado, tamanho: d.tamanho, enviadoEm: d.enviadoEm, situacao: d.status, apagadoEm: d.apagadoEm })),
        })),
      };
    });
    res.setHeader('Content-Disposition', `attachment; filename="dados-titular-${req.params.id}.json"`);
    res.json(dados);
  }),
);

/** LGPD: exclusão a pedido do titular. Apaga cadastro, balcões e arquivos; a auditoria (sem dado pessoal) fica. */
rotasClientes.delete(
  '/:id',
  rota(async (req, res) => {
    exigirAdmin(req);
    const org = req.empresa!.organizacao.id;
    const chaves = await naOrganizacao(org, async (tx) => {
      const docs = await tx.documento.findMany({ where: { balcao: { clienteId: req.params.id } }, select: { chave: true, chaveMiniatura: true } });
      const n = await tx.cliente.deleteMany({ where: { id: req.params.id } });
      if (!n.count) throw naoEncontrado('Cliente não encontrado.');
      await auditar(tx, req, { acao: 'titular.excluiu', alvoTipo: 'cliente', alvoId: req.params.id, detalhes: { arquivos: docs.length } });
      return docs.flatMap((d) => [d.chave, d.chaveMiniatura]).filter((c): c is string => !!c);
    });
    if (chaves.length) await enfileirar('apagar-arquivos', { organizacaoId: org, chaves });
    res.status(204).end();
  }),
);
