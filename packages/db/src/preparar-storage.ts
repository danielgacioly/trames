/*
 * Cria os buckets em desenvolvimento (moto) com CORS para o upload
 * direto do navegador. Em produção os buckets vêm da infraestrutura.
 */
import { CreateBucketCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { BUCKET_DOCUMENTOS, BUCKET_QUARENTENA, s3 } from './armazenamento';

for (const Bucket of [BUCKET_QUARENTENA, BUCKET_DOCUMENTOS]) {
  await s3.send(new CreateBucketCommand({ Bucket, CreateBucketConfiguration: { LocationConstraint: 'sa-east-1' } })).catch((e) => {
    if (!/BucketAlready/.test(e.name)) throw e;
  });
}
// O moto e o S3 aceitam CORS por bucket; outros storages locais podem não aceitar.
await s3.send(
  new PutBucketCorsCommand({
    Bucket: BUCKET_QUARENTENA,
    CORSConfiguration: { CORSRules: [{ AllowedMethods: ['POST'], AllowedOrigins: [process.env.URL_BALCAO ?? 'http://localhost:5174'], AllowedHeaders: ['*'], MaxAgeSeconds: 600 }] },
  }),
).catch(() => console.log('CORS por bucket não suportado aqui; configure no servidor de storage.'));
console.log('Buckets prontos.');
