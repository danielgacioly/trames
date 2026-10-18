# Instruções de teste

Como rodar a Trames no seu computador e o que testar com cada conta.

Os comandos estão em blocos separados, sem comentários. Cole **um bloco de cada vez**. O zsh do Mac não aceita comentários com `#` colados no fim da linha e quebra o comando.

## 1. Primeira vez

Precisa de Node 22, pnpm 10 e Docker Desktop aberto.

Na pasta do repositório:

```
git checkout prototipo-codigo
```
```
git pull
```
```
pnpm install
```

Suba o Postgres, o S3 local e o antivírus:

```
docker compose -f infra/dev/docker-compose.yml up -d
```

Crie o `.env` e gere as duas chaves:

```
cp .env.example .env
```
```
sed -i '' "s#^CHAVE_MESTRA_LOCAL=.*#CHAVE_MESTRA_LOCAL=$(openssl rand -base64 32)#" .env
```
```
sed -i '' "s#^CHAVE_HMAC=.*#CHAVE_HMAC=$(openssl rand -base64 32)#" .env
```
```
grep CHAVE .env
```

As duas linhas devem mostrar uma chave de 44 caracteres terminando em `=`. No Linux, troque `sed -i ''` por `sed -i`.

Prepare o banco (migrações, fila, buckets e dados de teste):

```
pnpm preparar
```

A última linha deve ser `Seed pronto: 3 escritórios, ...`.

Suba tudo:

```
pnpm dev
```

Está pronto quando aparecerem `worker no ar`, `API no ar` e os dois `VITE ... ready`. Deixe esse terminal aberto.

## 2. Nas próximas vezes

```
docker compose -f infra/dev/docker-compose.yml up -d
```
```
pnpm dev
```

Se o Docker tiver sido reiniciado (ou o computador), o S3 local volta vazio. Antes do `pnpm dev`, rode:

```
pnpm storage
```
```
pnpm db:seed
```

O `pnpm db:seed` também serve para voltar os dados de teste ao estado inicial a qualquer momento.

Para parar: Ctrl+C no terminal do `pnpm dev`.

## 3. Endereços

| O quê | Endereço |
| --- | --- |
| Site e painel da empresa | http://localhost:5173 |
| Tela do cliente (celular) | http://localhost:5174 (abre pelo link do balcão) |
| API | http://localhost:3000 |

Para ver a tela do cliente como no celular: no Chrome, F12 e depois o ícone de celular (Ctrl+Shift+M ou Cmd+Shift+M).

## 4. Contas de teste

Senha das três: `trames-teste-123`

| Plano | E-mail | Escritório |
| --- | --- | --- |
| Grátis | `gratis@trames.app` | Clínica Boa Vista (saúde) |
| Pro | `pro@trames.app` | Albuquerque & Lima (advocacia) |
| Ultra | `ultra@trames.app` | Lins & Moura (contabilidade) |

### Como entrar

1. Abra http://localhost:5173 e clique em **Entrar**.
2. Digite o e-mail e a senha.
3. A Trames pede um código de 6 dígitos enviado por e-mail. Em desenvolvimento nenhum e-mail sai: ele fica guardado no banco. Clique em **"Desenvolvimento: preencher o código da caixa de saída"** e depois em **Entrar**.

Para trocar de conta, saia pelo menu e entre com outro e-mail. Ou use uma janela anônima para ter duas contas abertas ao mesmo tempo.

## 5. Roteiro por plano

### Grátis (`gratis@trames.app`)

- [ ] O painel mostra 2 de 3 balcões usados.
- [ ] Abra um balcão novo: deve funcionar (3 de 3).
- [ ] Tente abrir mais um: a Trames deve avisar que o limite do plano acabou.
- [ ] Turu, relatório, modelos próprios, lembretes, marca e permissões aparecem bloqueados, com convite para mudar de plano.

### Pro (`pro@trames.app`)

- [ ] O painel mostra 6 de 40 balcões.
- [ ] Abra o balcão do Júlio e veja os documentos em cada estado (pendente, em análise, aprovado, recusado).
- [ ] Crie um balcão usando o Turu: descreva o caso em texto e veja a lista de documentos sugerida. Sem `ANTHROPIC_API_KEY` no `.env`, o Turu usa palavras-chave; com a chave, usa o Claude.
- [ ] Crie um modelo próprio de lista de documentos e use-o num balcão novo.
- [ ] Envie um lembrete para um cliente.
- [ ] Na tela do cliente, a sigla e a cor do escritório aparecem.
- [ ] Equipe: convide pessoas até o limite de 3.

### Ultra (`ultra@trames.app`)

- [ ] O painel mostra 46 balcões abertos (mais que o limite do Pro).
- [ ] Relatório de prazos e pendências.
- [ ] Equipe com 6 pessoas e permissões diferentes por pessoa.

### Troca de plano

Em desenvolvimento a cobrança é simulada. Na página **Planos**, troque o plano de uma conta e veja os recursos liberarem ou bloquearem na hora. Rode `pnpm db:seed` para voltar ao original.

## 6. Roteiro do cliente

1. Entre com uma conta (Pro é a mais completa) e crie um balcão.
2. Na tela **"Balcão criado"**, copie o link e abra numa janela anônima (de preferência no modo celular do navegador).
3. Peça o código de acesso. Como o WhatsApp e o e-mail não saem em desenvolvimento, use **"preencher o código da caixa de saída"**.
4. Envie arquivos para os documentos pedidos (foto, PDF).
5. O arquivo aparece como **"Recebido. Estamos verificando o arquivo."** enquanto o worker confere o tipo e passa o antivírus. Depois fica **em análise** para o escritório.
6. Volte ao painel da empresa, abra o balcão e aprove ou recuse cada documento. Na recusa, escreva o motivo.
7. Recarregue a tela do cliente: o documento recusado aparece com o motivo, pronto para reenvio.
8. Veja a aba **Histórico** do balcão: cada visualização, download, aprovação e recusa está registrada.

O ClamAV baixa as assinaturas de vírus na primeira vez que sobe e leva alguns minutos. Até lá, os arquivos ficam na verificação e o worker tenta de novo sozinho.

### Testes de segurança que dá para fazer na mão

- [ ] Abra o link do cliente sem o código: não deve mostrar nada do balcão.
- [ ] Erre o código 5 vezes: o acesso trava e é preciso pedir um código novo.
- [ ] Envie um lembrete: o link antigo deixa de valer e mostra "use o link da mensagem mais recente".
- [ ] Entre como Grátis e, numa janela anônima, como Pro: um escritório nunca vê balcões, clientes ou arquivos do outro.
- [ ] Erre o código de login 5 vezes: o código deixa de valer e é preciso pedir um novo.

## 7. Testes automáticos

Com o Docker no ar e o seed rodado:

```
pnpm test
```

Rodam 8 testes de integração da API: isolamento entre escritórios, código de login, limites de plano, checagem de origem e auditoria.

```
pnpm typecheck
```

Confere os tipos de todos os pacotes.

## 8. Problemas comuns

**`Port 5173 is already in use` (ou 5174, 3000)**
Ficou um `pnpm dev` antigo rodando. Feche:
```
lsof -ti :5173 -ti :5174 -ti :3000 | xargs kill
```

**`CHAVE_MESTRA_LOCAL precisa ter 32 bytes em base64`**
As chaves do `.env` ainda são as de exemplo. Rode os dois comandos `sed` da seção 1 e depois `pnpm db:seed`.

**`The environment variable DATABASE_URL resolved to an empty string` ou `Não achei o arquivo .env`**
Falta o `.env`. Rode `cp .env.example .env` e gere as chaves (seção 1).

**`role "trames_app" is not permitted to log in`**
Acontece quando o Mac já tem um Postgres instalado (Homebrew ou Postgres.app) na porta 5432: as migrações rodam nele, e não no do Docker. Libere o login:
```
echo "ALTER ROLE trames_app LOGIN PASSWORD 'trames_app';" | pnpm --filter @trames/db exec node scripts/com-dono.mjs prisma db execute --stdin --schema prisma/schema.prisma
```
Para conferir quem está na porta:
```
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

**`pull access denied for minio/minio`**
Versão antiga do `docker-compose.yml`. Rode `git pull`.

**Arquivo do cliente parado em "Estamos verificando o arquivo"**
Confira se o ClamAV está rodando e terminou de baixar as assinaturas:
```
docker compose -f infra/dev/docker-compose.yml ps
```
```
docker compose -f infra/dev/docker-compose.yml logs clamav
```

**Download de arquivo falha depois de reiniciar o Docker**
O S3 local perdeu os arquivos. Rode `pnpm storage` e `pnpm db:seed`.
