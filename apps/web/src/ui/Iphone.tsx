import type { ReactNode } from 'react';

/** Moldura de iPhone para mostrar o que o cliente vê. O conteúdo vai dentro da tela. */
export function Iphone({ children }: { children: ReactNode }) {
  return (
    <div className="iphone" aria-hidden="true">
      <span className="iphone__botao iphone__botao--acao" />
      <span className="iphone__botao iphone__botao--mais" />
      <span className="iphone__botao iphone__botao--menos" />
      <span className="iphone__botao iphone__botao--lado" />
      <div className="iphone__tela">
        <div className="iphone__status">
          <span>9:41</span>
          <span className="iphone__ilha" />
          <span className="iphone__icones">
            <span className="iphone__sinal">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="iphone__bateria" />
          </span>
        </div>
        <div className="iphone__conteudo">{children}</div>
        <span className="iphone__home" />
      </div>
    </div>
  );
}
