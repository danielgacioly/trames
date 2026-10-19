-- Ajustes de viabilidade comercial (docs/viabilidade.md).
-- Planos com excedente e cotas, sessão do cliente de 30 dias, lembretes por cadência,
-- retenção por plano, exportação em ZIP e edição da lista de balcões abertos.

-- CreateEnum
CREATE TYPE "Periodicidade" AS ENUM ('mensal', 'anual');

-- CreateEnum
CREATE TYPE "StatusExportacao" AS ENUM ('pendente', 'pronta', 'falhou');

-- AlterTable
ALTER TABLE "assinaturas" ADD COLUMN     "periodicidade" "Periodicidade" NOT NULL DEFAULT 'mensal';

-- AlterTable
ALTER TABLE "balcoes" ADD COLUMN     "apagar_arquivos_em" TIMESTAMP(3),
ADD COLUMN     "aviso_retencao_em" TIMESTAMP(3),
ADD COLUMN     "canal_codigo" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "canal_lembrete" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "lembretes_enviados" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ultimo_aviso_mudanca_em" TIMESTAMP(3),
ALTER COLUMN "lembrete" SET DEFAULT true;

-- AlterTable
ALTER TABLE "itens_balcao" ADD COLUMN     "pedido_de_novo_em" TIMESTAMP(3),
ADD COLUMN     "removido_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "links_acesso" ADD COLUMN     "token_selado" BYTEA;

-- CreateTable
CREATE TABLE "uso_mensal" (
    "organizacao_id" UUID NOT NULL,
    "mes" TEXT NOT NULL,
    "balcoes_criados" INTEGER NOT NULL DEFAULT 0,
    "whatsapp_enviados" INTEGER NOT NULL DEFAULT 0,
    "aviso_180_em" TIMESTAMP(3),
    "aviso_200_em" TIMESTAMP(3),
    "aviso_cota_whatsapp_em" TIMESTAMP(3),

    CONSTRAINT "uso_mensal_pkey" PRIMARY KEY ("organizacao_id","mes")
);

-- CreateTable
CREATE TABLE "itens_cobranca" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "mes_referencia" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "balcao_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "faturado_em" TIMESTAMP(3),

    CONSTRAINT "itens_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exportacoes" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "balcao_id" UUID NOT NULL,
    "pedida_por_id" UUID,
    "status" "StatusExportacao" NOT NULL DEFAULT 'pendente',
    "chave" TEXT,
    "tamanho" BIGINT,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pronta_em" TIMESTAMP(3),
    "expira_em" TIMESTAMP(3),

    CONSTRAINT "exportacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "itens_cobranca_organizacao_id_mes_referencia_idx" ON "itens_cobranca"("organizacao_id", "mes_referencia");

-- CreateIndex
CREATE INDEX "exportacoes_organizacao_id_balcao_id_idx" ON "exportacoes"("organizacao_id", "balcao_id");

-- AddForeignKey
ALTER TABLE "uso_mensal" ADD CONSTRAINT "uso_mensal_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_cobranca" ADD CONSTRAINT "itens_cobranca_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exportacoes" ADD CONSTRAINT "exportacoes_balcao_id_fkey" FOREIGN KEY ("balcao_id") REFERENCES "balcoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS nas tabelas novas
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['uso_mensal','itens_cobranca','exportacoes']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY isolamento ON %I USING (organizacao_id = app_organizacao()) WITH CHECK (organizacao_id = app_organizacao())', t);
  END LOOP;
END $$;

-- Retenção: no Ultra vale 30, 90, 180 ou 365 dias.
UPDATE organizacoes SET dias_retencao = 90 WHERE dias_retencao NOT IN (30, 90, 180, 365);

-- Balcões já concluídos ganham a data de exclusão pela regra do plano atual.
UPDATE balcoes b SET apagar_arquivos_em = b.concluido_em + make_interval(days =>
  CASE COALESCE((SELECT a.plano FROM assinaturas a WHERE a.organizacao_id = b.organizacao_id AND a.status = 'ativa' ORDER BY a.inicio_em DESC LIMIT 1), 'gratis')
    WHEN 'gratis' THEN 30 WHEN 'pro' THEN 90
    ELSE (SELECT o.dias_retencao FROM organizacoes o WHERE o.id = b.organizacao_id) END)
WHERE b.concluido_em IS NOT NULL AND b.arquivos_apagados_em IS NULL;

-- A sessão do cliente cai também quando o balcão é concluído.
CREATE OR REPLACE FUNCTION acesso_sessao_cliente(p_token_hash text)
  RETURNS TABLE (id uuid, organizacao_id uuid, balcao_id uuid, link_id uuid, expira_em timestamp)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT s.id, s.organizacao_id, s.balcao_id, s.link_id, s.expira_em
          FROM sessoes_cliente s
          JOIN links_acesso l ON l.id = s.link_id
          JOIN balcoes b ON b.id = s.balcao_id
         WHERE s.token_hash = p_token_hash AND s.expira_em > now()
           AND l.revogado_em IS NULL AND l.expira_em > now() AND b.concluido_em IS NULL $$;
