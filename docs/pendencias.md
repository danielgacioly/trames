# Pendências

O que falta para colocar a Trames em produção e não deu para fazer no código.

## Decisões em aberto: como ficaram

As cinco decisões de `arquitetura.md` seguiram a recomendação:

1. **Fila:** pg-boss, no próprio Postgres. A troca por BullMQ fica concentrada em `apps/api/src/infra/fila.ts` e `apps/worker/src/main.ts`.
2. **Login:** implementação própria (argon2id + código de 6 dígitos por e-mail como segundo fator; o app autenticador foi descartado).
3. **Hospedagem:** o código está pronto para AWS em São Paulo (S3, KMS, SES, `sa-east-1`), mas nada foi provisionado.
4. **Front:** dois apps, `web` e `balcao`.
5. **RLS:** ativo desde a primeira migração.

## Infraestrutura (precisa de conta AWS)

- [ ] Provisionar em `sa-east-1`: RDS Postgres, S3 (buckets `quarentena` e `documentos`, privados, SSE-KMS, bloqueio de acesso público), chave no KMS, Secrets Manager, ECS (api e worker), CloudFront (web e balcao) e VPC. Ainda não há infraestrutura como código (Terraform/CDK).
- [ ] Criar o papel `trames_app` no RDS com senha do Secrets Manager. No deploy, rodar como dono: `pnpm db:migrate` e depois `pnpm fila:instalar`.
- [ ] Domínios e cookies. Os cookies são `SameSite=Strict` e a API supõe a mesma origem (`/api` atrás do CloudFront). É preciso decidir os domínios, por exemplo `app.trames.app/api` e `balcao.trames.app/api`, e configurar `URL_WEB` e `URL_BALCAO`.
- [ ] Configurar o CORS do bucket `quarentena` para a origem do balcão. Configurar a política de CSP também como cabeçalho no CloudFront (hoje ela vai numa `<meta>` no build).
- [ ] Backups que expiram: retenção dos backups automáticos do RDS e regra de ciclo de vida para versões antigas no S3.
- [ ] Rate limit compartilhado. Hoje ele fica na memória de cada instância; com mais de uma instância da API, precisa de um store comum (Postgres ou Redis).
- [ ] Observabilidade: logs no CloudWatch e alertas para a fila parada, jobs que falharam e documentos presos em quarentena.
- [ ] Rotação de chaves: ativar a rotação automática do KMS e definir como girar a `CHAVE_HMAC`, que exige recalcular os índices.

## Serviços de terceiros

- [ ] **Antivírus:** ClamAV com `freshclam` em produção (sidecar do worker). Aqui a rede bloqueou o download das assinaturas, então testei só com uma assinatura local do EICAR. A detecção funcionou. Se o clamd cair, o job tenta 5 vezes e o arquivo fica em quarentena: falta um alerta e um jeito de reprocessar.
- [ ] **WhatsApp:** conta WhatsApp Business (Meta) verificada, número e **templates aprovados**. Mensagem iniciada pela empresa fora da janela de 24 h só pode sair por template; o código atual manda texto livre. A Meta entra como suboperadora.
- [ ] **E-mail:** Amazon SES em `sa-east-1` com domínio verificado (SPF, DKIM, DMARC) e fora do sandbox. Agora é também por onde passa o segundo fator do login: sem ele em produção, ninguém do escritório entra. Vale monitorar a entrega e ter um remetente reservado só para códigos.
- [ ] **Turu com Claude:** configurar `ANTHROPIC_API_KEY`. Não testei a chamada real (não havia chave aqui); testei só o modo sem IA. A Anthropic precisa constar como suboperadora. Também falta confirmar as condições de retenção de dados e o fato de o processamento acontecer fora do Brasil.
- [ ] **Pagamento:** escolher o provedor (Pix, cartão e nota fiscal: Asaas, Pagar.me, Iugu, Stripe…). Falta implementar no módulo `cobranca`: assinatura, webhooks, inadimplência e o que fazer quando alguém desce de plano tendo mais balcões ativos que o novo limite. Hoje a troca de plano é só simulada (`COBRANCA_SIMULADA=1`).

## Jurídico e LGPD

- [ ] Contrato de operador com cada assinante, com a lista de suboperadores: AWS, Anthropic, Meta e o provedor de pagamento.
- [ ] Nomear o encarregado (DPO).
- [ ] Política de privacidade e termos de uso (os links do site ainda apontam para `#`).
- [ ] Registro das operações de tratamento e relatório de impacto (RIPD).
- [ ] **Pentest externo** antes de lançar.

## Funcionalidades que faltam

- [ ] "Esqueci a senha". Com o código por e-mail, o segundo fator não precisa de recuperação própria, mas a troca de senha precisa existir. Atenção: quem controla o e-mail da pessoa passa a ter os dois fatores; a troca de senha deve pedir o código e avisar por e-mail.
- [ ] Exportação do titular com os arquivos. Hoje ela leva os dados e a lista de arquivos; falta um ZIP gerado pelo worker, com URL temporária.
- [ ] Avisar o cliente pelo WhatsApp quando um documento é recusado. Hoje ele só vê ao abrir o link.
- [ ] Miniatura de PDF e de HEIC. Hoje só imagens JPG, PNG e WebP ganham miniatura.
- [ ] "Sair de todos os aparelhos" e lista de sessões ativas.
- [ ] CI (GitHub Actions) com Postgres, para rodar os testes e o typecheck a cada PR.
- [ ] Teste de ponta a ponta no repositório. Rodei um com Playwright durante o desenvolvimento, mas ele não foi versionado.
- [ ] Logos oficiais em `apps/*/public/marca/`. Os atuais foram redesenhados porque os SVGs do canvas não puderam ser exportados.

## Decisões de produto para confirmar

- [ ] **Lembrete gera link novo.** Como o banco guarda só o hash do link, o lembrete (manual ou automático) gera um link novo e revoga o anterior. Quem abrir um link antigo vê a mensagem "use o link da mensagem mais recente". A alternativa seria guardar o token cifrado, mas a arquitetura pede só o hash.
- [ ] **Permissões fora do Ultra.** No Grátis e no Pro todo mundo administra. Avaliar se é isso mesmo.
- [ ] **Segundo fator para todos.** O código por e-mail vale para todas as pessoas da conta, não só para quem administra (a arquitetura pedia "pelo menos admins"). Como não exige instalar nada, ficou para todos.
- [ ] **Prazo do link.** O link vence 30 dias depois do prazo do balcão e é revogado quando o balcão é concluído.
