-- O segundo fator deixa de ser o app autenticador (TOTP) e passa a ser um código
-- de 6 dígitos enviado ao e-mail de login, guardado na sessão só como HMAC.

ALTER TABLE "usuarios" DROP COLUMN "totp_cifrado", DROP COLUMN "totp_ativo";

ALTER TABLE "sessoes"
  ADD COLUMN "codigo_hash" TEXT,
  ADD COLUMN "codigo_expira_em" TIMESTAMP(3),
  ADD COLUMN "codigo_tentativas" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "caixa_saida_dev" ADD COLUMN "usuario_id" UUID;

-- A busca do login não devolve mais totp_ativo.
DROP FUNCTION auth_usuario_por_email(text);
CREATE FUNCTION auth_usuario_por_email(p_email text)
  RETURNS TABLE (id uuid, organizacao_id uuid, senha_hash text, permissao "Permissao")
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT id, organizacao_id, senha_hash, permissao FROM usuarios WHERE email = lower(p_email) $$;
REVOKE ALL ON FUNCTION auth_usuario_por_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_usuario_por_email(text) TO trames_app;
