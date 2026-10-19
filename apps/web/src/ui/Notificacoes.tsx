import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icone, type NomeIcone } from './Icone';

/*
 * Notificações no canto da tela, como as do macOS: confirmação de ações
 * ("Lembrete enviado") e avisos de uso ("Cota de WhatsApp acabou"). Somem
 * sozinhas; os avisos ficam um pouco mais.
 */

export interface Notificacao {
  titulo: string;
  texto?: string;
  tom?: 'sucesso' | 'aviso' | 'erro';
  acao?: { rotulo: string; para: string };
  /** Em ms. Padrão: 3,5 s para sucesso, 9 s para avisos. */
  duracao?: number;
}

type ComId = Notificacao & { id: number };

const Contexto = createContext<((n: Notificacao) => void) | null>(null);
const ICONE: Record<NonNullable<Notificacao['tom']>, NomeIcone> = { sucesso: 'check', aviso: 'aviso', erro: 'info' };

let proximo = 0;

export function ProvedorNotificacoes({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<ComId[]>([]);
  const fechar = useCallback((id: number) => setLista((l) => l.filter((n) => n.id !== id)), []);
  const notificar = useCallback((n: Notificacao) => setLista((l) => [...l.slice(-3), { ...n, id: ++proximo }]), []);
  return (
    <Contexto.Provider value={notificar}>
      {children}
      <div className="ui camada">
        <div className="notificacoes" aria-live="polite">
        {lista.map((n) => (
          <Item key={n.id} n={n} fechar={() => fechar(n.id)} />
          ))}
        </div>
      </div>
    </Contexto.Provider>
  );
}

function Item({ n, fechar }: { n: ComId; fechar: () => void }) {
  const tom = n.tom ?? 'sucesso';
  useEffect(() => {
    const t = setTimeout(fechar, n.duracao ?? (tom === 'sucesso' ? 3500 : 9000));
    return () => clearTimeout(t);
  }, [n.duracao, tom, fechar]);
  return (
    <div className={`notificacao notificacao--${tom}`} role={tom === 'erro' ? 'alert' : 'status'}>
      <span className="notificacao__icone">
        <Icone nome={ICONE[tom]} />
      </span>
      <div className="notificacao__corpo">
        <span className="notificacao__titulo">{n.titulo}</span>
        {n.texto && <span className="notificacao__texto">{n.texto}</span>}
        {n.acao && (
          <Link className="notificacao__acao" to={n.acao.para} onClick={fechar}>
            {n.acao.rotulo}
          </Link>
        )}
      </div>
      <button type="button" className="notificacao__fechar" aria-label="Fechar" onClick={fechar}>
        <Icone nome="xis" />
      </button>
    </div>
  );
}

export function useNotificar() {
  const n = useContext(Contexto);
  if (!n) throw new Error('useNotificar fora do ProvedorNotificacoes');
  return n;
}
