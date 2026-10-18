import type { Cliente } from '@prisma/client';
import { cifrarCampo, decifrarCampo, hmacBusca, type Kms } from './cripto';

/*
 * CPF e telefone do cliente: criptografia por envelope (uma chave de dados por
 * cliente, cifrada pelo KMS) e um HMAC ao lado para buscar sem decifrar.
 * Usado pela API (ao gravar) e pelo worker (para mandar WhatsApp).
 */

const contexto = (organizacaoId: string) => `cliente:${organizacaoId}`;

export async function cifrarDadosCliente(kms: Kms, chaveHmac: string, organizacaoId: string, cpf: string, telefone: string) {
  const { plana, cifrada } = await kms.gerarChaveDados(organizacaoId);
  return {
    chaveCifrada: cifrada,
    cpfCifrado: cpf ? cifrarCampo(plana, cpf, contexto(organizacaoId)) : null,
    cpfHmac: cpf ? hmacBusca(chaveHmac, organizacaoId, cpf) : null,
    telefoneCifrado: cifrarCampo(plana, telefone, contexto(organizacaoId)),
    telefoneHmac: hmacBusca(chaveHmac, organizacaoId, telefone),
    telefoneFinal: telefone.slice(-4),
  };
}

export async function decifrarDadosCliente(kms: Kms, c: Pick<Cliente, 'organizacaoId' | 'chaveCifrada' | 'cpfCifrado' | 'telefoneCifrado'>) {
  const dek = await kms.abrirChaveDados(Buffer.from(c.chaveCifrada), c.organizacaoId);
  return {
    cpf: c.cpfCifrado ? decifrarCampo(dek, Buffer.from(c.cpfCifrado), contexto(c.organizacaoId)) : '',
    telefone: decifrarCampo(dek, Buffer.from(c.telefoneCifrado), contexto(c.organizacaoId)),
  };
}
