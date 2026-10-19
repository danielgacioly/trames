import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from './Icone';

/*
 * Avisos que aparecem no canto da tela e somem sozinhos (uso do plano, cota de
 * WhatsApp, excedente). O detalhe fica sempre em Minha conta.
 */
export interface Notificacao {
  titulo: string;
  texto?: string;
  acao?: { rotulo: string; para: string };
}

type ComId = Notificacao & { id: number };

const Contexto = createContext<((n: Notificacao) => void) | null>(null);
let proximo = 0;

export function ProvedorNotificacoes({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<ComId[]>([]);
  const fechar = useCallback((id: number) => setLista((l) => l.filter((n) => n.id !== id)), []);
  const notificar = useCallback((n: Notificacao) => setLista((l) => [...l.slice(-2), { ...n, id: ++proximo }]), []);
  return (
    <Contexto.Provider value={notificar}>
      {children}
      <div className="notificacoes" aria-live="polite">
        {lista.map((n) => (
          <Item key={n.id} n={n} fechar={() => fechar(n.id)} />
        ))}
      </div>
    </Contexto.Provider>
  );
}

function Item({ n, fechar }: { n: ComId; fechar: () => void }) {
  useEffect(() => {
    const t = setTimeout(fechar, 9000);
    return () => clearTimeout(t);
  }, [fechar]);
  return (
    <div className="notificacao" role="status">
      <Icone nome="info" />
      <div className="notificacao__corpo">
        <strong>{n.titulo}</strong>
        {n.texto && <span>{n.texto}</span>}
        {n.acao && (
          <Link to={n.acao.para} onClick={fechar}>
            {n.acao.rotulo}
          </Link>
        )}
      </div>
      <button type="button" className="notificacao__fechar" aria-label="Fechar" onClick={fechar}>
        <Icone nome="xis" tamanho={16} />
      </button>
    </div>
  );
}

export function useNotificar() {
  const n = useContext(Contexto);
  if (!n) throw new Error('useNotificar fora do ProvedorNotificacoes');
  return n;
}
