import { z } from 'zod';

const Config = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORTA_API: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  URL_WEB: z.string().url(),
  URL_BALCAO: z.string().url(),
  CHAVE_HMAC: z.string().min(40),
  COBRANCA_SIMULADA: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Turu fica fora do lançamento (docs/viabilidade.md). TURU=1 liga em desenvolvimento. */
  TURU: z.string().optional(),
});

export const config = Config.parse(process.env);
export const emDesenvolvimento = config.NODE_ENV !== 'production';
