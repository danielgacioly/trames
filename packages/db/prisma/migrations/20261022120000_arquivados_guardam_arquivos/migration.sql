-- Só os balcões concluídos têm os arquivos apagados pela retenção. Os arquivados
-- guardam os arquivos até serem reabertos e concluídos.
UPDATE balcoes SET apagar_arquivos_em = NULL, aviso_retencao_em = NULL
WHERE arquivado_em IS NOT NULL AND arquivos_apagados_em IS NULL;
