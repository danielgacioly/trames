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
3. A Trames pede um código de 6 dígitos enviado por e-mail. Em desenvolvimento nenhum e-mail sai: ele fica guardado no banco. Clique em **"Desenvolvimento: preencher o código da caixa de saída"** e depois em **Entrar**.

Para trocar de conta, saia pelo menu e entre com outro e-mail. Ou use uma janela anônima para ter duas contas abertas ao mesmo tempo.

## 5. Roteiro por plano

Avisos de uso (limite de balcões, excedente, cota de WhatsApp) aparecem só no canto da tela, uma vez por sessão, para quem administra. Os avisos não mostram valores. O uso do mês fica sempre em **Configurações › Plano e uso**.

### Início e pastas (qualquer conta)

- [ ] A tela **Início** tem três ações rápidas: **Novo balcão**, **Novo modelo** (bloqueado no Grátis) e **Todos os balcões**.
- [ ] Logo abaixo, **Pedem a sua atenção** mostra até 3 balcões com documento para conferir ou prazo vencido, com o link **Ver todos os balcões**.
- [ ] A tela **Balcões** (no menu) mostra todos os balcões numa grade de cartões, com filtros (Abertos, Para conferir, Com o cliente, Concluídos e arquivados), busca e o botão **Novo balcão**.
- [ ] Os balcões ficam em pastas, cada uma com quantos estão abertos e, no círculo azul, quantos têm documento para conferir:
  - **Situação**: Para conferir, Com o cliente, Prazo vencido, Tudo aprovado, Todos os abertos, Encerrados.
  - **Minhas pastas**: as que o escritório cria. O seed traz "Prioridade" e "Esperando cartório" no Pro, e três no Ultra.
  - **Por tipo de caso**: uma pasta por tipo.
  - **Por pessoa**: quem abriu o balcão; só aparece quando a conta tem mais de uma pessoa (Pro e Ultra no seed).
- [ ] Abra uma pasta: os balcões aparecem numa lista enxuta (nome, protocolo, progresso, uma situação e o prazo). Nas pastas que não são de situação, **Abertos** e **Encerrados** ficam separados.
- [ ] A busca do Início procura em todos os balcões (cliente, protocolo ou tipo).
- [ ] **Nova pasta**: dê nome e cor. Ela abre vazia, com **Novo balcão nesta pasta**. O balcão criado por ali já entra nela.
- [ ] Na tela do balcão, ao lado do nome, troque a pasta (ou tire o balcão dela). Fica no Histórico.
- [ ] Dentro da pasta, **Renomear** e **Apagar pasta**. Apagar não apaga os balcões, só tira da pasta. Nome repetido não é aceito.
- [ ] **Novo balcão** é uma folha só: no topo, a frase "Documentos de [tipo] para [cliente], até [data]"; abaixo, as etapas 1 (contato), 2 (documentos) e 3 (acesso e lembretes), que ficam verdes quando prontas. Na lista, escreva um documento e tecle Enter para acrescentar; o número arrasta para mudar a ordem. À direita, a prévia do celular e o que ainda falta.
- [ ] Depois de criar um balcão, a tela mostra, à esquerda, o envio do link e, à direita, o resumo (com as datas dos lembretes) e os documentos pedidos.

### Configurações (qualquer conta)

- [ ] **Configurações › Meu perfil**: mude o nome e o cargo e salve. O nome muda no rodapé do menu.
- [ ] **Senha e acesso**: troque a senha (pede a atual). Os outros aparelhos saem e chega um e-mail avisando (`pnpm caixa`). A lista mostra os aparelhos conectados, com **Desconectar**.
- [ ] **Aparência**: Claro, Escuro ou Automático. Vale para o painel neste navegador; o site e a página do cliente continuam claros.
- [ ] **Escritório e marca** e **Plano e uso** (antes, Minha conta). Em Plano e uso, troque o plano direto ali (em desenvolvimento, sem cobrança).
- [ ] Na tela de entrar, **Esqueci a senha**: em desenvolvimento aparece o botão que abre o link do e-mail. A senha nova pede o código do e-mail, como um login.
- [ ] Apagar cliente, pasta, arquivo ou pessoa da equipe abre uma confirmação do próprio app, não a do navegador.

### Site

- [ ] Rodapé com **Central de ajuda**, **Contato**, **Termos de uso** e **Privacidade**, todos com página.

### Grátis (`gratis@trames.app`)

- [ ] Ao entrar, um aviso no canto da tela mostra que resta 1 balcão. **Plano e uso** mostra 2 de 3 balcões ativos.
- [ ] Abra um balcão novo: o e-mail do cliente é obrigatório (em todos os planos). O canal "WhatsApp" aparece bloqueado, com convite para o Pro.
- [ ] Com 3 de 3, tente abrir mais um: o botão de criar fica desligado e um aviso no canto explica que o limite acabou.
- [ ] Modelos próprios, marca, permissões e relatório aparecem bloqueados.
- [ ] Em **Escritório e marca**, a retenção é fixa: 30 dias depois de concluir.
- [ ] O balcão concluído da Helena mostra a data em que os arquivos serão apagados.

### Pro (`pro@trames.app`)

- [ ] Ao entrar, aparece o aviso "A cota de WhatsApp está no fim". **Plano e uso** mostra 6 de 40 balcões e 298 de 300 mensagens.
- [ ] Abra o balcão do Júlio. A tela de conferir mostra a **miniatura** do documento; o original só sai em **Baixar original** (e fica no Histórico).
- [ ] **Link do cliente**: a Trames não guarda links (só uma impressão digital), então clique em **Gerar link para enviar**. Os links já mandados continuam valendo e o cliente continua conectado. "Enviar pelo WhatsApp" abre o seu WhatsApp (wa.me) com a mensagem pronta; "Enviar por e-mail" manda pela Trames; "Copiar link" fica no Histórico.
- [ ] **Arquivar**: num balcão aberto, clique em **Arquivar**. Ele sai dos ativos, o link do cliente para de valer e a tela mostra quando os arquivos serão apagados. **Reabrir balcão** desfaz.
- [ ] O balcão da Marta (prazo vencido) mostra quando será arquivado sozinho, se ninguém mexer.
- [ ] **Editar lista**: inclua um documento, puxe itens de um modelo, mude a ordem (arrastando ou pelas setas), marque "Pedir de novo" num item aprovado e tire um item que já tem arquivo (pede confirmação). Salve e confira o Histórico, com o antes e o depois.
- [ ] Tente tirar todos os itens: o último não sai.
- [ ] **Prazo e lembretes**: desligue os lembretes do balcão, troque o canal para WhatsApp, mude o prazo.
- [ ] **Cota de WhatsApp**: o seed deixa o Pro com 298 das 300 mensagens do mês. Clique em **Lembrar Júlio** três vezes (o balcão dele está no WhatsApp): as duas primeiras vão pelo WhatsApp, a terceira cai para e-mail e quem administra recebe o aviso "A cota de WhatsApp do mês acabou". Tudo aparece na caixa de saída (seção 6).
- [ ] **Baixar tudo (ZIP)**: o worker monta o ZIP em segundos; depois aparece "Baixar ZIP" (vale 24 horas).
- [ ] O balcão concluído da Fernanda vai ter os arquivos apagados em poucos dias: é o caso do aviso de 7 dias (seção 6).
- [ ] Crie um modelo próprio e use-o num balcão novo.
- [ ] Na tela do cliente, a sigla e a cor do escritório aparecem.
- [ ] Equipe: convide pessoas até o limite de 3.

### Ultra (`ultra@trames.app`)

- [ ] **Plano e uso** mostra os balcões **novos do mês**, não os ativos. O seed deixa o Ultra com 198 de 200, e ao entrar aparece o aviso "198 de 200 balcões do mês".
- [ ] Crie 2 balcões: com 200 de 200, ao abrir a tela de criar, aparece o aviso "Você já usou os balcões do mês", sem valores. O 3º é criado normalmente (sem bloqueio) e outro aviso diz "Balcão adicional criado". Em **Plano e uso**, aparece "1 balcão adicional neste mês: R$ 1,00 na próxima fatura".
- [ ] Ao passar de 200, quem administra recebe o e-mail "Você passou dos 200 balcões do mês" (o de 180 o seed já marcou como enviado).
- [ ] Em **Escritório e marca**, a retenção pode ser 30, 90, 180 dias ou 12 meses.
- [ ] Relatório de prazos e pendências; equipe com 6 pessoas e permissões por pessoa.

### Troca de plano

Em desenvolvimento a cobrança é simulada. Em **Configurações › Plano e uso**, troque o plano da conta: os recursos liberam ou bloqueiam na hora. Rode `pnpm db:seed` para voltar ao original.

## 6. Roteiro do cliente

1. Entre com uma conta (Pro é a mais completa) e crie um balcão.
2. Na tela **"Balcão criado"**, clique em **Ver como o cliente**, no topo à direita, (ou copie o link e abra numa janela anônima, no modo celular do navegador).
3. Clique em **Receber o código**: ele vai pelo canal que o escritório escolheu (e-mail, por padrão). Como nada sai em desenvolvimento, use **"preencher o código da caixa de saída"**.
4. Envie uma foto e um PDF. O arquivo aparece como **"Recebido. Estamos verificando o arquivo."** enquanto o worker confere o tipo, passa o antivírus e gera a miniatura. Depois fica **em análise**, e o cliente pode tocar em **Ver o que enviei** (a miniatura, nunca o original).
5. Feche a aba e abra o link de novo: entra direto na lista, sem código. A sessão vale 30 dias naquele aparelho e só para aquele balcão, por qualquer link dele (o do lembrete também).
6. No painel, abra o balcão (Início › Para conferir) e aprove ou recuse cada documento. Recarregue a tela do cliente: o recusado aparece com o motivo.
7. No painel, clique em **Encerrar acesso**: no celular, o código é pedido de novo. Concluir, arquivar ou **Cancelar links e gerar novo** também encerra o acesso.
8. Edite a lista e inclua um documento: 10 minutos depois o worker manda ao cliente um e-mail com o que mudou (todas as mudanças desses 10 minutos vão juntas).

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
- [ ] **Cancelar links e gerar novo**: os links antigos deixam de valer e mostram "use o link da mensagem mais recente".
- [ ] Entre como Grátis e, numa janela anônima, como Pro: um escritório nunca vê balcões, clientes ou arquivos do outro.
- [ ] Erre o código de login 5 vezes: o código deixa de valer e é preciso pedir um novo.

## 7. Testes automáticos

Com o Docker no ar e o seed rodado:

```
pnpm test
```

Rodam 16 testes de integração da API, um arquivo de cada vez (eles entram nas mesmas contas de teste e leem o código de login na fila; em paralelo, um pegava o código do outro): isolamento entre escritórios, código de login, limites e canais por plano, excedente do Ultra, sessão de 30 dias do cliente, links só com hash, edição da lista, arquivamento, retenção por plano (e quando ela diminui), checagem de origem e auditoria. Os testes apagam o que criam.

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
