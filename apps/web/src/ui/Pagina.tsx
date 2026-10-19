import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from './Icone';

/** Página com título grande, subtítulo e ferramentas à direita (como no Mail, Notas, Ajustes). */
export function Pagina({
  titulo,
  subtitulo,
  ferramentas,
  voltar,
  estreita,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  ferramentas?: ReactNode;
  voltar?: { para: string; rotulo: string };
  estreita?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`pagina${estreita ? ' pagina--estreita' : ''}`}>
      {voltar && (
        <Link to={voltar.para} className="pagina__voltar">
          <Icone nome="voltar" />
          {voltar.rotulo}
        </Link>
      )}
      <header className="pagina__cabeca">
        <div className="pagina__titulos">
          <h1 className="titulo-grande">{titulo}</h1>
          {subtitulo && <p className="subtitulo">{subtitulo}</p>}
        </div>
        {ferramentas && <div className="pagina__ferramentas">{ferramentas}</div>}
      </header>
      {children}
    </div>
  );
}
