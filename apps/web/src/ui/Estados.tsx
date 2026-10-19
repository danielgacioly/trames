import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PLANOS, RECURSO_INFO, type Recurso } from '@trames/shared';
import { mensagemDe } from '../dados/api';
import { Icone } from './Icone';

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="carregando" role="status">
      {texto}
    </div>
  );
}

export function AvisoErro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  return (
    <div className="erro-caixa" role="alert">
      <Icone nome="info" />
      <span>{mensagemDe(erro)}</span>
    </div>
  );
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="vazio">
      <p className="vazio__titulo">{titulo}</p>
      {texto && <p>{texto}</p>}
      {acao && <div style={{ marginTop: 10 }}>{acao}</div>}
    </div>
  );
}

/** Nota pequena, cinza, no fluxo do texto. */
export function Nota({ children, erro }: { children: ReactNode; erro?: boolean }) {
  return (
    <p className={`nota${erro ? ' nota--erro' : ''}`}>
      <Icone nome="info" />
      <span>{children}</span>
    </p>
  );
}

/** Recurso fora do plano: uma linha discreta com o link para os planos. */
export function Bloqueado({ recurso }: { recurso: Recurso }) {
  const info = RECURSO_INFO[recurso];
  return (
    <p className="nota">
      <Icone nome="cadeado" />
      <span>
        {info.texto} <Link to="/planos">Conhecer o {PLANOS[info.plano].nome}</Link>
      </span>
    </p>
  );
}
