import type { ItemEntrada as ItemModelo } from '@trames/shared';
import type { ModeloPadrao } from '@trames/db/modelos-padrao';

/*
 * Turu sem IA: escolhe o modelo mais parecido pelas palavras do caso e aplica
 * alguns ajustes comuns. Usado quando não há ANTHROPIC_API_KEY ou a API falha.
 */
const PALAVRAS: Record<string, string[]> = {
  'adv-inventario': ['inventário', 'inventario', 'faleceu', 'falecid', 'herdeir', 'herança', 'viúv', 'óbito'],
  'adv-aposentadoria': ['aposentad', 'inss', 'benefício', 'previdenci'],
  'adv-divorcio': ['divórcio', 'divorcio', 'separação', 'casal'],
  'adv-trabalhista': ['trabalhista', 'demitid', 'rescisão', 'patrão', 'horas extras'],
  'adv-imovel': ['compra', 'venda', 'escritura'],
  'adv-pensao': ['pensão', 'alimentos'],
  'cont-irpf': ['imposto de renda', 'irpf', 'declaração', 'restituição'],
  'cont-abertura': ['abrir empresa', 'abertura', 'cnpj', 'mei'],
  'cont-mensal': ['mensal', 'fechamento', 'simples nacional'],
  'cont-admissao': ['admissão', 'contratar', 'funcionário novo', 'registrar funcionário'],
  'sau-preop': ['cirurgia', 'operação', 'pré-operatório'],
  'sau-consulta': ['consulta', 'primeira vez'],
  'sau-reembolso': ['reembolso'],
};

const EXTRAS: { palavras: string[]; item: ItemModelo; jaCoberto?: string }[] = [
  { palavras: ['portugal', 'exterior', 'fora do brasil', 'estados unidos', 'mora fora'], item: { nome: 'Procuração com apostila de Haia', detalhe: 'Só para quem mora fora do Brasil. Feita no consulado ou em cartório local, com apostila.', obrigatorio: true } },
  { palavras: ['carro', 'moto', 'veículo'], item: { nome: 'Documento do carro (CRLV)', detalhe: 'O documento mais recente, em PDF ou foto.', obrigatorio: true } },
  { palavras: ['apartamento', 'casa', 'imóvel', 'terreno'], jaCoberto: 'matrícula', item: { nome: 'Matrícula atualizada do imóvel', detalhe: 'Pedida no cartório de registro de imóveis, emitida há menos de 30 dias.', obrigatorio: true } },
  { palavras: ['filhos', 'filho', 'filha'], jaCoberto: 'herdeir', item: { nome: 'RG e CPF de cada filho', detalhe: 'Um documento com foto de cada um.', obrigatorio: true } },
  { palavras: ['empresa', 'sócio'], item: { nome: 'Contrato social', detalhe: 'A última alteração registrada na junta comercial.', obrigatorio: true } },
];

const BASICOS: ItemModelo[] = [
  { nome: 'RG ou CNH', detalhe: 'Frente e verso, ou a CNH digital em PDF.', obrigatorio: true },
  { nome: 'CPF', detalhe: 'Pode ser o cartão ou um print do app da Receita.', obrigatorio: true },
  { nome: 'Comprovante de residência', detalhe: 'Conta de luz, água ou internet dos últimos 90 dias.', obrigatorio: true },
];


function normal(s: string) {
  return s.toLowerCase();
}

function escolherModelo(texto: string, modelos: ModeloPadrao[]) {
  const t = normal(texto);
  let melhor: ModeloPadrao | undefined;
  let pontos = 0;
  for (const m of modelos) {
    const p = (PALAVRAS[m.id] ?? []).filter((w) => t.includes(w)).length;
    if (p > pontos) {
      melhor = m;
      pontos = p;
    }
  }
  return melhor;
}

/** Acha itens da lista citados na mensagem ("a certidão de casamento" → "Certidão de casamento"). */
function itensCitados(texto: string, lista: ItemModelo[]) {
  const t = normal(texto);
  return lista.filter((it) => {
    const palavras = normal(it.nome).split(/\s+/).filter((w) => w.length > 3);
    return palavras.length > 0 && palavras.filter((w) => t.includes(w)).length >= Math.min(2, palavras.length);
  });
}

export function responderSemIa(texto: string, lista: ItemModelo[] | null, modelos: ModeloPadrao[]): { resposta: string; lista: ItemModelo[]; tipo?: string } {
  const t = normal(texto);
  if (!lista) {
    const m = escolherModelo(texto, modelos);
    let itens = [...(m?.itens ?? BASICOS)];
    const acrescentados: string[] = [];
    for (const e of EXTRAS) {
      const jaTem = itens.some((it) => normal(it.nome) === normal(e.item.nome) || (e.jaCoberto && normal(it.nome).includes(e.jaCoberto)));
      if (e.palavras.some((w) => t.includes(w)) && !jaTem) {
        itens = [...itens, e.item];
        acrescentados.push(e.item.nome);
      }
    }
    const base = m ? `Montei uma lista com ${itens.length} documentos a partir do modelo de ${m.nome.toLowerCase()}.` : `Não reconheci um modelo parecido, então comecei por ${itens.length} documentos básicos.`;
    const extra = acrescentados.length ? ` Pelo que você contou, incluí também: ${acrescentados.join(', ')}.` : '';
    return {
      resposta: `${base}${extra} Quer que eu marque algum como "se tiver", tire ou acrescente algum item?`,
      lista: itens,
      tipo: m?.nome,
    };
  }

  const citados = itensCitados(texto, lista);
  if (/(tira|remove|exclui|sem )/.test(t) && citados.length) {
    return { resposta: `Pronto, tirei ${citados.map((c) => c.nome.toLowerCase()).join(' e ')}. A lista está ao lado.`, lista: lista.filter((it) => !citados.includes(it)) };
  }
  if (/(se tiver|opcional|não é obrigat)/.test(t) && citados.length) {
    return {
      resposta: `Marquei ${citados.map((c) => c.nome.toLowerCase()).join(' e ')} como "se tiver".`,
      lista: lista.map((it) => (citados.includes(it) ? { ...it, obrigatorio: false } : it)),
    };
  }
  const pedido = texto.match(/(?:acrescenta|inclui|adiciona|coloca)\s+(?:também\s+)?(?:o |a |os |as |um |uma )?(.+)/i);
  if (pedido) {
    const nome = pedido[1].replace(/[.!?]+$/, '').trim();
    const item = { nome: nome[0].toUpperCase() + nome.slice(1), detalhe: '', obrigatorio: true };
    return { resposta: `Acrescentei "${item.nome}". Vale escrever ao lado uma explicação curta para o cliente.`, lista: [...lista, item] };
  }
  if (/(simples|explica|explicaç)/.test(t)) {
    return { resposta: 'Reescrevi as explicações num tom mais direto, como você falaria com o cliente. Confira ao lado.', lista };
  }
  return { resposta: 'Anotei. Se quiser, me diga quais itens tirar, quais deixar como "se tiver" ou o que acrescentar.', lista };
}

