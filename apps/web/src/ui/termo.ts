import { useEffect } from 'react';
import { rotuloNoGenero, TERMO_PADRAO, trocarTermo, type Termo } from '@trames/shared';
import { useSessao } from '../dados/consultas';

/*
 * O escritório pode chamar os balcões de outra coisa (processos, projetos...).
 * Os textos do painel continuam dizendo "balcão"; enquanto o painel está aberto,
 * a troca é feita no que aparece na tela: textos, placeholders, rótulos de
 * acessibilidade, avisos e mensagens de erro. Ficam de fora o que a pessoa
 * digita (campos) e trechos marcados com data-termo-fixo.
 */

const ATRIBUTOS = ['placeholder', 'aria-label', 'title', 'alt'];
const ehPadrao = (t: Termo) => t.singular === TERMO_PADRAO.singular && t.plural === TERMO_PADRAO.plural;

function fixo(el: Element | null) {
  return !!el?.closest('input, textarea, [contenteditable="true"], [data-termo-fixo], script, style');
}

function trocarNo(no: Node, termo: Termo) {
  if (no.nodeType === Node.TEXT_NODE) {
    const atual = no.nodeValue ?? '';
    const temNome = /balc[ãõ]/i.test(atual);
    if ((!temNome && !termo.feminino) || fixo(no.parentElement)) return;
    const novo = temNome ? trocarTermo(atual, termo) : rotuloNoGenero(atual, termo);
    if (novo !== atual) no.nodeValue = novo;
    return;
  }
  if (no.nodeType !== Node.ELEMENT_NODE) return;
  const el = no as Element;
  if (el.closest('[data-termo-fixo]')) return;
  for (const a of ATRIBUTOS) {
    const v = el.getAttribute(a);
    if (v && /balc[ãõ]/i.test(v)) el.setAttribute(a, trocarTermo(v, termo));
  }
  if (fixo(el)) return;
  const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = andar.nextNode();
  while (n) {
    trocarNo(n, termo);
    n = andar.nextNode();
  }
}

/** Liga a troca enquanto o painel está aberto. */
export function useTermoNaTela(termo: Termo) {
  useEffect(() => {
    if (ehPadrao(termo)) return;
    trocarNo(document.body, termo);
    const obs = new MutationObserver((mudancas) => {
      for (const m of mudancas) {
        if (m.type === 'characterData') trocarNo(m.target, termo);
        else if (m.type === 'attributes') trocarNo(m.target, termo);
        else m.addedNodes.forEach((n) => trocarNo(n, termo));
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
    return () => obs.disconnect();
  }, [termo.singular, termo.plural, termo.feminino]);
}

/** Para textos que vão parar em campos (a mensagem do link) e não passam pela troca da tela. */
export function useTermo() {
  const { termo } = useSessao().organizacao;
  return (texto: string) => trocarTermo(texto, termo);
}
