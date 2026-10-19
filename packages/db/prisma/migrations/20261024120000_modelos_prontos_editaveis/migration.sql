-- O escritório pode editar um modelo pronto da Trames: a edição vira um modelo do
-- escritório com base_id apontando para o pronto, que deixa de aparecer para ele.
ALTER TABLE "modelos" ADD COLUMN "base_id" UUID;
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "modelos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "modelos_organizacao_id_base_id_key" ON "modelos"("organizacao_id", "base_id");
