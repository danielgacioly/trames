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

O `pnpm db:seed` também serve para voltar os dados de teste ao estado inicial a qualquer momento. Ele gera também as miniaturas dos documentos de exemplo (leva alguns segundos).

Para parar: Ctrl+C no terminal do `pnpm dev`.

### Depois de baixar uma versão nova (`git pull`)

Pare o `pnpm dev` (Ctrl+C) e rode, um de cada vez:

```
pnpm install
```
```
pnpm preparar
```
```
pnpm dev
```

O `pnpm install` baixa as bibliotecas novas. O `pnpm preparar` atualiza o cliente do banco, aplica as migrações novas, cria as filas novas do worker, prepara os buckets e roda o seed.

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
3. A Trames pede um código de 6 dígitos enviado por e-mail. Em desenvolvimento nenhum e-mail sai: ele fica guardado no banco. Clique em **"Desenvolvimento: preencher o código"** e depois em **Continuar**. (Na tela de entrar, as **Contas de teste** já preenchem e-mail e senha.)

Para trocar de conta, clique em **Sair**, no pé da barra lateral, e entre com outro e-mail. Ou use uma janela anônima para ter duas contas abertas ao mesmo tempo.

## 5. Roteiro por plano

### Como o painel está organizado

- Barra lateral: **Balcões** (o número ao lado conta os que têm documento para conferir), **Clientes**, **Modelos** e, no Ultra, **Relatório**. No pé, o seu nome abre **Minha conta**.
- **Minha conta** tem três seções: **Plano e uso** (plano, uso do mês, retenção), **Escritório** (você, nome, sigla e cor) e **Equipe**.
- Avisos de uso (limite de balcões, excedente, cota de WhatsApp) aparecem só como notificação no canto da tela, uma vez por sessão, para quem administra. O botão **Ver uso** leva a Minha conta › Plano e uso.
- No balcão, as ações ficam no topo: **Enviar link**, **Concluir** e o menu **…** (Lembrar agora, Editar lista, Baixar tudo em ZIP, Arquivar). Abaixo, três abas: **Documentos**, **Detalhes** (cliente, prazo e lembretes, acesso do cliente, arquivos, arquivamento) e **Histórico**.
- Confirmações (concluir, arquivar, apagar) abrem um diálogo; o resultado aparece como notificação.

### Grátis (`gratis@trames.app`)

- [ ] Ao entrar, aparece a notificação "1 balcão disponível" (2 de 3 ativos). Minha conta › Plano e uso mostra 2 de 3.
- [ ] Abra um balcão novo: o e-mail do cliente é obrigatório (em todos os planos). O canal "WhatsApp" aparece bloqueado, com convite para o Pro.
- [ ] Com 3 de 3, tente abrir mais um: o botão **Criar balcão** fica desligado, com uma nota explicando.
- [ ] Modelos próprios, marca, permissões e relatório aparecem bloqueados.
- [ ] Em **Minha conta › Plano e uso**, a retenção é fixa: 30 dias depois de encerrar.
- [ ] O balcão concluído da Helena mostra, em **Detalhes › Arquivos**, a data em que os arquivos serão apagados.

### Pro (`pro@trames.app`)

- [ ] Ao entrar, aparece a notificação "A cota de WhatsApp está no fim". Minha conta › Plano e uso mostra 6 de 40 balcões e 298 de 300 mensagens.
- [ ] Abra o balcão do Júlio. A aba **Documentos** mostra a **miniatura** do documento; o original só sai em **Baixar original** (e fica no Histórico). Aprove ou recuse (o motivo é pedido num diálogo): a tela passa sozinha para o próximo documento a conferir.
- [ ] **Enviar link**: a Trames não guarda links (só uma impressão digital), então clique em **Gerar link para enviar**. Os links já mandados continuam valendo e o cliente continua conectado. "Abrir no WhatsApp" abre o seu WhatsApp (wa.me) com a mensagem pronta; "Enviar por e-mail" manda pela Trames; "Copiar" fica no Histórico.
- [ ] **Arquivar**: num balcão aberto, abra o menu **…** e escolha **Arquivar…**. Ele sai dos ativos, o link do cliente para de valer e **Detalhes › Arquivos** mostra quando os arquivos serão apagados. **Reabrir** desfaz.
- [ ] O balcão da Marta (prazo vencido) avisa, numa linha acima dos documentos, que o prazo venceu; **Detalhes › Arquivamento** mostra a data em que será arquivado sozinho.
- [ ] **Editar lista** (menu **…**): inclua um documento, puxe itens de um modelo, mude a ordem (arrastando ou pelas setas), marque "Pedir de novo" num item aprovado e tire um item que já tem arquivo (pede confirmação). Salve e confira o Histórico, com o antes e o depois.
- [ ] Tente tirar todos os itens: o último não sai.
- [ ] **Detalhes › Prazo e lembretes**: desligue os lembretes, troque o canal para WhatsApp, mude o prazo e clique em **Salvar** (aparece só quando algo mudou).
- [ ] **Cota de WhatsApp**: o seed deixa o Pro com 298 das 300 mensagens do mês. No menu **…**, clique em **Lembrar Júlio agora** três vezes (o balcão dele está no WhatsApp): as duas primeiras vão pelo WhatsApp, a terceira cai para e-mail e quem administra recebe o aviso "A cota de WhatsApp do mês acabou". Tudo aparece na caixa de saída (seção 6).
- [ ] **Baixar tudo (ZIP)** (menu **…** ou Detalhes): o worker monta o ZIP em segundos, a notificação "O ZIP está pronto" aparece e o menu passa a mostrar "Baixar ZIP" (vale 24 horas).
- [ ] O balcão concluído da Fernanda vai ter os arquivos apagados em poucos dias: é o caso do aviso de 7 dias (seção 6).
- [ ] Crie um modelo próprio e use-o num balcão novo.
- [ ] Na tela do cliente, a sigla e a cor do escritório aparecem.
- [ ] Minha conta › Equipe: convide pessoas até o limite de 3.

### Ultra (`ultra@trames.app`)

- [ ] Minha conta › Plano e uso mostra os balcões **novos do mês**, não os ativos. O seed deixa o Ultra com 198 de 200, e ao entrar aparece a notificação "198 de 200 balcões do mês".
- [ ] Crie 2 balcões. No 3º, com 200 de 200, **Criar balcão** pede confirmação ("Criar balcão excedente?", R$ 1,00). Ele é criado normalmente (sem bloqueio) e a notificação "Balcão criado" avisa que foi excedente. Em **Minha conta › Plano e uso**, aparece "1 excedente · R$ 1,00 na próxima fatura".
- [ ] Ao passar de 200, quem administra recebe o e-mail "Você passou dos 200 balcões do mês" (o de 180 o seed já marcou como enviado).
- [ ] Em **Minha conta › Plano e uso**, a retenção pode ser 30, 90, 180 dias ou 12 meses. Diminuir pede confirmação, porque vale também para os balcões já encerrados.
- [ ] **Relatório** de prazos e pendências; **Minha conta › Equipe** com 6 pessoas e permissões por pessoa.

### Troca de plano

Em desenvolvimento a cobrança é simulada. Na página **Planos**, escolha mensal ou anual e troque o plano de uma conta: os recursos liberam ou bloqueiam na hora. Rode `pnpm db:seed` para voltar ao original.

O Turu está fora do lançamento e não aparece. Para ligar em desenvolvimento, ponha `TURU=1` e `VITE_TURU=1` no `.env` e reinicie o `pnpm dev`.

## 6. Roteiro do cliente

1. Entre com uma conta (Pro é a mais completa) e crie um balcão.
2. Na tela **Enviar link**, que abre depois de criar, clique em **Ver como o cliente** (ou copie o link e abra numa janela anônima, no modo celular do navegador).
3. Clique em **Receber o código**: ele vai pelo canal que o escritório escolheu (e-mail, por padrão). Como nada sai em desenvolvimento, use **"preencher o código da caixa de saída"**.
4. Envie uma foto e um PDF. O arquivo aparece como **"Recebido. Estamos verificando o arquivo."** enquanto o worker confere o tipo, passa o antivírus e gera a miniatura. Depois fica **em análise**, e o cliente pode tocar em **Ver o que enviei** (a miniatura, nunca o original).
5. Feche a aba e abra o link de novo: entra direto na lista, sem código. A sessão vale 30 dias naquele aparelho e só para aquele balcão, por qualquer link dele (o do lembrete também).
6. No painel, na aba **Documentos**, aprove ou recuse cada documento. Recarregue a tela do cliente: o recusado aparece com o motivo.
7. No painel, em **Detalhes › Acesso do cliente**, clique em **Encerrar acesso em todos os aparelhos**: no celular, o código é pedido de novo. Concluir, arquivar ou **Cancelar links e gerar novo** também encerra o acesso.
8. Edite a lista (menu **…**) e inclua um documento: 10 minutos depois o worker manda ao cliente um e-mail com o que mudou (todas as mudanças desses 10 minutos vão juntas).

O ClamAV baixa as assinaturas de vírus na primeira vez que sobe e leva alguns minutos. Até lá, os arquivos ficam na verificação e o worker tenta de novo sozinho.

### Onde ver as mensagens que "sairiam"

Em desenvolvimento, e-mails e WhatsApp vão para a tabela `caixa_saida_dev`. Para ver as últimas 10 (código, lembretes, avisos ao admin):

```
pnpm caixa
```

Para ver mais, ponha o número no fim: `pnpm caixa 30`. As mensagens de WhatsApp aparecem com o nome do template.

### Rotinas do worker

Lembretes (às 10h), arquivamento e retenção (às 3h30) e limpeza (de hora em hora) rodam sozinhos no horário de Brasília. Os lembretes saem 3 dias antes do prazo, no dia e 2 dias depois, só se ainda faltar documento obrigatório; cada um leva um link novo, sem derrubar os anteriores. Balcão aberto com o prazo vencido há 3 semanas gera um aviso ao admin; 7 dias depois do aviso, é arquivado.

### Testes de segurança que dá para fazer na mão

- [ ] Abra o link do cliente sem o código: não mostra nada do balcão.
- [ ] Erre o código 5 vezes: o acesso trava e é preciso pedir um código novo.
- [ ] Conectado num balcão, abra no mesmo navegador o link de outro balcão: o código é pedido de novo.
- [ ] **Cancelar links e gerar novo** (Detalhes › Acesso do cliente): os links antigos deixam de valer e mostram "use o link da mensagem mais recente".
- [ ] Entre como Grátis e, numa janela anônima, como Pro: um escritório nunca vê balcões, clientes ou arquivos do outro.
- [ ] Erre o código de login 5 vezes: o código deixa de valer e é preciso pedir um novo.

## 7. Testes automáticos

Com o Docker no ar e o seed rodado:

```
pnpm test
```

Rodam 15 testes de integração da API: isolamento entre escritórios, código de login, limites e canais por plano, excedente do Ultra, sessão de 30 dias do cliente, links só com hash, edição da lista, arquivamento, retenção por plano (e quando ela diminui), checagem de origem e auditoria. Os testes apagam o que criam.

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

**`Queue avisar-mudanca does not exist` (ou exportar)**
Faltou criar as filas novas depois do `git pull`. Rode `pnpm fila:instalar` (ou `pnpm preparar`).

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
