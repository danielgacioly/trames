# Trames

Uma empresa (escritório de contabilidade, advocacia, consultório) abre um **balcão** para cada cliente com a lista de documentos que precisa. O cliente recebe um link, abre no celular e envia os arquivos. A empresa confere, aprova ou recusa cada documento.

A arquitetura está descrita em `docs/arquitetura.md`, com os ajustes de viabilidade comercial em `docs/viabilidade.md` (quando divergem, vale este). O que ainda falta para produção está em `docs/pendencias.md`. O passo a passo para rodar e testar está em `docs/testes.md`.

## Estrutura

```
apps/
  web       painel da empresa e site (React + Vite)                    :5173
  balcao    tela do cliente no celular (React + Vite, sem roteador)     :5174
  api       Express, monólito modular                                   :3000
  worker    jobs (pg-boss): antivírus, miniaturas, mensagens, lembretes, aviso de mudança, ZIP, expiração, retenção
packages/
  db        schema Prisma, migrações (com RLS), cliente, criptografia, storage, seed
  shared    esquemas Zod, tipos, planos, regras de arquivo, estilos do design system
infra/dev   docker compose com Postgres, S3 local (moto) e ClamAV
```

Painel (`apps/web/src`): `app/` (rotas, barra lateral, avisos de uso), `ui/` (componentes: botões, listas agrupadas, controle segmentado, menu "…", diálogos, notificações), `estilos/` (base visual no estilo das apps da Apple, valendo só dentro de `.ui`), `dados/` (API e consultas), `util/` e `funcionalidades/` (`balcoes`, `clientes`, `modelos`, `relatorio`, `conta`, `publico`, `turu`). A landing continua com o estilo próprio dela.

Módulos da API (`apps/api/src/modulos`): `auth`, `organizacoes`, `balcoes`, `documentos`, `modelos`, `acesso-cliente`, `clientes`, `cobranca`, `auditoria` e `turu` (fora do lançamento: só com `TURU=1`).

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

`pnpm test` roda os testes de integração da API (isolamento entre escritórios, código de login, limites e canais por plano, excedente do Ultra, sessão do cliente, edição da lista, retenção, origem, auditoria). Eles usam o banco de desenvolvimento: rode `pnpm db:seed` antes.

`pnpm caixa` mostra as últimas mensagens que sairiam por e-mail ou WhatsApp (em desenvolvimento nada sai de verdade).

## Planos

| | Grátis | Pro | Ultra |
| --- | --- | --- | --- |
| Preço | R$ 0 | R$ 69/mês ou R$ 690/ano | R$ 149/mês ou R$ 1.490/ano |
| Balcões | 3 ativos | 40 ativos | 200 novos por mês; excedente a R$ 1,00, sem bloqueio |
| Pessoas | 1 | até 3 | ilimitadas |
| Retenção depois de concluir | 30 dias | 90 dias | 90 dias (30, 90, 180 ou 365) |
| Código e lembretes | e-mail | e-mail ou WhatsApp (300 msgs/mês) | e-mail ou WhatsApp (1.500 msgs/mês) |

O e-mail do cliente é obrigatório em todos os planos: é o canal que sempre funciona e o destino quando a cota de WhatsApp acaba ou o envio pelo WhatsApp falha (aí a mensagem não conta na cota).
| Modelos próprios e marca | não | sim | sim |
| Permissões e relatório | não | não | sim |

As regras ficam em `packages/shared/src/planos.ts` (front e API usam o mesmo arquivo). O contador do mês (`uso_mensal`) é atualizado de forma atômica; cada excedente do Ultra vira uma linha em `itens_cobranca` com o mês de referência. Acabou a cota de WhatsApp, o envio cai para e-mail até o mês virar e quem administra recebe um aviso.

## Contas de teste

Senha das três: `trames-teste-123`. Depois da senha, a Trames pede um código de 6 dígitos enviado ao e-mail de login. Em desenvolvimento o e-mail não sai: ele vai para a tabela `caixa_saida_dev`, e a tela do código tem um botão que o preenche.

| Plano | E-mail | O que testar |
| --- | --- | --- |
| Grátis | `gratis@trames.app` | Clínica Boa Vista (saúde), 2 de 3 balcões. WhatsApp bloqueado, retenção de 30 dias. |
| Pro | `pro@trames.app` | Albuquerque & Lima (advocacia), o caso do Júlio (canal WhatsApp), miniaturas, editar lista, ZIP, link pelo wa.me. A cota de WhatsApp começa em 298 de 300. |
| Ultra | `ultra@trames.app` | Lins & Moura (contabilidade), 198 de 200 balcões novos no mês (o 3º que você criar é excedente), retenção configurável, 6 pessoas com permissões. |

O roteiro completo está em `docs/testes.md`. Em desenvolvimento dá para trocar o plano (mensal ou anual) pela página Planos (`COBRANCA_SIMULADA=1`).

## Turu

Fora do lançamento (`docs/viabilidade.md`): não aparece no painel, nos planos nem no site. O código continua em `apps/api/src/modulos/turu` e `apps/web/src/funcionalidades/turu/Turu.tsx`; para ligar em desenvolvimento, `TURU=1` e `VITE_TURU=1` no `.env`. Com `ANTHROPIC_API_KEY`, usa o Claude (saída estruturada validada com Zod); sem a chave, uma montagem simples por palavras-chave. Ele recebe só o texto da conversa e a lista atual, nunca documentos ou dados do cliente.

## Segurança, em resumo

- **Multi-tenant:** `organizacao_id` em todas as tabelas de escritório e Row-Level Security no Postgres. A aplicação conecta como `trames_app`, que não é dono das tabelas, e cada transação define o escritório com `set_config` (`naOrganizacao` e `prismaDaOrganizacao` em `packages/db`). Buscas antes de saber o escritório (login, cookie, link do cliente) passam por funções `SECURITY DEFINER` que devolvem só o mínimo.
- **Arquivos:** o celular envia direto para o bucket `quarentena` por POST assinado (5 min, limite de tamanho e tipo). O worker confere o tipo real pelos bytes, passa o ClamAV, move para `documentos` e gera a miniatura (WebP de ~1200 px; do PDF, a primeira página) no prefixo `miniaturas/`. Conferir usa a miniatura; o original só sai em "Baixar original", por URL assinada de 60 s, registrada na auditoria. O cliente vê só a miniatura do que enviou.
- **Dados pessoais:** CPF e telefone com criptografia por envelope (KMS; em dev, chave local) e HMAC ao lado para busca. Logs sem dado pessoal: só método, padrão da rota, status e tempo. Respostas da API com `Cache-Control: no-store`.
- **Acesso do cliente:** token do link de 256 bits no fragmento `#` da URL (não vai para servidor, CDN nem log); o banco guarda só o hash. Cada mensagem (lembrete, aviso, "Link do cliente") emite um link novo sem derrubar os anteriores, e "Cancelar links e gerar novo" revoga todos. Código de 6 dígitos (e-mail por padrão; WhatsApp no Pro e no Ultra) com validade de 10 minutos, 5 tentativas, limite por IP e limite por balcão contado no banco (soma todos os links e todas as instâncias da API). Depois do código, sessão de 30 dias naquele aparelho, só para aquele balcão (cookie httpOnly, Secure, SameSite=Strict; o banco guarda só o hash). Ela cai ao concluir ou arquivar o balcão, cancelar os links ou encerrar o acesso.
- **Login da empresa:** argon2id, sessão em cookie httpOnly SameSite=Strict, segundo fator obrigatório para todos com código de 6 dígitos por e-mail (10 minutos, 5 tentativas, guardado na sessão só como HMAC), checagem de origem contra CSRF.
- **Auditoria:** `eventos_auditoria` só aceita inclusão (trigger e permissões). Registra quem viu, baixou, aprovou, recusou ou apagou cada documento, quando e de qual IP. Aba "Histórico" em cada balcão.
- **Retenção e titular:** ao concluir ou arquivar, a exclusão dos arquivos fica agendada pela regra do plano. Balcão aberto esquecido é arquivado sozinho 30 dias depois do prazo, sempre com aviso ao admin uma semana antes. Se a retenção diminui (plano mais barato ou escolha menor no Ultra), os já encerrados passam a seguir o prazo novo, com no mínimo 7 dias; quem administra recebe um e-mail 7 dias antes e pode baixar o ZIP. A exclusão apaga originais e miniaturas e deixa na auditoria só qual documento, de qual balcão e quando. O ciclo de vida dos buckets é a rede de segurança. Exportação e exclusão dos dados de um cliente na tela Clientes.
- **API:** Zod em toda entrada, Helmet com CSP, rate limit geral e por rota sensível, limite de corpo de 64 KB.
