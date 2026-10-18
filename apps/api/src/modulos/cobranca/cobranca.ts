import { Router } from 'express';
import { naOrganizacao } from '@trames/db';
import { MudarPlanoEntrada } from '@trames/shared';
import { config } from '../../infra/config';
import { ErroHttp } from '../../infra/erros';
import { rota, validar } from '../../infra/http';
import { auditar } from '../auditoria/auditoria';
import { exigirAdmin } from '../auth/permissoes';
import { balcoesAtivos } from '../balcoes/balcoes';

/*
 * Assinatura e uso do plano. O provedor de pagamento ainda não foi escolhido:
 * por enquanto a troca de plano só existe com COBRANCA_SIMULADA=1 (desenvolvimento).
 */
export const rotasCobranca = Router();

rotasCobranca.get(
  '/',
  rota(async (req, res) => {
    const uso = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => ({ balcoesAtivos: await balcoesAtivos(tx), pessoas: await tx.usuario.count() }));
    res.json({ plano: req.empresa!.plano, ...uso, trocaSimulada: config.COBRANCA_SIMULADA === '1' });
  }),
);

rotasCobranca.post(
  '/plano',
  rota(async (req, res) => {
    exigirAdmin(req);
    if (config.COBRANCA_SIMULADA !== '1' || config.NODE_ENV === 'production') throw new ErroHttp(501, 'A troca de plano com pagamento ainda não está disponível.');
    const { plano } = validar(MudarPlanoEntrada, req.body);
    const org = req.empresa!.organizacao.id;
    await naOrganizacao(org, async (tx) => {
      await tx.assinatura.updateMany({ where: { status: 'ativa' }, data: { status: 'cancelada', fimEm: new Date() } });
      await tx.assinatura.create({ data: { organizacaoId: org, plano } });
      await auditar(tx, req, { acao: 'plano.alterado', alvoTipo: 'organizacao', alvoId: org, detalhes: { de: req.empresa!.plano, para: plano } });
    });
    res.status(204).end();
  }),
);
