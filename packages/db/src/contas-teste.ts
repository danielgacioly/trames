/*
 * Contas de teste criadas pelo seed. Os segredos TOTP são fixos e públicos de
 * propósito, para quem testa conseguir cadastrar no app autenticador. Nunca use
 * estes valores fora do ambiente de desenvolvimento.
 */
export const SENHA_TESTE = 'trames-teste-123';

export const CONTAS_TESTE = [
  { plano: 'Grátis', email: 'gratis@trames.app', quem: 'Carla Menezes · Clínica Boa Vista', totp: 'JBSWY3DPEHPK3PXA' },
  { plano: 'Pro', email: 'pro@trames.app', quem: 'Ana Albuquerque · Albuquerque & Lima', totp: 'KRUGKIDROVUWG2ZA' },
  { plano: 'Ultra', email: 'ultra@trames.app', quem: 'Rafael Moura · Lins & Moura Contabilidade', totp: 'MFRGGZDFMZTWQ2LK' },
] as const;
