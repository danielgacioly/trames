import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Icone } from './Icone';

/** Campo com rótulo em cima (telas de entrada e diálogos). */
export function Campo({ rotulo, dica, erro, children }: { rotulo: ReactNode; dica?: ReactNode; erro?: ReactNode; children: ReactNode }) {
  return (
    <label className="campo">
      <span className="campo__rotulo">{rotulo}</span>
      {children}
      {erro ? <span className="campo__erro">{erro}</span> : dica && <span className="campo__dica">{dica}</span>}
    </label>
  );
}

export function Entrada({ grande, className = '', ...resto }: InputHTMLAttributes<HTMLInputElement> & { grande?: boolean }) {
  return <input className={`entrada${grande ? ' entrada--grande' : ''} ${className}`} {...resto} />;
}

export function Selecao({ children, className = '', ...resto }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`entrada ${className}`} {...resto}>
      {children}
    </select>
  );
}

export function AreaTexto({ className = '', ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`entrada ${className}`} {...resto} />;
}

/** Interruptor liga/desliga, como no iOS. */
export function Interruptor({ ligado, mudar, rotulo, disabled }: { ligado: boolean; mudar: (v: boolean) => void; rotulo: string; disabled?: boolean }) {
  return <input type="checkbox" role="switch" className="interruptor" aria-label={rotulo} checked={ligado} disabled={disabled} onChange={(e) => mudar(e.target.checked)} />;
}

export function Busca({ valor, mudar, rotulo }: { valor: string; mudar: (v: string) => void; rotulo: string }) {
  return (
    <label className="busca">
      <Icone nome="lupa" />
      <span className="sr-only">{rotulo}</span>
      <input className="entrada" type="search" placeholder={rotulo} value={valor} onChange={(e) => mudar(e.target.value)} />
    </label>
  );
}
