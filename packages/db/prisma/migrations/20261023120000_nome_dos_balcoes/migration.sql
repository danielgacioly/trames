-- Como o escritório chama os balcões (processos, projetos...). Vale para o painel e as mensagens.
ALTER TABLE "organizacoes" ADD COLUMN "termo_singular" TEXT NOT NULL DEFAULT 'balcão';
ALTER TABLE "organizacoes" ADD COLUMN "termo_plural" TEXT NOT NULL DEFAULT 'balcões';
ALTER TABLE "organizacoes" ADD COLUMN "termo_feminino" BOOLEAN NOT NULL DEFAULT false;
