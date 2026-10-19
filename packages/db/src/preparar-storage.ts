/*
 * Cria os buckets em desenvolvimento (moto) com CORS para o upload
 * direto do navegador. Em produção os buckets vêm da infraestrutura.
 */
import { CreateBucketCommand, PutBucketCorsCommand, PutBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';
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
/*
 * Ciclo de vida: rede de segurança da retenção (o worker apaga no prazo; isto
 * pega o que escapar). Nenhum arquivo sobrevive mais de 35 dias além do prazo:
 * versões antigas saem em 30 dias, a quarentena e os ZIPs em 2.
 * Em produção, a mesma regra vai na infraestrutura, junto com a retenção dos
 * backups do RDS (no máximo 35 dias).
 */
const regras = {
  [BUCKET_QUARENTENA]: [{ ID: 'quarentena', Status: 'Enabled' as const, Filter: { Prefix: '' }, Expiration: { Days: 2 }, AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 } }],
  [BUCKET_DOCUMENTOS]: [
    { ID: 'exportacoes', Status: 'Enabled' as const, Filter: { Prefix: 'exportacoes/' }, Expiration: { Days: 2 } },
    { ID: 'versoes-antigas', Status: 'Enabled' as const, Filter: { Prefix: '' }, NoncurrentVersionExpiration: { NoncurrentDays: 30 }, AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 } },
  ],
};
for (const [Bucket, Rules] of Object.entries(regras)) {
  await s3.send(new PutBucketLifecycleConfigurationCommand({ Bucket, LifecycleConfiguration: { Rules } })).catch(() => console.log(`Ciclo de vida não suportado aqui (${Bucket}).`));
}
console.log('Buckets prontos.');
