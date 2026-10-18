# Trames

Protótipo navegável da Trames feito em código (React + TypeScript + Vite), a partir do protótipo do canvas "Trames · Protótipo".

Não há servidor: os dados ficam no `localStorage` do navegador. O balcão do cliente (`/b/...`) lê o mesmo estado, então dá para fazer os dois lados no mesmo navegador (abra o link do cliente em outra aba).

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173.

## Contas de teste

Senha das três: `trames123`. Na tela **Entrar** há um botão para cada uma.

| Plano | E-mail | Quem | O que testar |
| --- | --- | --- | --- |
| Grátis | `gratis@trames.app` | Carla Menezes · Clínica Boa Vista (saúde) | 2 de 3 balcões ativos: abra mais um e veja o limite. Turu, relatório, modelos próprios, lembretes e marca aparecem bloqueados. 1 pessoa na conta. |
| Pro | `pro@trames.app` | Ana Albuquerque · Albuquerque & Lima (advocacia) | 6 de 40 balcões, o caso do Júlio, Turu, modelos próprios, lembretes, sigla e cor no balcão do cliente. Equipe de até 3 pessoas (já tem 2). Relatório e permissões bloqueados. |
| Ultra | `ultra@trames.app` | Rafael Moura · Lins & Moura (contabilidade) | 46 balcões abertos (mais que o limite do Pro), relatório de prazos e pendências, 6 pessoas com permissões por pessoa. |

O código de acesso do cliente (que no produto chegaria pelo WhatsApp) é sempre `482913`. Um balcão pronto para testar: `/b/k7m2-9qd` (Júlio, da conta Pro).

**Restaurar dados de teste**, na tela Entrar, apaga o que foi feito no navegador e recria as três contas.

## O que muda em cada plano

As regras ficam em `src/dados/planos.ts` (limites e recursos) e são lidas pelas telas com `tem(sessao, 'recurso')`.

| | Grátis | Pro | Ultra |
| --- | --- | --- | --- |
| Balcões ativos | 3 | 40 | Ilimitados |
| Modelos prontos | Sim | Sim | Sim |
| Seus próprios modelos | Não | Sim | Sim |
| Turu | Não | Sim | Sim |
| Lembretes automáticos | Não | Sim | Sim |
| Sua marca no balcão | Não | Sim | Sim |
| Pessoas na conta | 1 | 3 | Ilimitadas |
| Permissões por pessoa | Não | Não | Sim |
| Relatório de prazos | Não | Não | Sim |

Na página Planos, logado, dá para mudar o plano da conta (sem cobrança) e ver as telas mudarem.

## Telas

- Site: `/` (landing), `/planos`, `/entrar`, `/criar-conta` → `/criar-conta/area`
- Escritório (`/app`): balcões, novo balcão, link do balcão, conferir documentos, modelos e editor de modelo, clientes, Turu, relatório, equipe, conta e marca
- Cliente no celular (`/b/:codigo`): acesso com código, lista, enviar documento, tudo enviado

## O que é simulado

- Login, WhatsApp, e-mail e pagamento: não há servidor. O botão "Enviar pelo WhatsApp" abre o `wa.me` com a mensagem pronta.
- Arquivos: o cliente escolhe um arquivo de verdade, mas só o nome é guardado.
- Turu: escolhe o modelo mais parecido pelas palavras do caso e aplica alguns ajustes ("deixa X como se tiver", "tira X", "acrescenta X"). Não usa IA.
- Logos: redesenhados a partir da descrição do design system (os SVGs originais não puderam ser exportados do canvas). Substitua os arquivos em `public/marca/` pelos oficiais quando tiver.

## Publicar

`npm run build` gera `dist/`. O `vercel.json` já manda todas as rotas para o `index.html`.
