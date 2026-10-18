# Trames — Arquitetura

## O que é o Trames

Plataforma em que uma empresa (escritório de contabilidade, advocacia, consultório) cria um **balcão** para cada cliente com a lista de documentos que precisa. O cliente recebe um link, abre no celular e envia os arquivos. A empresa confere, aprova ou recusa cada documento.

- Planos: Grátis (3 balcões ativos), Pro (40, R$ 59/mês), Ultra (ilimitado, R$ 119/mês).
- **Turu**: assistente de IA que monta listas de documentos a partir da descrição do caso.
- Meta: centenas de assinantes. Prioridades: escalabilidade e segurança (LGPD muito rigorosa).

## Stack

- Front: React + TypeScript + Vite
- Back: Node.js + Express + TypeScript
- Banco: PostgreSQL
- ORM: Prisma
- Monorepo: pnpm workspaces + Turborepo

## Estrutura do monorepo

```
apps/
  web        → painel da empresa (React + Vite)
  balcao     → tela do cliente no celular (React + Vite, leve)
  api        → Express
  worker     → jobs assíncronos
packages/
  db         → schema Prisma e cliente
  shared     → schemas Zod e tipos usados no front e no back
```

O `balcao` fica separado do `web` para ter um pacote pequeno (o cliente abre pelo 4G) e para não expor o código do painel a quem só recebeu um link.

## Backend: monólito modular

Um backend só, sem microsserviços, dividido em módulos com fronteiras claras:

`auth`, `organizacoes`, `balcoes`, `documentos`, `modelos`, `acesso-cliente`, `turu`, `cobranca`, `auditoria`

Dois processos rodando do mesmo código:

- **api**: só responde requisições, nunca faz trabalho pesado.
- **worker**: antivírus nos uploads, miniaturas, envio de WhatsApp e e-mail, lembretes, expiração de links e exclusão de documentos vencidos.

## Arquivos

- O arquivo **nunca passa pela API nem vai para o Postgres**.
- Upload direto do celular para um storage compatível com S3, usando URL assinada gerada pela API e válida por poucos minutos.
- Dois buckets privados:
  1. `quarentena`: recebe o upload.
  2. `documentos`: o worker passa antivírus, confere o tipo real do arquivo pelos bytes e só então move o arquivo para cá.
- Download: a API confere a permissão e devolve uma URL assinada que vale cerca de 60 segundos.
- Região: São Paulo (`sa-east-1`).

## Multi-tenant

- Banco compartilhado, com `organizacao_id` em todas as tabelas de dados de escritório.
- **Row-Level Security no Postgres** como segunda barreira, para que uma query sem filtro nunca devolva dados de outro escritório.
- O Prisma não tem suporte nativo a RLS: usar uma extensão do client que define o `organizacao_id` da sessão (`set_config`) dentro de cada transação.
- Não usar um schema por escritório.

## Segurança e LGPD

**Papéis**
- O escritório é o controlador e a Trames é a operadora.
- É preciso ter contrato de operador com cada assinante, encarregado (DPO) nomeado e política de privacidade.

**Criptografia**
- TLS em tudo, banco e buckets criptografados em repouso.
- CPF e telefone com criptografia por envelope (KMS).
- Um hash HMAC ao lado de cada campo criptografado, para permitir busca sem decifrar.

**Acesso do cliente**
- Token do link aleatório com 128 bits ou mais. O banco guarda só o hash.
- Código de 6 dígitos enviado por WhatsApp (ou e-mail), com validade curta e limite de tentativas.
- O link pode ser revogado e renovado.

**Login da empresa**
- Senha com argon2id.
- 2FA (TOTP), obrigatório pelo menos para admins do escritório.

**Auditoria**
- Log de eventos só de inclusão (append-only): quem viu, baixou, aprovou, recusou ou apagou cada documento, quando e de qual IP.

**Retenção**
- Balcão concluído tem os arquivos apagados depois de X dias, configurável pelo escritório.
- Os backups também expiram.
- Exportação e exclusão de dados a pedido do titular.

**Logs**
- Nenhum dado pessoal nos logs da aplicação (nem CPF, nem nome de arquivo).

**Turu**
- Recebe só a descrição do caso, nunca os documentos.
- O provedor de IA é suboperador e precisa aparecer no contrato e na política.

**API**
- Validação com Zod em toda entrada.
- Rate limit, Helmet e CSP.
- Limite de tamanho de arquivo e checagem do tipo real pelos bytes.

**Antes de lançar**
- Pentest externo.

## Entidades principais

Organização, Usuário, Cliente, Balcão, Item do balcão (documento pedido), Documento (arquivo enviado), Modelo, Link de acesso, Evento de auditoria, Assinatura.

## Decisões em aberto

Ainda não decididas. Ao lado de cada uma está a recomendação.

1. **Fila do worker:** pg-boss (usa o próprio Postgres) ou BullMQ com Redis. Recomendação: pg-boss no começo.
2. **Login da empresa:** implementação própria ou serviço pronto (Clerk, Auth0). Recomendação: própria, porque serviço pronto guarda dados fora do Brasil e vira mais um suboperador.
3. **Hospedagem:** AWS completo em São Paulo (RDS, S3, ECS) ou algo mais simples (Render/Railway + S3), que costuma deixar o banco nos EUA. Recomendação: AWS em São Paulo.
4. **Front:** dois apps (`web` e `balcao`) ou um só com rotas separadas. Recomendação: dois.
5. **RLS:** desde o primeiro dia ou depois. Recomendação: desde o primeiro dia.
