import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Botao } from './Botao';
import { AreaTexto } from './Campo';

/*
 * Diálogos no lugar de window.confirm e window.prompt: mesmo visual do resto do
 * painel, com Esc para cancelar e Enter para confirmar.
 */

interface PedidoConfirmar {
  titulo: string;
  texto?: ReactNode;
  confirmar?: string;
  perigo?: boolean;
}
interface PedidoTexto extends PedidoConfirmar {
  rotulo: string;
  dica?: string;
  minimo?: number;
}

type Pendente =
  | { tipo: 'confirmar'; pedido: PedidoConfirmar; resolver: (v: boolean) => void }
  | { tipo: 'texto'; pedido: PedidoTexto; resolver: (v: string | null) => void };

const Contexto = createContext<{ confirmar: (p: PedidoConfirmar) => Promise<boolean>; pedirTexto: (p: PedidoTexto) => Promise<string | null> } | null>(null);

export function ProvedorDialogos({ children }: { children: ReactNode }) {
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const confirmar = useCallback((pedido: PedidoConfirmar) => new Promise<boolean>((resolver) => setPendente({ tipo: 'confirmar', pedido, resolver })), []);
  const pedirTexto = useCallback((pedido: PedidoTexto) => new Promise<string | null>((resolver) => setPendente({ tipo: 'texto', pedido, resolver })), []);
  return (
    <Contexto.Provider value={{ confirmar, pedirTexto }}>
      {children}
      {pendente && (
        <div className="ui camada">
          <Dialogo pendente={pendente} fechar={() => setPendente(null)} />
        </div>
      )}
    </Contexto.Provider>
  );
}

function Dialogo({ pendente, fechar }: { pendente: Pendente; fechar: () => void }) {
  const { pedido } = pendente;
  const [texto, setTexto] = useState('');
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const minimo = pendente.tipo === 'texto' ? (pendente.pedido.minimo ?? 1) : 0;

  const cancelar = useCallback(() => {
    if (pendente.tipo === 'confirmar') pendente.resolver(false);
    else pendente.resolver(null);
    fechar();
  }, [pendente, fechar]);

  function ok() {
    if (pendente.tipo === 'confirmar') pendente.resolver(true);
    else {
      if (texto.trim().length < minimo) return;
      pendente.resolver(texto.trim());
    }
    fechar();
  }

  useEffect(() => {
    if (pendente.tipo === 'confirmar') confirmarRef.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cancelar();
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [pendente, cancelar]);

  return (
    <div className="veu-dialogo" onMouseDown={(e) => e.target === e.currentTarget && cancelar()}>
      <form
        className={`dialogo${pendente.tipo === 'texto' ? ' dialogo--largo' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        onSubmit={(e) => {
          e.preventDefault();
          ok();
        }}
      >
        <h2 id="dialogo-titulo" className="dialogo__titulo">
          {pedido.titulo}
        </h2>
        {pedido.texto && <div className="dialogo__texto">{pedido.texto}</div>}
        {pendente.tipo === 'texto' && (
          <label className="campo">
            <span className="campo__rotulo">{pendente.pedido.rotulo}</span>
            <AreaTexto autoFocus rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={pendente.pedido.dica} />
          </label>
        )}
        <div className="dialogo__botoes">
          <Botao onClick={cancelar}>Cancelar</Botao>
          <Botao ref={confirmarRef} type="submit" variante="primario" style={pedido.perigo ? { background: 'var(--vermelho)' } : undefined} disabled={pendente.tipo === 'texto' && texto.trim().length < minimo}>
            {pedido.confirmar ?? 'OK'}
          </Botao>
        </div>
      </form>
    </div>
  );
}

export function useDialogos() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useDialogos fora do ProvedorDialogos');
  return c;
}
