-- Row-Level Security: segunda barreira entre escritórios.
-- A aplicação conecta como trames_app, que não é dona das tabelas, então o RLS
-- vale para toda query. Cada transação define app.organizacao_id com
-- set_config(..., TRUE); sem ele definido, as políticas não devolvem nada.

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'trames_app') THEN
    CREATE ROLE trames_app NOLOGIN; -- a infraestrutura dá LOGIN e senha
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_organizacao() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.organizacao_id', true), '')::uuid $$;

-- Tabelas com organizacao_id obrigatório
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assinaturas','usuarios','sessoes','clientes','balcoes','itens_balcao','documentos',
                           'links_acesso','codigos_acesso','sessoes_cliente','caixa_saida_dev']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY isolamento ON %I USING (organizacao_id = app_organizacao()) WITH CHECK (organizacao_id = app_organizacao())', t);
  END LOOP;
END $$;

ALTER TABLE organizacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolamento ON organizacoes USING (id = app_organizacao()) WITH CHECK (id = app_organizacao());

-- Modelos: os da Trames (organizacao_id nulo) são lidos por todos; só os próprios podem ser escritos.
ALTER TABLE modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON modelos FOR SELECT USING (organizacao_id IS NULL OR organizacao_id = app_organizacao());
CREATE POLICY escrita ON modelos FOR INSERT WITH CHECK (organizacao_id = app_organizacao());
CREATE POLICY alteracao ON modelos FOR UPDATE USING (organizacao_id = app_organizacao()) WITH CHECK (organizacao_id = app_organizacao());
CREATE POLICY exclusao ON modelos FOR DELETE USING (organizacao_id = app_organizacao());

ALTER TABLE itens_modelo ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON itens_modelo FOR SELECT USING (organizacao_id IS NULL OR organizacao_id = app_organizacao());
CREATE POLICY escrita ON itens_modelo FOR INSERT WITH CHECK (organizacao_id = app_organizacao());
CREATE POLICY alteracao ON itens_modelo FOR UPDATE USING (organizacao_id = app_organizacao()) WITH CHECK (organizacao_id = app_organizacao());
CREATE POLICY exclusao ON itens_modelo FOR DELETE USING (organizacao_id = app_organizacao());

-- Auditoria: só inclusão e leitura, sempre do próprio escritório.
ALTER TABLE eventos_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON eventos_auditoria FOR SELECT USING (organizacao_id = app_organizacao());
CREATE POLICY inclusao ON eventos_auditoria FOR INSERT WITH CHECK (organizacao_id = app_organizacao());

CREATE OR REPLACE FUNCTION auditoria_sem_alteracao() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'eventos_auditoria é append-only';
END $$;
CREATE TRIGGER auditoria_append_only BEFORE UPDATE OR DELETE ON eventos_auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_sem_alteracao();

-- Permissões do papel da aplicação
GRANT USAGE ON SCHEMA public TO trames_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trames_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trames_app;
REVOKE UPDATE, DELETE, TRUNCATE ON eventos_auditoria FROM trames_app;
REVOKE ALL ON _prisma_migrations FROM trames_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trames_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO trames_app;

-- Fila do worker (pg-boss) num schema próprio
CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION trames_app;

-- Buscas antes de saber o escritório. SECURITY DEFINER: rodam como dono,
-- ignoram o RLS e devolvem só o mínimo.
CREATE OR REPLACE FUNCTION auth_usuario_por_email(p_email text)
  RETURNS TABLE (id uuid, organizacao_id uuid, senha_hash text, totp_ativo boolean, permissao "Permissao")
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT id, organizacao_id, senha_hash, totp_ativo, permissao FROM usuarios WHERE email = lower(p_email) $$;

CREATE OR REPLACE FUNCTION auth_sessao(p_token_hash text)
  RETURNS TABLE (id uuid, organizacao_id uuid, usuario_id uuid, segundo_fator boolean, expira_em timestamp)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT id, organizacao_id, usuario_id, segundo_fator, expira_em FROM sessoes WHERE token_hash = p_token_hash AND expira_em > now() $$;

CREATE OR REPLACE FUNCTION auth_convite(p_token_hash text)
  RETURNS TABLE (usuario_id uuid, organizacao_id uuid, expira_em timestamp)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT id, organizacao_id, convite_expira_em FROM usuarios WHERE convite_hash = p_token_hash $$;

CREATE OR REPLACE FUNCTION acesso_link(p_token_hash text)
  RETURNS TABLE (id uuid, organizacao_id uuid, balcao_id uuid, expira_em timestamp, revogado_em timestamp)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT id, organizacao_id, balcao_id, expira_em, revogado_em FROM links_acesso WHERE token_hash = p_token_hash $$;

CREATE OR REPLACE FUNCTION acesso_sessao_cliente(p_token_hash text)
  RETURNS TABLE (id uuid, organizacao_id uuid, balcao_id uuid, link_id uuid, expira_em timestamp)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT s.id, s.organizacao_id, s.balcao_id, s.link_id, s.expira_em
          FROM sessoes_cliente s JOIN links_acesso l ON l.id = s.link_id
         WHERE s.token_hash = p_token_hash AND s.expira_em > now() AND l.revogado_em IS NULL AND l.expira_em > now() $$;

CREATE OR REPLACE FUNCTION worker_organizacoes()
  RETURNS TABLE (id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT id FROM organizacoes ORDER BY id $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['auth_usuario_por_email(text)','auth_sessao(text)','auth_convite(text)','acesso_link(text)',
                           'acesso_sessao_cliente(text)','worker_organizacoes()']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO trames_app', f);
  END LOOP;
END $$;
