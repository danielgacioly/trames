import pino from 'pino';

/**
 * Logs nunca levam dado pessoal: nada de corpo de requisição, URL completa
 * (o link do cliente leva o token), nome de arquivo, CPF ou telefone.
 * Os campos abaixo são apagados por garantia, caso alguém os passe sem querer.
 */
export const log = pino({
  level: process.env.NIVEL_LOG ?? 'info',
  redact: {
    paths: ['*.cpf', '*.telefone', '*.whatsapp', '*.email', '*.nome', '*.senha', '*.codigo', '*.token', '*.nomeArquivo', '*.url', 'req.headers.cookie'],
    censor: '[removido]',
  },
});
