import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Router } from 'express';
import { z } from 'zod/v4';
import { MODELOS_PADRAO } from '@trames/db/modelos-padrao';
import { NOMES_AREA, TuruEntrada, type AreaId, type ItemEntrada, type TuruResposta } from '@trames/shared';
import { config } from '../../infra/config';
import { log } from '../../infra/logger';
import { limites, rota, validar } from '../../infra/http';
import { responderSemIa } from './sem-ia';

/*
 * Turu: monta listas de documentos a partir da descrição do caso.
 * Recebe SÓ o texto da conversa e a lista atual, nunca documentos nem dados
 * do cliente. O provedor de IA (Anthropic) é suboperador e precisa constar no
 * contrato de operador e na política de privacidade.
 */

const MODELO_IA = 'claude-opus-5-5';
const cliente = config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 2 }) : null;

const Saida = z.object({
  resposta: z.string().describe('Resposta curta para a pessoa do escritório, em português do Brasil.'),
  tipo: z.string().nullable().describe('Nome curto do tipo de caso (ex.: "Inventário"), ou null se não der para dizer.'),
  lista: z
    .array(
      z.object({
        nome: z.string().describe('Nome do documento, como o cliente entende.'),
        detalhe: z.string().describe('Uma frase explicando o que serve, em linguagem simples.'),
        obrigatorio: z.boolean().describe('false quando o documento só vale "se tiver".'),
      }),
    )
    .describe('A lista completa e atualizada de documentos.'),
});

function sistema(area: AreaId) {
  const modelos = MODELOS_PADRAO.filter((m) => m.area === area)
    .map((m) => `- ${m.nome}: ${m.itens.map((i) => i.nome + (i.obrigatorio ? '' : ' (se tiver)')).join('; ')}`)
    .join('\n');
  return `Você é o Turu, assistente da Trames. A Trames é usada por escritórios de contabilidade, advocacia e consultórios para pedir documentos aos clientes, que enviam tudo pelo celular.

Seu trabalho: a partir do caso que a pessoa do escritório conta, montar a lista de documentos que ela deve pedir ao cliente, e ajustar a lista quando ela pedir.

Como escrever a lista:
- Cada documento tem um nome que o cliente reconhece e um detalhe de uma frase, simples, dizendo o que serve (por exemplo "Conta de luz, água ou internet dos últimos 90 dias.").
- Marque obrigatorio = false para o que só vale "se tiver".
- Devolva sempre a lista inteira atualizada, não só o que mudou.
- Prefira listas enxutas: só o que o caso realmente pede.

A resposta é curta (até 3 frases) e diz o que você fez ou pergunta o que falta saber. A pessoa do escritório sempre revisa a lista antes de mandar.

Proteção de dados: você não precisa de dados pessoais. Se a mensagem trouxer nome, CPF, telefone ou outros dados de alguém, não os repita na resposta nem na lista, e lembre em uma frase que não é preciso informá-los.

O escritório é da área de ${NOMES_AREA[area]}. Modelos padrão da Trames nessa área, para referência:
${modelos}`;
}

async function responderComIa(area: AreaId, mensagens: { de: 'eu' | 'turu'; texto: string }[], lista: ItemEntrada[] | null): Promise<TuruResposta | null> {
  if (!cliente) return null;
  // A conversa precisa começar por uma mensagem da pessoa; a saudação do Turu fica de fora.
  const inicio = mensagens.findIndex((m) => m.de === 'eu');
  const historico: Anthropic.Beta.BetaMessageParam[] = mensagens.slice(inicio).map((m) => ({ role: m.de === 'eu' ? 'user' : 'assistant', content: m.texto }));
  const ultima = historico[historico.length - 1];
  if (ultima?.role !== 'user') return null;
  ultima.content = `${lista ? `Lista atual:\n${JSON.stringify(lista)}\n\n` : ''}${ultima.content as string}`;

  try {
    const r = await cliente.beta.messages.parse({
      model: MODELO_IA,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(Saida) },
      system: sistema(area),
      messages: historico,
    });
    if (r.stop_reason === 'refusal' || !r.parsed_output) {
      log.warn({ stop: r.stop_reason }, 'turu sem resposta estruturada');
      return null;
    }
    return r.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) log.warn('turu: limite da API');
    else if (e instanceof Anthropic.APIError) log.error({ status: e.status }, 'turu: erro da API');
    else log.error({ erro: (e as Error).name }, 'turu: falha');
    return null;
  }
}

export const rotasTuru = Router();

rotasTuru.post(
  '/',
  limites.turu,
  rota(async (req, res) => {
    const d = validar(TuruEntrada, req.body);
    const area = req.empresa!.organizacao.area;
    const ia = await responderComIa(area, d.mensagens, d.lista);
    if (ia) return res.json({ ...ia, origem: 'ia' });
    const ultima = [...d.mensagens].reverse().find((m) => m.de === 'eu')?.texto ?? '';
    const modelos = [...MODELOS_PADRAO.filter((m) => m.area === area), ...MODELOS_PADRAO.filter((m) => m.area !== area)];
    const r = responderSemIa(ultima, d.lista, modelos);
    res.json({ resposta: r.resposta, lista: r.lista, tipo: r.tipo ?? null, origem: 'simples' } satisfies TuruResposta & { origem: string });
  }),
);
