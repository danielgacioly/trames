# Pendências

O que falta para colocar a Trames em produção e não deu para fazer no código. Inclui os ajustes de `docs/viabilidade.md`.

## Decisões tomadas

Resolvidas a pedido, pensando em segurança e escalabilidade:

1. **Links só com hash.** O banco não guarda nenhum token de link, nem cifrado. Cada mensagem (lembrete, aviso de mudança, "Link do cliente") emite um link novo e os anteriores continuam valendo; a sessão de 30 dias vale para o balcão, por qualquer link ativo dele. "Cancelar links e gerar novo" revoga todos e derruba as sessões. Com isso um vazamento do banco não entrega nenhum link. Os links vencidos há mais de 90 dias são apagados pelo worker, para a tabela não crescer sem limite.
2. **Limite de código por balcão no banco.** Como um balcão tem vários links, o limite de pedidos de código (10 por hora) e de erros (15 a cada 15 minutos) é contado no Postgres por balcão, somando todos os links e todas as instâncias da API. O limite por IP continua na memória de cada instância.
3. **Arquivamento.** Existe o estado "arquivado": manual (botão Arquivar) ou automático, 30 dias depois do prazo, sempre com aviso ao admin uma semana antes. Arquivado deixa de contar como ativo, o acesso do cliente cai e a retenção começa, como na conclusão. Reabrir desfaz enquanto os arquivos existirem. Mudar o prazo cancela o aviso.
4. **E-mail do cliente obrigatório em todos os planos.** É o canal que sempre funciona e o destino de qualquer queda: cota de WhatsApp esgotada ou erro no envio pelo WhatsApp (nesse caso a mensagem não conta na cota). Com isso deixa de existir mensagem que não sai.
5. **Aviso de mudança na lista só por e-mail**, sem custo de WhatsApp.
6. **Retenção quando o plano ou a escolha diminui.** Os balcões já encerrados passam a seguir o prazo novo, com no mínimo 7 dias a partir da mudança, para o aviso por e-mail ainda sair. Quando aumenta, as datas já marcadas não mudam.

Ficam como estavam (confirme se concordar):

7. **Lembretes.** Saem só enquanto faltar documento obrigatório. Se o worker ficar parado e perder uma etapa, sai só a mais recente. Mudar o prazo recomeça a cadência.
8. **O mês vira no fuso de Brasília** para a contagem de balcões do Ultra e para as cotas.
9. **Permissões fora do Ultra:** no Grátis e no Pro todo mundo administra.

## Infraestrutura (precisa de conta AWS)

- [ ] **Saída para a internet sem NAT Gateway.** O documento prevê VPC endpoints e nenhum NAT, mas o worker precisa chamar a API do WhatsApp (graph.facebook.com) e o gateway de pagamento, que não têm endpoint na VPC. Opções: uma NAT instance pequena (bem mais barata que o NAT Gateway) ou o worker numa subnet pública, com IP público e security group só de saída. É preciso decidir antes de provisionar.
- [ ] Provisionar em `sa-east-1`, com infraestrutura como código (Terraform ou CDK): RDS Postgres numa zona só, instância pequena, backups criptografados; S3 (`quarentena` e `documentos`, privados, SSE-KMS, sem acesso público); KMS; Secrets Manager; ECS Fargate (1 API, 1 worker); CloudFront para `web` e `balcao`; VPC com endpoints para S3, KMS, SES e Secrets Manager. Meta de custo fixo: cerca de US$ 200 por mês.
- [ ] **Retenção nos backups:** o RDS com no máximo 35 dias de backup automático, e o ciclo de vida dos buckets na infraestrutura igual ao de `packages/db/src/preparar-storage.ts`: quarentena em 2 dias, ZIPs em 2 dias, versões antigas em 30 dias. Assim nenhum arquivo passa de 35 dias além do prazo do plano.
- [ ] Autoescala: a API com 2 ou mais containers quando a CPU média passar de 60%; mais workers quando a fila acumular. Multi-AZ no RDS ao passar de 100 clientes pagantes.
- [ ] **Alertas de custo** (AWS Budgets e CloudWatch) usando como referência os números da seção 8 do `viabilidade.md`: custo por balcão, storage, saída de dados e mensagens de WhatsApp.
- [ ] Criar o papel `trames_app` no RDS com senha do Secrets Manager. No deploy, como dono: `pnpm db:migrate` e depois `pnpm fila:instalar` (cria as filas novas `exportar` e `avisar-mudanca`).
- [ ] Domínios e cookies (`SameSite=Strict`, API na mesma origem): por exemplo `app.trames.app/api` e `balcao.trames.app/api`, com `URL_WEB` e `URL_BALCAO`. CORS do bucket `quarentena` para o balcão. CSP também como cabeçalho no CloudFront.
- [ ] Rate limit por IP compartilhado entre instâncias (hoje fica na memória de cada uma; o limite por balcão já é no banco).
- [ ] Observabilidade: alertas para fila parada, jobs que falharam, documentos presos na quarentena, ZIP que falhou.
- [ ] Rotação de chaves: KMS automático e um plano para a `CHAVE_HMAC` (exige recalcular os índices).

## Serviços de terceiros

- [ ] **WhatsApp (Meta):** conta Business verificada, número e dois templates aprovados:
  - `trames_codigo`, na categoria **autenticação**, com o código no corpo e o botão "copiar código";
  - `trames_lembrete`, na categoria **utilidade**, só transacional, com 5 variáveis: nome do cliente, escritório, documentos pendentes, prazo e link.
  Os nomes podem mudar por `WHATSAPP_TEMPLATE_CODIGO` e `WHATSAPP_TEMPLATE_LEMBRETE`. Depois da aprovação, é preciso conferir o formato exato dos componentes em `apps/worker/src/mensagens.ts`: se o link vai como variável do corpo ou num botão de URL. Não testei a chamada real (não havia conta). A Meta entra como suboperadora.
- [ ] **E-mail:** Amazon SES em `sa-east-1`, fora do sandbox, com SPF, DKIM e DMARC. Agora é o canal padrão de tudo: código de login, código do cliente, lembretes, avisos de mudança, avisos ao admin (180/200 balcões, cota e retenção). Vale ter um remetente só para códigos e monitorar entrega e rejeição.
- [ ] **Pagamento (Pix e cartão):** escolher o provedor (Asaas, Pagar.me, Iugu, Stripe…) e implementar no módulo `cobranca`: assinatura mensal e anual (paga de uma vez), cobrança mensal dos `itens_cobranca` do mês anterior (no anual, à parte), marcar `faturado_em`, webhooks, inadimplência, nota fiscal, e o que fazer quando alguém desce de plano com mais balcões ativos que o novo limite. Hoje a troca de plano é simulada (`COBRANCA_SIMULADA=1`).
- [ ] **Antivírus:** ClamAV com `freshclam` em produção (sidecar do worker). Testei só com uma assinatura local do EICAR. Falta um alerta e um jeito de reprocessar quando o clamd cai.

## Segurança

- [ ] **Isolar a geração de miniatura de PDF.** O worker abre PDFs enviados por clientes com o pdf.js (versão 4.10, sem `eval`), com limite de 20 segundos. Falta limite de memória, idealmente rodando essa etapa num processo ou container separado, para um PDF malicioso ou pesado não derrubar o worker.
- [ ] **Pentest externo** antes de lançar, incluindo a sessão de 30 dias do cliente, os vários links por balcão e a geração de miniaturas.

## Jurídico e LGPD

- [ ] Contrato de operador com cada assinante, com a lista de suboperadores: AWS, Meta e o provedor de pagamento.
- [ ] Nomear o encarregado (DPO).
- [ ] Política de privacidade e termos de uso (os links do site ainda apontam para `#`). Precisam citar a retenção por plano e a sessão de 30 dias no aparelho do cliente.
- [ ] Registro das operações de tratamento e relatório de impacto (RIPD).

## Funcionalidades que faltam

- [ ] **Miniatura de HEIC.** O sharp pré-compilado não abre HEIC (codec HEVC). Hoje o HEIC chega e é conferido baixando o original. Também não há miniatura de PDF protegido por senha.
- [ ] "Esqueci a senha". Quem controla o e-mail da pessoa tem os dois fatores; a troca de senha deve pedir o código e avisar por e-mail.
- [ ] Exportação do titular com os arquivos (o ZIP do balcão já existe; falta um ZIP por cliente, na tela Clientes).
- [ ] Avisar o cliente quando um documento é recusado. Hoje ele só vê ao abrir o link (o lembrete seguinte também conta).
- [ ] "Sair de todos os aparelhos" e lista de sessões ativas para a equipe do escritório.
- [ ] CI (GitHub Actions) com Postgres, para rodar os testes e o typecheck a cada PR.
- [ ] Teste de ponta a ponta no repositório. Rodei com Playwright durante o desenvolvimento, mas não versionei.
