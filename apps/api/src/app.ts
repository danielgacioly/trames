import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import helmet from 'helmet';
import { config } from './infra/config';
import { tratarErros } from './infra/erros';
import { limites, registrarAcesso, verificarOrigem } from './infra/http';
import { exigirCliente, rotasAcesso, rotasCliente } from './modulos/acesso-cliente/acesso';
import { exigirEmpresa, rotasAuth } from './modulos/auth/auth';
import { rotasBalcoes, rotasItens, rotasRelatorio } from './modulos/balcoes/balcoes';
import { rotasClientes } from './modulos/clientes/clientes';
import { rotasCobranca } from './modulos/cobranca/cobranca';
import { rotasAuditoria, rotasDocumentos } from './modulos/documentos/documentos';
import { rotasModelos } from './modulos/modelos/modelos';
import { rotasOrganizacao } from './modulos/organizacoes/organizacoes';
import { rotasPastas } from './modulos/pastas/pastas';
import { rotasTuru } from './modulos/turu/turu';

/** A API só responde requisições: trabalho pesado (antivírus, mensagens, retenção) vai para o worker. */
export function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  // Respostas da API têm dados pessoais e códigos: nada de cache no navegador nem em proxies.
  app.set('etag', false);
  app.set('trust proxy', 1); // atrás do balanceador
  app.use(registrarAcesso);
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(limites.geral);
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use(verificarOrigem);

  const api = Router();
  api.get('/saude', (_req, res) => res.json({ ok: true }));

  api.use('/auth', rotasAuth);

  // Escritório (login completo)
  api.use('/balcoes', exigirEmpresa, rotasBalcoes);
  api.use('/itens', exigirEmpresa, rotasItens);
  api.use('/documentos', exigirEmpresa, rotasDocumentos);
  api.use('/auditoria', exigirEmpresa, rotasAuditoria);
  api.use('/modelos', exigirEmpresa, rotasModelos);
  api.use('/pastas', exigirEmpresa, rotasPastas);
  api.use('/clientes', exigirEmpresa, rotasClientes);
  api.use('/organizacao', exigirEmpresa, rotasOrganizacao);
  api.use('/cobranca', exigirEmpresa, rotasCobranca);
  api.use('/relatorio', exigirEmpresa, rotasRelatorio);
  // Turu fica fora do lançamento; só existe com TURU=1.
  if (config.TURU === '1') api.use('/turu', exigirEmpresa, rotasTuru);

  // Cliente (link + código)
  api.use('/acesso', rotasAcesso);
  api.use('/cliente', exigirCliente, rotasCliente);

  app.use('/api', api);
  app.use((_req, res) => res.status(404).json({ erro: 'Não encontrado.' }));
  app.use(tratarErros);
  return app;
}
