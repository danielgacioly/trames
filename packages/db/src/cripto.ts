import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/*
 * Criptografia por envelope: cada registro tem uma chave de dados (DEK) própria,
 * que cifra os campos (CPF, telefone, segredo TOTP). A DEK é guardada cifrada pela
 * chave mestra, que fica no KMS e nunca sai dele. O organizacao_id entra como
 * dado autenticado (AAD / EncryptionContext): um campo copiado para outro
 * escritório não abre.
 */

export interface Kms {
  gerarChaveDados(contexto: string): Promise<{ plana: Buffer; cifrada: Buffer }>;
  abrirChaveDados(cifrada: Buffer, contexto: string): Promise<Buffer>;
}

const ALGORITMO = 'aes-256-gcm';

function cifrar(chave: Buffer, dado: Buffer, aad: string) {
  const iv = randomBytes(12);
  const c = createCipheriv(ALGORITMO, chave, iv);
  c.setAAD(Buffer.from(aad));
  const corpo = Buffer.concat([c.update(dado), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), corpo]);
}

function decifrar(chave: Buffer, blob: Buffer, aad: string) {
  const d = createDecipheriv(ALGORITMO, chave, blob.subarray(0, 12));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}

/** KMS de desenvolvimento: a chave mestra vem de uma variável de ambiente. Não usar em produção. */
export class KmsLocal implements Kms {
  private mestra: Buffer;
  constructor(chaveBase64: string) {
    this.mestra = Buffer.from(chaveBase64, 'base64');
    if (this.mestra.length !== 32) throw new Error('CHAVE_MESTRA_LOCAL precisa ter 32 bytes em base64.');
  }
  async gerarChaveDados(contexto: string) {
    const plana = randomBytes(32);
    return { plana, cifrada: cifrar(this.mestra, plana, `dek:${contexto}`) };
  }
  async abrirChaveDados(cifrada: Buffer, contexto: string) {
    return decifrar(this.mestra, cifrada, `dek:${contexto}`);
  }
}

/** AWS KMS (sa-east-1). A chave mestra nunca sai do KMS; só a DEK cifrada fica no banco. */
export class KmsAws implements Kms {
  private cliente: Promise<{ send: (c: unknown) => Promise<any>; mod: any }>;
  constructor(private chaveId: string, regiao: string) {
    this.cliente = import('@aws-sdk/client-kms').then((mod) => ({ mod, send: (c) => new mod.KMSClient({ region: regiao }).send(c as never) }));
  }
  async gerarChaveDados(contexto: string) {
    const { mod, send } = await this.cliente;
    const r = await send(new mod.GenerateDataKeyCommand({ KeyId: this.chaveId, KeySpec: 'AES_256', EncryptionContext: { contexto } }));
    return { plana: Buffer.from(r.Plaintext), cifrada: Buffer.from(r.CiphertextBlob) };
  }
  async abrirChaveDados(cifrada: Buffer, contexto: string) {
    const { mod, send } = await this.cliente;
    const r = await send(new mod.DecryptCommand({ KeyId: this.chaveId, CiphertextBlob: cifrada, EncryptionContext: { contexto } }));
    return Buffer.from(r.Plaintext);
  }
}

export function criarKms(env: NodeJS.ProcessEnv = process.env): Kms {
  if (env.KMS_KEY_ID) return new KmsAws(env.KMS_KEY_ID, env.AWS_REGION ?? 'sa-east-1');
  if (env.NODE_ENV === 'production') throw new Error('Em produção, configure KMS_KEY_ID.');
  if (!env.CHAVE_MESTRA_LOCAL) throw new Error('Configure CHAVE_MESTRA_LOCAL (ou KMS_KEY_ID).');
  return new KmsLocal(env.CHAVE_MESTRA_LOCAL);
}

export const cifrarCampo = (dek: Buffer, valor: string, contexto: string) => cifrar(dek, Buffer.from(valor, 'utf8'), contexto);
export const decifrarCampo = (dek: Buffer, blob: Buffer, contexto: string) => decifrar(dek, blob, contexto).toString('utf8');

/** Envelope num blob só: [tamanho da DEK cifrada (2 bytes)][DEK cifrada][campo cifrado]. Usado para o segredo TOTP. */
export async function selar(kms: Kms, valor: string, contexto: string) {
  const { plana, cifrada } = await kms.gerarChaveDados(contexto);
  const tam = Buffer.alloc(2);
  tam.writeUInt16BE(cifrada.length);
  return Buffer.concat([tam, cifrada, cifrarCampo(plana, valor, contexto)]);
}

export async function abrir(kms: Kms, blob: Buffer, contexto: string) {
  const tam = blob.readUInt16BE(0);
  const dek = await kms.abrirChaveDados(blob.subarray(2, 2 + tam), contexto);
  return decifrarCampo(dek, blob.subarray(2 + tam), contexto);
}

/** Índice cego: HMAC do valor normalizado, por escritório, para buscar sem decifrar. */
export function hmacBusca(chave: string, organizacaoId: string, valor: string) {
  return createHmac('sha256', Buffer.from(chave, 'base64')).update(`${organizacaoId}:${valor}`).digest('hex');
}

/** Token aleatório (256 bits) e o hash que vai para o banco. */
export function novoToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function novoCodigoSeisDigitos() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function iguais(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
