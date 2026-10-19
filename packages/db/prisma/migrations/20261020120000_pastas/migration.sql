-- Pastas que o escritório cria para organizar os balcões.
CREATE TABLE "pastas" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#13594b',
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pastas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pastas_organizacao_id_nome_key" ON "pastas"("organizacao_id", "nome");

ALTER TABLE "pastas" ADD CONSTRAINT "pastas_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "balcoes" ADD COLUMN "pasta_id" UUID;

ALTER TABLE "balcoes" ADD CONSTRAINT "balcoes_pasta_id_fkey" FOREIGN KEY ("pasta_id") REFERENCES "pastas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: uma pasta só existe para o escritório dela.
ALTER TABLE pastas ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolamento ON pastas USING (organizacao_id = app_organizacao()) WITH CHECK (organizacao_id = app_organizacao());
