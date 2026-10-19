import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/*
 * Confirmação dentro do app, no lugar do window.confirm do navegador:
 *   const confirmar = useConfirmar();
 *   if (!(await confirmar({ titulo: 'Apagar a pasta?', texto: '...', botao: 'Apagar', perigo: true }))) return;
 */
export interface Pedido {
  titulo: string;
  texto?: string;
  botao: string;
  /** Ação que apaga ou desfaz algo: o botão fica vermelho. */
  perigo?: boolean;
}

type Aberto = Pedido & { responder: (sim: boolean) => void };
const Contexto = createContext<((p: Pedido) => Promise<boolean>) | null>(null);

export function ProvedorConfirmacao({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const confirmar = useCallback(
    (p: Pedido) =>
      new Promise<boolean>((resolver) =>
        setAberto({
          ...p,
          responder: (sim) => {
            setAberto(null);
            resolver(sim);
          },
        }),
      ),
    [],
  );
  return (
    <Contexto.Provider value={confirmar}>
      {children}
      {aberto && <Dialogo a={aberto} />}
    </Contexto.Provider>
  );
}

function Dialogo({ a }: { a: Aberto }) {
  const sim = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    sim.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && a.responder(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [a]);
  return (
    <div className="dialogo__fundo" onClick={() => a.responder(false)}>
      <div className="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo" onClick={(e) => e.stopPropagation()}>
        <h2 id="dialogo-titulo">{a.titulo}</h2>
        {a.texto && <p className="pequeno texto-suave">{a.texto}</p>}
        <div className="dialogo__botoes">
          <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => a.responder(false)}>
            Voltar
          </button>
          <button ref={sim} type="button" className={`tr-btn tr-btn--sm ${a.perigo ? 'tr-btn--perigo' : 'tr-btn--primario'}`} onClick={() => a.responder(true)}>
            {a.botao}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirmar() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useConfirmar fora do ProvedorConfirmacao');
  return c;
}
