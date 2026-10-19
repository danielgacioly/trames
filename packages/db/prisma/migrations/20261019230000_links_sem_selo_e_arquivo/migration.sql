-- Links só com hash (sem token guardado): cada lembrete ou aviso leva um link novo,
-- sem revogar os anteriores. A sessão do cliente vale enquanto o balcão tiver
-- algum link ativo. Balcões abertos esquecidos são arquivados 30 dias depois do prazo.

-- AlterTable
ALTER TABLE "balcoes" ADD COLUMN     "arquivado_em" TIMESTAMP(3),
ADD COLUMN     "aviso_arquivo_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "links_acesso" DROP COLUMN "token_selado";


-- A sessão do cliente cai quando o balcão é encerrado ou quando nenhum link dele vale mais.
CREATE OR REPLACE FUNCTION acesso_sessao_cliente(p_token_hash text)
  RETURNS TABLE (id uuid, organizacao_id uuid, balcao_id uuid, link_id uuid, expira_em timestamp)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT s.id, s.organizacao_id, s.balcao_id, s.link_id, s.expira_em
          FROM sessoes_cliente s
          JOIN balcoes b ON b.id = s.balcao_id
         WHERE s.token_hash = p_token_hash AND s.expira_em > now() AND b.concluido_em IS NULL
           AND EXISTS (SELECT 1 FROM links_acesso l WHERE l.balcao_id = s.balcao_id AND l.revogado_em IS NULL AND l.expira_em > now()) $$;
