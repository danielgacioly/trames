import { cifrarDadosCliente as cifrar, decifrarDadosCliente as decifrar, hmacBusca, type Cliente } from '@trames/db';
import { config } from '../../infra/config';
import { kms } from '../../infra/kms';

export const hmac = (organizacaoId: string, valor: string) => hmacBusca(config.CHAVE_HMAC, organizacaoId, valor);
export const cifrarDadosCliente = (organizacaoId: string, cpf: string, telefone: string) => cifrar(kms, config.CHAVE_HMAC, organizacaoId, cpf, telefone);
export const decifrarDadosCliente = (c: Pick<Cliente, 'organizacaoId' | 'chaveCifrada' | 'cpfCifrado' | 'telefoneCifrado'>) => decifrar(kms, c);
