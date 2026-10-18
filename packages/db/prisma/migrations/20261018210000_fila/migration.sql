-- A fila (pg-boss) é instalada pelo papel dono (pnpm fila:instalar) e usada pelo
-- trames_app, que só lê e escreve nas tabelas dela: ele não cria nem altera estrutura.
ALTER SCHEMA pgboss OWNER TO CURRENT_USER;
GRANT USAGE ON SCHEMA pgboss TO trames_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO trames_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trames_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT USAGE, SELECT ON SEQUENCES TO trames_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT EXECUTE ON FUNCTIONS TO trames_app;
