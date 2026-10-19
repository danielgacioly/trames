-- Perfil da pessoa (cargo) e redefinição de senha por e-mail.
ALTER TABLE "usuarios" ADD COLUMN "cargo" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "redefinicao_hash" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "redefinicao_expira_em" TIMESTAMP(3);
CREATE UNIQUE INDEX "usuarios_redefinicao_hash_key" ON "usuarios"("redefinicao_hash");

-- Sessão: de onde entrou, para a lista de aparelhos conectados.
ALTER TABLE "sessoes" ADD COLUMN "aparelho" TEXT;

-- Busca antes de saber o escritório: o link de redefinição chega sem cookie.
CREATE OR REPLACE FUNCTION auth_redefinicao(p_token_hash text)
  RETURNS TABLE (usuario_id uuid, organizacao_id uuid, expira_em timestamp)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT id, organizacao_id, redefinicao_expira_em FROM usuarios WHERE redefinicao_hash = p_token_hash $$;
REVOKE ALL ON FUNCTION auth_redefinicao(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_redefinicao(text) TO trames_app;
