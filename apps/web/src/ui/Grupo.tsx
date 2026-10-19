import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from './Icone';

/** Seção com título, um grupo de linhas e uma nota embaixo (como nos Ajustes do iPhone e do Mac). */
export function Secao({ titulo, acao, nota, children }: { titulo?: ReactNode; acao?: ReactNode; nota?: ReactNode; children: ReactNode }) {
  return (
    <section className="secao">
      {(titulo || acao) && (
        <div className="secao__cabeca">
          {titulo ? <h2 className="titulo-secao">{titulo}</h2> : <span />}
          {acao}
        </div>
      )}
      <div className="grupo">{children}</div>
      {nota && <div className="secao__nota">{nota}</div>}
    </section>
  );
}

/** Linha com rótulo à esquerda e valor (ou controle) à direita. */
export function LinhaCampo({ rotulo, children, id }: { rotulo: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div className="linha linha--campo">
      <label className="linha__rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <div className="linha__valor">{children}</div>
    </div>
  );
}

/** Linha com título, subtítulo e algo à direita. Com `para`, vira link com seta. */
export function Linha({
  titulo,
  sub,
  direita,
  antes,
  para,
  onClick,
  ativa,
  tom,
}: {
  titulo: ReactNode;
  sub?: ReactNode;
  direita?: ReactNode;
  antes?: ReactNode;
  para?: string;
  onClick?: () => void;
  ativa?: boolean;
  tom?: 'acao' | 'perigo';
}) {
  const corpo = (
    <>
      {antes}
      <span className="linha__corpo">
        <span className={tom ? undefined : 'linha__titulo'}>{titulo}</span>
        {sub && <span className="linha__sub">{sub}</span>}
      </span>
      {direita}
      {(para || (onClick && !tom)) && <Icone nome="avancar" className="icone linha__seta" />}
    </>
  );
  const classe = `linha${ativa ? ' linha--ativa' : ''}${tom ? ` linha--${tom}` : ''}`;
  if (para)
    return (
      <Link to={para} className={classe}>
        {corpo}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" className={classe} onClick={onClick} aria-current={ativa || undefined}>
        {corpo}
      </button>
    );
  return <div className={classe}>{corpo}</div>;
}
