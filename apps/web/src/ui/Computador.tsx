import type { ReactNode } from 'react';

/** Moldura de notebook com navegador, para mostrar o que o cliente vê no computador. */
export function Computador({ endereco, children }: { endereco: string; children: ReactNode }) {
  return (
    <div className="computador" aria-hidden="true">
      <div className="computador__tela">
        <div className="computador__barra">
          <span className="computador__bolinhas">
            <i />
            <i />
            <i />
          </span>
          <span className="computador__endereco">{endereco}</span>
        </div>
        <div className="computador__conteudo">{children}</div>
      </div>
      <div className="computador__base" />
    </div>
  );
}
