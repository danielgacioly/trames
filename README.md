# Trames

Uma empresa (escritório de contabilidade, advocacia, consultório) abre um **balcão** para cada cliente com a lista de documentos que precisa. O cliente recebe um link, abre no celular e envia os arquivos. A empresa confere, aprova ou recusa cada documento.

A arquitetura está descrita em `docs/arquitetura.md`. O que ainda falta para produção está em `docs/pendencias.md`. O passo a passo para rodar e testar está em `docs/testes.md`.

## Estrutura

```
apps/
  web       painel da empresa e site (React + Vite)                    :5173
  balcao    tela do cliente no celular (React + Vite, sem roteador)     :5174
  api       Express, monólito modular                                   :3000
  worker    jobs (pg-boss): antivírus, miniaturas, mensagens, lembretes, expiração, retenção
packages/
  db        schema Prisma, migrações (com RLS), cliente, criptografia, storage, seed
  shared    esquemas Zod, tipos, planos, regras de arquivo, estilos do design system
infra/dev   docker compose com Postgres, S3 local (moto) e ClamAV
```

Módulos da API (`apps/api/src/modulos`): `auth`, `organizacoes`, `balcoes`, `documentos`, `modelos`, `acesso-cliente`, `clientes`, `turu`, `cobranca`, `auditoria`.

## Rodar localmente

Precisa de Node 22 e pnpm 10.

```bash
pnpm install
docker compose -f infra/dev/docker-compose.yml up -d   # Postgres, S3 local (moto), ClamAV
cp .env.example .env                                    # gere CHAVE_MESTRA_LOCAL e CHAVE_HMAC com: openssl rand -base64 32
pnpm preparar                                           # migrações, fila, buckets e dados de teste
pnpm dev                                                # api, worker, web e balcao
```

- Painel: http://localhost:5173
- O link do cliente aparece na tela "Balcão criado" e abre em http://localhost:5174

O ClamAV baixa as assinaturas na primeira vez que sobe; leva alguns minutos. Enquanto isso, os arquivos ficam em quarentena e o worker tenta de novo.

`pnpm test` roda os testes de integração da API (isolamento entre escritórios, código de login, limites de plano, origem, auditoria). Eles usam o banco de desenvolvimento: rode `pnpm db:seed` antes.

## Contas de teste

Senha das três: `trames-teste-123`. Depois da senha, a Trames pede um código de 6 dígitos enviado ao e-mail de login. Em desenvolvimento o e-mail não sai: ele vai para a tabela `caixa_saida_dev`, e a tela do código tem um botão que o preenche.

| Plano | E-mail | O que testar |
| --- | --- | --- |
| Grátis | `gratis@trames.app` | Clínica Boa Vista (saúde), 2 de 3 balcões. Abra mais um e veja o limite. Turu, relatório, modelos próprios, lembretes, marca e permissões ficam bloqueados (a API responde 402). |
| Pro | `pro@trames.app` | Albuquerque & Lima (advocacia), 6 de 40 balcões, o caso do Júlio, Turu, modelos próprios, lembretes, sigla e cor no balcão do cliente, equipe de até 3 pessoas. |
| Ultra | `ultra@trames.app` | Lins & Moura (contabilidade), 46 balcões abertos (mais que o limite do Pro), relatório de prazos e pendências, 6 pessoas com permissões por pessoa. |

Lado do cliente: abra o link, peça o código e use o botão "preencher o código da caixa de saída". O WhatsApp do cliente também não sai em desenvolvimento.

Em desenvolvimento dá para trocar o plano de uma conta pela página Planos (`COBRANCA_SIMULADA=1`).

## Turu

Com `ANTHROPIC_API_KEY` no `.env`, o Turu usa o Claude (`claude-opus-5-5`, saída estruturada validada com Zod, fallback do servidor ligado). Sem a chave, usa uma montagem simples por palavras-chave. Ele recebe só o texto da conversa e a lista atual, nunca documentos ou dados do cliente.

## Segurança, em resumo

- **Multi-tenant:** `organizacao_id` em todas as tabelas de escritório e Row-Level Security no Postgres. A aplicação conecta como `trames_app`, que não é dono das tabelas, e cada transação define o escritório com `set_config` (`naOrganizacao` e `prismaDaOrganizacao` em `packages/db`). Buscas antes de saber o escritório (login, cookie, link do cliente) passam por funções `SECURITY DEFINER` que devolvem só o mínimo.
- **Arquivos:** o celular envia direto para o bucket `quarentena` por POST assinado (5 min, limite de tamanho e tipo). O worker confere o tipo real pelos bytes, passa o ClamAV e só então move para `documentos`. Download por URL assinada de 60 s, depois de conferir a permissão e registrar na auditoria.
- **Dados pessoais:** CPF e telefone com criptografia por envelope (KMS; em dev, chave local) e HMAC ao lado para busca. Logs sem dado pessoal: só método, padrão da rota, status e tempo. Respostas da API com `Cache-Control: no-store`.
- **Acesso do cliente:** token do link de 256 bits, só o hash no banco, enviado no fragmento `#` da URL (não vai para servidor, CDN nem log). Código de 6 dígitos com validade de 10 minutos, 5 tentativas e limite de pedidos. Link revogável e renovável.
- **Login da empresa:** argon2id, sessão em cookie httpOnly SameSite=Strict, segundo fator obrigatório para todos com código de 6 dígitos por e-mail (10 minutos, 5 tentativas, guardado na sessão só como HMAC), checagem de origem contra CSRF.
- **Auditoria:** `eventos_auditoria` só aceita inclusão (trigger e permissões). Registra quem viu, baixou, aprovou, recusou ou apagou cada documento, quando e de qual IP. Aba "Histórico" em cada balcão.
- **Retenção e titular:** arquivos de balcão concluído apagados depois de N dias (configurável na tela Conta). Exportação e exclusão dos dados de um cliente na tela Clientes.
- **API:** Zod em toda entrada, Helmet com CSP, rate limit geral e por rota sensível, limite de corpo de 64 KB.
