-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('gratis', 'pro', 'ultra');

-- CreateEnum
CREATE TYPE "Area" AS ENUM ('contabilidade', 'advocacia', 'saude');

-- CreateEnum
CREATE TYPE "Permissao" AS ENUM ('admin', 'monta', 'confere');

-- CreateEnum
CREATE TYPE "StatusItem" AS ENUM ('pendente', 'analise', 'aprovado', 'recusado');

-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('quarentena', 'disponivel', 'rejeitado', 'apagado');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('ativa', 'cancelada', 'inadimplente');

-- CreateEnum
CREATE TYPE "TipoAtor" AS ENUM ('usuario', 'cliente', 'sistema');

-- CreateTable
CREATE TABLE "organizacoes" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#13594b',
    "area" "Area" NOT NULL DEFAULT 'advocacia',
    "dias_retencao" INTEGER NOT NULL DEFAULT 90,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "plano" "Plano" NOT NULL,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'ativa',
    "inicio_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim_em" TIMESTAMP(3),
    "provedor_id" TEXT,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT,
    "permissao" "Permissao" NOT NULL DEFAULT 'admin',
    "totp_cifrado" BYTEA,
    "totp_ativo" BOOLEAN NOT NULL DEFAULT false,
    "convite_hash" TEXT,
    "convite_expira_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "segundo_fator" BOOLEAN NOT NULL DEFAULT false,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "chave_cifrada" BYTEA NOT NULL,
    "cpf_cifrado" BYTEA,
    "cpf_hmac" TEXT,
    "telefone_cifrado" BYTEA NOT NULL,
    "telefone_hmac" TEXT NOT NULL,
    "telefone_final" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balcoes" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "protocolo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT '',
    "prazo" DATE NOT NULL,
    "lembrete" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_lembrete_em" TIMESTAMP(3),
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMP(3),
    "arquivos_apagados_em" TIMESTAMP(3),

    CONSTRAINT "balcoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_balcao" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "balcao_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL DEFAULT '',
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "status" "StatusItem" NOT NULL DEFAULT 'pendente',
    "motivo_recusa" TEXT,

    CONSTRAINT "itens_balcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "balcao_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "chave" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "tipo_declarado" TEXT NOT NULL,
    "tipo_real" TEXT,
    "tamanho" INTEGER NOT NULL,
    "status" "StatusDocumento" NOT NULL DEFAULT 'quarentena',
    "motivo" TEXT,
    "chave_miniatura" TEXT,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificado_em" TIMESTAMP(3),
    "apagado_em" TIMESTAMP(3),

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID,
    "area" "Area" NOT NULL,
    "nome" TEXT NOT NULL,
    "quando" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_modelo" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID,
    "modelo_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL DEFAULT '',
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "itens_modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links_acesso" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "balcao_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "revogado_em" TIMESTAMP(3),

    CONSTRAINT "links_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_acesso" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_cliente" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    "balcao_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "ator_tipo" "TipoAtor" NOT NULL,
    "ator_id" UUID,
    "acao" TEXT NOT NULL,
    "alvo_tipo" TEXT NOT NULL,
    "alvo_id" UUID,
    "ip" TEXT,
    "detalhes" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caixa_saida_dev" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "balcao_id" UUID,
    "canal" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caixa_saida_dev_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assinaturas_organizacao_id_status_idx" ON "assinaturas"("organizacao_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_convite_hash_key" ON "usuarios"("convite_hash");

-- CreateIndex
CREATE INDEX "usuarios_organizacao_id_idx" ON "usuarios"("organizacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_organizacao_id_idx" ON "sessoes"("organizacao_id");

-- CreateIndex
CREATE INDEX "clientes_organizacao_id_cpf_hmac_idx" ON "clientes"("organizacao_id", "cpf_hmac");

-- CreateIndex
CREATE INDEX "clientes_organizacao_id_telefone_hmac_idx" ON "clientes"("organizacao_id", "telefone_hmac");

-- CreateIndex
CREATE INDEX "balcoes_organizacao_id_concluido_em_idx" ON "balcoes"("organizacao_id", "concluido_em");

-- CreateIndex
CREATE UNIQUE INDEX "balcoes_organizacao_id_protocolo_key" ON "balcoes"("organizacao_id", "protocolo");

-- CreateIndex
CREATE INDEX "itens_balcao_organizacao_id_balcao_id_idx" ON "itens_balcao"("organizacao_id", "balcao_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_chave_key" ON "documentos"("chave");

-- CreateIndex
CREATE INDEX "documentos_organizacao_id_item_id_idx" ON "documentos"("organizacao_id", "item_id");

-- CreateIndex
CREATE INDEX "modelos_organizacao_id_idx" ON "modelos"("organizacao_id");

-- CreateIndex
CREATE INDEX "itens_modelo_modelo_id_idx" ON "itens_modelo"("modelo_id");

-- CreateIndex
CREATE UNIQUE INDEX "links_acesso_token_hash_key" ON "links_acesso"("token_hash");

-- CreateIndex
CREATE INDEX "links_acesso_organizacao_id_balcao_id_idx" ON "links_acesso"("organizacao_id", "balcao_id");

-- CreateIndex
CREATE INDEX "codigos_acesso_organizacao_id_link_id_idx" ON "codigos_acesso"("organizacao_id", "link_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_cliente_token_hash_key" ON "sessoes_cliente"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_cliente_organizacao_id_idx" ON "sessoes_cliente"("organizacao_id");

-- CreateIndex
CREATE INDEX "eventos_auditoria_organizacao_id_alvo_tipo_alvo_id_idx" ON "eventos_auditoria"("organizacao_id", "alvo_tipo", "alvo_id");

-- CreateIndex
CREATE INDEX "eventos_auditoria_organizacao_id_criado_em_idx" ON "eventos_auditoria"("organizacao_id", "criado_em");

-- CreateIndex
CREATE INDEX "caixa_saida_dev_organizacao_id_balcao_id_idx" ON "caixa_saida_dev"("organizacao_id", "balcao_id");

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balcoes" ADD CONSTRAINT "balcoes_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balcoes" ADD CONSTRAINT "balcoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_balcao" ADD CONSTRAINT "itens_balcao_balcao_id_fkey" FOREIGN KEY ("balcao_id") REFERENCES "balcoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_balcao_id_fkey" FOREIGN KEY ("balcao_id") REFERENCES "balcoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itens_balcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_modelo" ADD CONSTRAINT "itens_modelo_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links_acesso" ADD CONSTRAINT "links_acesso_balcao_id_fkey" FOREIGN KEY ("balcao_id") REFERENCES "balcoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_acesso" ADD CONSTRAINT "codigos_acesso_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links_acesso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_cliente" ADD CONSTRAINT "sessoes_cliente_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links_acesso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
