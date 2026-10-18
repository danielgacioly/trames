import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TAMANHO_MAXIMO_ARQUIVO, VALIDADE_URL_DOWNLOAD, VALIDADE_URL_UPLOAD } from '@trames/shared';

/*
 * Storage compatível com S3, dois buckets privados:
 *  - quarentena: recebe o upload direto do celular (URL assinada, poucos minutos)
 *  - documentos: só recebe arquivos que passaram no antivírus e na checagem de tipo
 * O arquivo nunca passa pela API nem vai para o Postgres.
 */

export const BUCKET_QUARENTENA = process.env.S3_BUCKET_QUARENTENA ?? 'trames-quarentena';
export const BUCKET_DOCUMENTOS = process.env.S3_BUCKET_DOCUMENTOS ?? 'trames-documentos';

function cliente(endpoint?: string) {
  return new S3Client({
    region: process.env.AWS_REGION ?? 'sa-east-1',
    endpoint,
    forcePathStyle: !!endpoint,
  });
}

/** Cliente interno (worker/API → S3). */
export const s3 = cliente(process.env.S3_ENDPOINT || undefined);
/** Cliente usado só para assinar URLs que o navegador vai abrir (em dev, o endpoint visto de fora pode ser outro). */
const s3Publico = cliente(process.env.S3_ENDPOINT_PUBLICO || process.env.S3_ENDPOINT || undefined);

/** Chave aleatória, sem nome de arquivo nem dado pessoal. */
export const chaveDocumento = (organizacaoId: string, documentoId: string) => `${organizacaoId}/${documentoId}`;
export const chaveMiniatura = (organizacaoId: string, documentoId: string) => `${organizacaoId}/${documentoId}.miniatura.webp`;

/** POST assinado: o S3 recusa arquivo maior que o limite ou com outro Content-Type. */
export function urlDeUpload(chave: string, tipo: string, tamanho: number) {
  return createPresignedPost(s3Publico, {
    Bucket: BUCKET_QUARENTENA,
    Key: chave,
    Expires: VALIDADE_URL_UPLOAD,
    Conditions: [
      ['content-length-range', 1, Math.min(tamanho, TAMANHO_MAXIMO_ARQUIVO)],
      ['eq', '$Content-Type', tipo],
    ],
    Fields: { 'Content-Type': tipo },
  });
}

export function urlDeDownload(bucket: string, chave: string, nomeArquivo: string, tipo: string, baixar: boolean) {
  const nome = nomeArquivo.replace(/[^\w.\- ]/g, '_');
  return getSignedUrl(
    s3Publico,
    new GetObjectCommand({ Bucket: bucket, Key: chave, ResponseContentDisposition: `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`, ResponseContentType: tipo }),
    { expiresIn: VALIDADE_URL_DOWNLOAD },
  );
}

export async function existe(bucket: string, chave: string) {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: chave }));
    return { tamanho: r.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

export async function baixar(bucket: string, chave: string) {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: chave }));
  return Buffer.from(await r.Body!.transformToByteArray());
}

export function enviar(bucket: string, chave: string, corpo: Buffer, tipo: string) {
  return s3.send(new PutObjectCommand({ Bucket: bucket, Key: chave, Body: corpo, ContentType: tipo, ServerSideEncryption: process.env.S3_ENDPOINT ? undefined : 'aws:kms' }));
}

/** Da quarentena para documentos. */
export async function moverParaDocumentos(chave: string, tipo: string) {
  await s3.send(
    new CopyObjectCommand({
      Bucket: BUCKET_DOCUMENTOS,
      Key: chave,
      CopySource: `${BUCKET_QUARENTENA}/${chave}`,
      ContentType: tipo,
      MetadataDirective: 'REPLACE',
      ServerSideEncryption: process.env.S3_ENDPOINT ? undefined : 'aws:kms',
    }),
  );
  await apagar(BUCKET_QUARENTENA, chave);
}

export function apagar(bucket: string, chave: string) {
  return s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: chave }));
}
