import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icone, type NomeIcone } from './Icone';

export type ItemMenu =
  | { rotulo: string; icone?: NomeIcone; acao: () => void; perigo?: boolean; desativado?: boolean }
  | 'separador'
  | false
  | null
  | undefined;

/**
 * Menu de ações num botão "…" (ou outro gatilho). Fecha ao escolher, ao clicar
 * fora ou com Esc; navega com as setas.
 */
export function Menu({ itens, rotulo = 'Mais ações', gatilho }: { itens: ItemMenu[]; rotulo?: string; gatilho?: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const visiveis = itens.filter((i): i is Exclude<ItemMenu, false | null | undefined> => !!i);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const botoes = [...(caixa.current?.querySelectorAll<HTMLButtonElement>('.menu__item:not(:disabled)') ?? [])];
        const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
        botoes[(atual + (e.key === 'ArrowDown' ? 1 : -1) + botoes.length) % botoes.length]?.focus();
      }
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  if (!visiveis.some((i) => i !== 'separador')) return null;

  return (
    <div className="menu" ref={caixa}>
      <button type="button" className="botao botao--icone" aria-label={rotulo} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {gatilho ?? <Icone nome="pontos" />}
      </button>
      {aberto && (
        <div className="menu__lista" role="menu">
          {visiveis.map((i, k) =>
            i === 'separador' ? (
              <div key={k} className="menu__separador" role="separator" />
            ) : (
              <button
                key={i.rotulo}
                type="button"
                role="menuitem"
                className={`menu__item${i.perigo ? ' menu__item--perigo' : ''}`}
                disabled={i.desativado}
                onClick={() => {
                  setAberto(false);
                  i.acao();
                }}
              >
                {i.icone && <Icone nome={i.icone} />}
                {i.rotulo}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
