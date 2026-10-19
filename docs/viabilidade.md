# Trames — Ajustes de viabilidade comercial

Este documento complementa o `trames-arquitetura.md`. Quando os dois divergirem, vale este aqui.

Objetivo: reduzir o custo variável por balcão e dar teto de custo a todos os planos, sem piorar a experiência do escritório nem do cliente.

## 1. Planos

| | Grátis | Pro | Ultra |
|---|---|---|---|
| Preço mensal | R$ 0 | R$ 69 | R$ 149 |
| Preço anual | — | R$ 690 (2 meses grátis) | R$ 1.490 (2 meses grátis) |
| Balcões | 3 ativos | 40 ativos | 200 balcões novos por mês incluídos; excedente a R$ 1,00 por balcão |
| Pessoas da equipe | 1 | até 3 | ilimitadas |
| Retenção após concluir o balcão | 30 dias | 90 dias | 90 dias, configurável até 12 meses |
| Código de acesso do cliente | e-mail | e-mail ou WhatsApp | e-mail ou WhatsApp |
| Lembretes automáticos por e-mail | sim | sim | sim |
| Lembretes automáticos por WhatsApp | não | até 300 mensagens/mês | até 1.500 mensagens/mês |
| Modelos próprios | não | ilimitados | ilimitados |
| Logo do escritório no balcão | não | sim | sim |
| Permissões por pessoa e relatórios | não | não | sim |

Regras:
- **Balcão ativo:** balcão aberto e ainda não concluído nem arquivado.
- **Excedente do Ultra:** cada balcão novo criado além dos 200 do mês custa R$ 1,00 e é somado à próxima fatura. Não há bloqueio.
  - Contar por balcão criado no mês (pelo `criado_em`), não por balcão ativo. Balcão apagado continua contando.
  - No painel, mostrar ao admin quantos balcões foram usados no mês e quantos excedentes já foram gerados.
  - Avisar o admin por e-mail ao chegar em 180 balcões e de novo ao passar de 200.
  - Na tela de criar balcão, quando já estiver acima de 200, mostrar o aviso "Este balcão será cobrado como excedente (R$ 1,00)".
  - Guardar cada excedente como item de cobrança, com o mês de referência, para entrar na fatura seguinte.
  - No plano anual, o excedente é cobrado mês a mês, à parte.
- **Cotas de WhatsApp:** contam as mensagens enviadas pela Trames (código de acesso por WhatsApp e lembretes). Ao atingir a cota, o envio cai para e-mail até o mês virar, e o admin recebe um aviso.
- **Cobrança:** Pix e cartão. O plano anual é pago de uma vez.

## 2. Envio do link pelo WhatsApp do escritório

- O botão "Enviar pelo WhatsApp" na tela do link gerado abre `https://wa.me/<telefone do cliente>?text=<mensagem codificada>`.
- A mensagem vem pré-preenchida e pode ser editada antes, no campo de texto que já existe na tela.
- A Trames não envia essa mensagem e não usa a API do WhatsApp para isso. O envio acontece pelo WhatsApp do próprio escritório.
- O botão "Enviar por e-mail" continua enviando pela Trames (SES).
- Registrar na auditoria que o link foi copiado ou aberto para envio, com o canal usado.

## 3. Acesso do cliente

- O código de 6 dígitos vai por **e-mail** por padrão.
- Nos planos Pro e Ultra, o escritório pode escolher WhatsApp como canal do código, balcão a balcão. Esse envio conta na cota.
- Depois de validar o código, criar uma **sessão de no máximo 1 dia naquele aparelho**:
  - cookie `HttpOnly`, `Secure`, `SameSite=Strict`;
  - o banco guarda só o hash do identificador da sessão;
  - a sessão vale só para aquele balcão.
- Cada entrada pede um código novo: abrir o link derruba a sessão anterior do aparelho e o código é enviado na hora.
- A sessão cai antes se o balcão for concluído, o link for revogado ou o escritório encerrar o acesso manualmente.
- Mantêm-se as regras de segurança do código: validade curta, limite de tentativas e rate limit por IP e por balcão.

## 4. Lembretes

- Lembretes automáticos por e-mail em todos os planos. Cadência padrão: 3 dias antes do prazo, no dia do prazo e 2 dias depois. O escritório pode desligar balcão a balcão.
- No Pro e no Ultra, o escritório pode trocar o canal do lembrete para WhatsApp, respeitando a cota.
- Os lembretes por WhatsApp usam templates aprovados na categoria **utilidade**, nunca marketing. O texto deve ser só transacional (prazo e documentos pendentes), sem oferta nem promoção.
- Os lembretes rodam no worker, como jobs agendados.

## 5. Miniaturas para conferir

- Ao sair da quarentena, o worker gera uma miniatura leve de cada documento:
  - imagem: WebP de cerca de 1200 px no lado maior;
  - PDF: imagem da primeira página no mesmo formato.
- As miniaturas ficam num prefixo separado no bucket `documentos` e seguem as mesmas regras de acesso e retenção do original.
- A tela de conferir mostra a miniatura. O original só é baixado quando o usuário clica em "Baixar original", por URL assinada de curta duração, e esse download vai para a auditoria.
- O cliente final também vê a miniatura do que enviou, não o original.

## 6. Retenção

- Quando o balcão é concluído, agendar a exclusão dos arquivos (originais e miniaturas) para:
  - Grátis: 30 dias;
  - Pro: 90 dias;
  - Ultra: 90 dias por padrão, com opção de 30, 90, 180 ou 365 dias nas configurações do escritório.
- O escritório pode baixar tudo antes do prazo (exportação em ZIP).
- Avisar o admin por e-mail 7 dias antes da exclusão.
- A exclusão apaga os objetos no S3 e marca os registros como excluídos. Os metadados mínimos ficam na auditoria: qual documento, de qual balcão, quando foi apagado. Nunca o arquivo.
- Ajustar a política de ciclo de vida do bucket e a retenção dos backups do banco para que nenhum arquivo sobreviva mais de 35 dias além do prazo do plano.

## 7. Infraestrutura inicial

Começar enxuto e crescer conforme a receita:

| Componente | No lançamento | Quando crescer |
|---|---|---|
| Banco | RDS Postgres em uma zona, instância pequena, backups automáticos criptografados | Multi-AZ ao passar de 100 clientes pagantes ou quando a disponibilidade virar exigência de contrato |
| API | 1 container (ECS Fargate) | 2 ou mais containers com autoescala quando a CPU média passar de 60% |
| Worker | 1 container | Mais containers quando a fila acumular |
| Rede | Sem NAT Gateway; usar VPC endpoints para S3, KMS, SES e Secrets Manager | Revisar se surgir dependência externa que exija NAT |
| Região | `sa-east-1` (São Paulo) | — |

Meta de custo fixo no lançamento: cerca de US$ 200 por mês.

A segurança não muda: criptografia, RLS, auditoria, KMS e as demais proteções do `trames-arquitetura.md` valem desde o primeiro dia. O que fica para depois é só a redundância.

## 8. Custo de referência (teto)

Premissas:
- 10 documentos por balcão, até 10 MB cada, com 30% de reenvios.
- Original baixado 1 vez, o resto via miniatura.
- 3 lembretes por WhatsApp por balcão nos planos pagos.

| | Grátis | Pro | Ultra |
|---|---|---|---|
| Custo por balcão no teto | ≈ R$ 0,30 | ≈ R$ 0,45 | ≈ R$ 0,45 |
| Custo mensal no uso máximo, incluindo gateway e parte fixa (com 300 clientes) | ≈ R$ 1 | ≈ R$ 25 | ≈ R$ 101 |
| Margem no pior caso | — | ≈ 64% | ≈ 32% |

No Ultra, cada balcão excedente custa cerca de R$ 0,45 e é cobrado a R$ 1,00, uma margem de cerca de 55% em cada um. Com isso, o plano não tem mais cenário de prejuízo.

Usar esses números como referência para alertas de custo, não como regra de negócio.

## 9. Editar os documentos pedidos em balcões já criados

O escritório pode mudar a lista de documentos de um balcão a qualquer momento enquanto ele estiver aberto. Balcão concluído ou arquivado não pode ser editado; para mexer, é preciso reabrir.

**Criar (adicionar item)**
- Adicionar um documento novo à lista: nome, explicação para o cliente e se é obrigatório ou opcional ("se tiver").
- Pode vir de um modelo (puxar itens de outro modelo) ou ser escrito na hora.
- O item novo entra como pendente.

**Ler**
- A lista mostra cada item com seu status (pendente, em análise, aprovado, recusado) e os arquivos já enviados nele.

**Editar item**
- Mudar o nome, a explicação, ou trocar entre obrigatório e opcional.
- Se o item já tiver arquivo aprovado, a edição não muda o status.
- Se a edição mudar o que está sendo pedido (por exemplo, "conta de luz" para "conta de água"), o escritório pode marcar "pedir de novo". O item volta para pendente e os arquivos anteriores ficam no histórico do item.

**Remover item**
- Item sem arquivo enviado: remove direto.
- Item com arquivo enviado: pedir confirmação. Os arquivos saem da lista do cliente e seguem a mesma regra de retenção do balcão. Não são apagados na hora, para não perder algo enviado por engano.
- Não deixar remover o último item do balcão.

**Reordenar**
- Arrastar para mudar a ordem em que o cliente vê os itens.

**Efeitos**
- O progresso do balcão ("faltam X documentos") é recalculado a cada mudança.
- Se o balcão estava com tudo enviado e ganhou item novo obrigatório, ele volta para "esperando o cliente".
- Quando houver item novo ou pedido de novo, o cliente recebe um e-mail avisando o que mudou, agrupando as mudanças feitas em até 10 minutos num aviso só. O lembrete por WhatsApp segue as regras e a cota do plano.
- Toda mudança vai para a auditoria: quem fez, o quê, quando, e os valores antes e depois.
- Editar a lista não conta como balcão novo para limite de plano nem para excedente do Ultra.

**Na tela**
- Na tela do balcão, um botão "Editar lista" abre o mesmo editor da criação do balcão, já preenchido.
- O cliente vê a lista atualizada na próxima vez que abrir o link, sem precisar de link novo.

## 10. Fora do escopo deste ajuste

- Compressão das fotos no envio: não aprovada por enquanto. Os originais ficam como foram enviados.
