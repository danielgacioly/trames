/*
 * Como o escritório chama os balcões: "processo", "projeto", "solicitação"...
 * O código e os textos usam "balcão"; trocarTermo troca na hora de mostrar,
 * ajustando as palavras coladas ao nome quando ele é feminino ("o balcão aberto"
 * vira "a solicitação aberta").
 */
export interface Termo {
  singular: string;
  plural: string;
  feminino: boolean;
}

export const TERMO_PADRAO: Termo = { singular: 'balcão', plural: 'balcões', feminino: false };

/** Sugestões na tela de Configurações. */
export const TERMOS_SUGERIDOS: Termo[] = [
  TERMO_PADRAO,
  { singular: 'processo', plural: 'processos', feminino: false },
  { singular: 'projeto', plural: 'projetos', feminino: false },
  { singular: 'pedido', plural: 'pedidos', feminino: false },
  { singular: 'caso', plural: 'casos', feminino: false },
  { singular: 'solicitação', plural: 'solicitações', feminino: true },
];

const ANTES: Record<string, string> = {
  o: 'a', os: 'as', um: 'uma', uns: 'umas', do: 'da', dos: 'das', no: 'na', nos: 'nas', ao: 'à', aos: 'às', pelo: 'pela', pelos: 'pelas',
  num: 'numa', este: 'esta', estes: 'estas', esse: 'essa', esses: 'essas', deste: 'desta', destes: 'destas', desse: 'dessa', neste: 'nesta', nesse: 'nessa',
  novo: 'nova', novos: 'novas', seu: 'sua', seus: 'suas', nenhum: 'nenhuma', todo: 'toda', todos: 'todas', outro: 'outra', outros: 'outras', mesmo: 'mesma',
  primeiro: 'primeira', próximo: 'próxima', próximos: 'próximas', último: 'última', últimos: 'últimas', quantos: 'quantas', vários: 'várias',
};
/** Adjetivos e particípios que vêm depois do nome (ou depois de "está", "foi"...). */
const DEPOIS = /^(abert|concluíd|arquivad|ativ|criad|nov|encerrad|vencid|cobrad|apagad|reabert|selecionad|esquecid|aprovad|enviad)(o|os)$/;
const PREPOSICOES = new Set(['de', 'do', 'dos', 'deste', 'destes', 'desse', 'desses', 'no', 'nos', 'neste', 'nesse', 'pelo', 'pelos', 'ao', 'aos', 'num', 'em', 'por', 'com', 'para', 'sem']);
const VERBOS = new Set(['está', 'estão', 'foi', 'foram', 'fica', 'ficam', 'será', 'serão', 'ficou', 'ficaram', 'é', 'são', 'seja', 'sejam']);

const capitalizar = (s: string) => s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1);
const comCaixa = (modelo: string, novo: string) => (modelo.charAt(0) === modelo.charAt(0).toLocaleUpperCase('pt-BR') && modelo.charAt(0) !== modelo.charAt(0).toLocaleLowerCase('pt-BR') ? capitalizar(novo) : novo);
const feminizar = (palavra: string) => {
  const base = palavra.toLocaleLowerCase('pt-BR');
  const antes = ANTES[base];
  if (antes) return comCaixa(palavra, antes);
  const m = base.match(DEPOIS);
  if (m) return comCaixa(palavra, m[1] + (m[2] === 'os' ? 'as' : 'a'));
  return palavra;
};

export function trocarTermo(texto: string, termo: Termo = TERMO_PADRAO): string {
  if (!texto || (termo.singular === 'balcão' && termo.plural === 'balcões')) return texto;
  if (!/balc[ãõ]/i.test(texto)) return texto;
  const partes = texto.split(/(\s+)/);
  for (let i = 0; i < partes.length; i++) {
    const m = partes[i].match(/^([^\p{L}]*)(balcão|balcões)([^\p{L}]*)$/iu);
    if (!m) continue;
    const plural = /õ/i.test(m[2]);
    let novo = plural ? termo.plural : termo.singular;
    if (m[2] === m[2].toLocaleUpperCase('pt-BR')) novo = novo.toLocaleUpperCase('pt-BR');
    else if (m[2].charAt(0) === 'B') novo = capitalizar(novo);
    partes[i] = m[1] + novo + m[3];
    if (!termo.feminino) continue;
    // Palavra logo antes ("o", "um", "novo"...) e, depois de artigo, a anterior ("todos os").
    const a = i - 2;
    const anterior = a >= 0 ? (partes[a].match(/[\p{L}]+$/u)?.[0] ?? '').toLocaleLowerCase('pt-BR') : '';
    if (a >= 0) partes[a] = partes[a].replace(/[\p{L}]+$/u, (w) => feminizar(w));
    if (['o', 'os'].includes(anterior) && a - 2 >= 0 && /^tod/i.test(partes[a - 2])) partes[a - 2] = partes[a - 2].replace(/[\p{L}]+$/u, (w) => feminizar(w));
    // Palavra logo depois ("aberto"). Depois de "está", "foi"... só quando o nome é o sujeito
    // ("este balcão está concluído"), não quando vem com preposição ("os arquivos deste balcão foram apagados").
    let d = i + 2;
    if (d < partes.length && !/[.,;:!?)]$/.test(partes[i])) {
      const w = partes[d].replace(/[^\p{L}]/gu, '').toLocaleLowerCase('pt-BR');
      const comPreposicao = PREPOSICOES.has(anterior);
      if (VERBOS.has(w)) {
        if (comPreposicao || d + 2 >= partes.length) continue;
        d += 2;
      }
      partes[d] = partes[d].replace(/^[\p{L}]+/u, (x) => feminizar(x));
    }
  }
  return partes.join('');
}

/**
 * Rótulos soltos que se referem aos balcões sem dizer o nome ("Abertos", "2 abertos",
 * "Concluídos e arquivados"). Com um nome feminino, viram "Abertas", "2 abertas"...
 */
const ROTULO_SOLTO = /^(\d+\s+)?(todos os\s+)?(abertos?|encerrados?|concluídos?|arquivados?|ativos?)(\s+e\s+(arquivados?|concluídos?))?$/i;
export function rotuloNoGenero(texto: string, termo: Termo = TERMO_PADRAO): string {
  if (!termo.feminino || !ROTULO_SOLTO.test(texto.trim())) return texto;
  return texto.replace(/[\p{L}]+/gu, (w) => feminizar(w));
}
