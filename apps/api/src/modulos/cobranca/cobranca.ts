import { Router } from 'express';
import { naOrganizacao } from '@trames/db';
import { diasRetencao, mesDe, MudarPlanoEntrada, type UsoDto } from '@trames/shared';
import { config } from '../../infra/config';
import { ErroHttp } from '../../infra/erros';
import { rota, validar } from '../../infra/http';
import { auditar } from '../auditoria/auditoria';
import { exigirAdmin } from '../auth/permissoes';
import { balcoesAtivos, limitarRetencao } from '../balcoes/balcoes';

/*
 * Assinatura e uso do plano. O provedor de pagamento (Pix e cartão) ainda não foi
 * escolhido: por enquanto a troca de plano só existe com COBRANCA_SIMULADA=1.
 * Os excedentes do Ultra já ficam guardados em itens_cobranca, por mês de referência,
 * para entrar na fatura seguinte (no plano anual, cobrados mês a mês, à parte).
 */
export const rotasCobranca = Router();

rotasCobranca.get(
  '/',
  rota(async (req, res) => {
    const mes = mesDe();
    const uso = await naOrganizacao(req.empresa!.organizacao.id, async (tx) => {
      const u = await tx.usoMensal.findUnique({ where: { organizacaoId_mes: { organizacaoId: req.empresa!.organizacao.id, mes } } });
      const excedentes = await tx.itemCobranca.aggregate({ where: { mesReferencia: mes, tipo: 'balcao_excedente' }, _count: true, _sum: { valorCentavos: true } });
      return {
        balcoesAtivos: await balcoesAtivos(tx),
        pessoas: await tx.usuario.count(),
        balcoesNoMes: u?.balcoesCriados ?? 0,
        whatsappEnviados: u?.whatsappEnviados ?? 0,
        excedentes: excedentes._count,
        valorExcedentesCentavos: excedentes._sum.valorCentavos ?? 0,
      };
    });
    res.json({ plano: req.empresa!.plano, periodicidade: req.empresa!.periodicidade, mes, ...uso, trocaSimulada: config.COBRANCA_SIMULADA === '1' } satisfies UsoDto);
  }),
);

rotasCobranca.post(
  '/plano',
  rota(async (req, res) => {
    exigirAdmin(req);
    if (config.COBRANCA_SIMULADA !== '1' || config.NODE_ENV === 'production') throw new ErroHttp(501, 'A troca de plano com pagamento ainda não está disponível.');
    const { plano, periodicidade } = validar(MudarPlanoEntrada, req.body);
    if (plano === 'gratis' && periodicidade === 'anual') throw new ErroHttp(400, 'O Grátis não tem plano anual.');
    const org = req.empresa!.organizacao.id;
    await naOrganizacao(org, async (tx) => {
      await tx.assinatura.updateMany({ where: { status: 'ativa' }, data: { status: 'cancelada', fimEm: new Date() } });
      await tx.assinatura.create({ data: { organizacaoId: org, plano, periodicidade } });
      await limitarRetencao(tx, diasRetencao(plano, req.empresa!.organizacao.diasRetencao));
      await auditar(tx, req, { acao: 'plano.alterado', alvoTipo: 'organizacao', alvoId: org, detalhes: { de: req.empresa!.plano, para: plano, periodicidade } });
    });
    res.status(204).end();
  }),
);
