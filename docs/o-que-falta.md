# O que falta para a Trames parecer um produto comercial

Levantamento de 19 de outubro de 2026. Comparei a Trames com produtos que fazem a mesma coisa (pedir e receber documentos de clientes) e com o que todo SaaS costuma ter. Ficaram de fora as pendências técnicas e de lançamento que já estão em `pendencias.md`.

## Com quem comparei

| Produto | Para quem | O que se destaca |
|---|---|---|
| **Content Snare** | Contabilidade, advocacia, financeiro | Lista de pedidos com **perguntas além de arquivos**, lembretes automáticos, aprovar/recusar item, **conversa por item**, modelos, integrações (Xero, Drive, Dropbox, Zapier), assinatura de documentos, ISO 27001. Site com páginas por área, modelos públicos, central de ajuda, roadmap e novidades. A partir de US$ 29/mês, com teste grátis de 14 dias. |
| **FileInvite** | Crédito e serviços financeiros | Portal com a marca do escritório, prazos e lembretes, conversão automática para PDF, nomes de arquivo padronizados, SOC 2 e LGPD/GDPR em destaque. |
| **Suralink** | Auditoria e impostos | Listas com responsável e prazo por item, filtros por situação, chat integrado, integração com Excel. |
| **TaxDome** | Escritórios contábeis (completo) | Portal do cliente com app, mensagens, assinatura, cobrança e tarefas. Bem mais amplo que a Trames. |
| **LedContábil** (Brasil) | Contabilidade | Portal com pedidos, documentos, prazos e obrigações. Mostra que no Brasil o pedido **recorrente** (todo mês) é o caso principal da contabilidade. |

## O que entrou agora

- **Configurações** separadas em *Você* (Meu perfil com nome e cargo, Senha e acesso com aparelhos conectados, Aparência com tema claro, escuro ou automático) e *Escritório* (Escritório e marca, Plano e uso com troca de plano dentro do app).
- **Esqueci a senha**: link por e-mail que vale 1 hora e desconecta os outros aparelhos.
- **Termos de uso, Política de privacidade, Contato e Central de ajuda**, com cabeçalho e rodapé comuns no site. Os links do rodapé e do cadastro, que não levavam a lugar nenhum, agora funcionam.
- **Confirmações dentro do app** no lugar das caixas cinzas do navegador.
- **Telas de criação novas** (balcão e modelo): uma folha só, com uma frase no topo e uma trilha numerada que marca cada etapa pronta. A lista de documentos parece uma lista escrita, com Enter para acrescentar. Ao lado, a prévia do celular (sempre clara, como o cliente vê) e o que ainda falta.
- **Pop-ups sem valores em reais**: o valor fica só em Plano e uso.

## O que ainda falta

### No site público

1. **Página de segurança** (`/seguranca`): onde ficam os dados, criptografia, antivírus, código de acesso, LGPD, quem são os suboperadores. Os concorrentes põem selos (ISO 27001, SOC 2) em destaque; a Trames pode começar mostrando o que já faz.
2. **Uma página por área** (contabilidade, advocacia, saúde), com os modelos e um caso de uso de cada. É onde a busca do Google leva.
3. **Galeria pública de modelos**: os modelos prontos, abertos a quem ainda não tem conta. Content Snare usa isso para atrair clientes.
4. **Prova social**: depoimentos, logos de escritórios, números de uso. Hoje não há nenhum.
5. **Demonstração**: um vídeo curto ou um botão "agendar uma conversa" para escritórios maiores.
6. **Novidades** (changelog) e **página de status**.
7. **Metadados de compartilhamento**: título e descrição por página e imagem para quando o link é colado no WhatsApp.

### No produto

1. **Pedidos recorrentes**: repetir um balcão todo mês (fechamento do mês, folha). Para contabilidade é o caso mais comum.
2. **Perguntas, não só arquivos**: pedir uma informação em texto ("Qual o endereço novo?", "Quantos dependentes?").
3. **Conversa por item**: o cliente perguntar "serve a CNH digital?" dentro do balcão, sem voltar para o WhatsApp.
4. **Avisos dentro do painel**: um sino com "documento chegou", "cliente abriu o link", "prazo vence amanhã".
5. **Primeiros passos**: uma lista na primeira semana (criar o primeiro balcão, mandar o link, pôr a marca, convidar a equipe).
6. **Cobrança de verdade**: forma de pagamento, faturas e notas fiscais, cancelar a assinatura. Os termos já prometem que, ao cancelar, a conta volta ao Grátis no fim do período pago.
7. **Período de teste** dos planos pagos (o padrão do mercado é 14 dias).
8. **Logo de verdade**: hoje o escritório escolhe sigla e cor. Falta enviar a imagem do logo.
9. **Escolher quais e-mails receber** (preferências de notificação).
10. **Trocar o e-mail de acesso**, confirmando no e-mail novo.
11. **Encerrar a conta** e **exportar tudo** do escritório.
12. **Integrações**: mandar os arquivos aprovados para Google Drive, Dropbox ou OneDrive; webhooks ou Zapier; depois, os sistemas contábeis mais usados no Brasil.
13. **Lembretes configuráveis**: escolher os dias e o texto.
14. **Busca rápida** (⌘K) por cliente, protocolo ou modelo, de qualquer tela.
15. **Assinatura de documentos**: alguns concorrentes têm. Faz sentido mais adiante.

### Prioridade sugerida

- **Antes de vender**: página de segurança, cobrança de verdade, período de teste, primeiros passos, metadados de compartilhamento.
- **Logo depois**: pedidos recorrentes, perguntas em texto, avisos no painel, logo do escritório.
- **Para crescer**: páginas por área, galeria de modelos, prova social, integrações, conversa por item.

## Fontes

- [Content Snare: recursos](https://contentsnare.com/features/) e [Capterra](https://www.capterra.com/p/167019/Content-Snare/)
- [FileInvite na Software Advice](https://www.softwareadvice.com/file-sharing/fileinvite-profile/) e [comparativo com DocuSign](https://www.fileinvite.com/compare/docusign-vs-fileinvite)
- [Suralink](https://www.suralink.com/home-dev) e [GetApp](https://www.getapp.com/collaboration-software/a/suralink/features/)
- [TaxDome: portal do cliente](https://taxdome.com/pt-pt/client-portal)
- [Ledware: portal digital para clientes](https://www.ledware.com.br/2026/02/12/como-reduzir-80-das-solicitacoes-manuais-com-um-portal-digital-para-clientes/)
- [Padrões de telas de configurações em SaaS](https://www.eleken.co/blog-posts/settings-page-ui)
