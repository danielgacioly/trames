import { NavLink } from 'react-router-dom';

export interface Opcao<T extends string> {
  id: T;
  rotulo: string;
  contagem?: number;
}

/** Controle segmentado (filtros e abas curtas). */
export function Segmentado<T extends string>({ opcoes, valor, mudar, rotulo }: { opcoes: Opcao<T>[]; valor: T; mudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="segmentado" role="tablist" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === valor} className="segmentado__opcao" onClick={() => mudar(o.id)}>
          {o.rotulo}
          {o.contagem !== undefined && <span className="segmentado__contagem">{o.contagem}</span>}
        </button>
      ))}
    </div>
  );
}

/** O mesmo visual, mas cada opção é uma rota (seções de Minha conta). */
export function SegmentadoRotas({ opcoes, rotulo }: { opcoes: { para: string; rotulo: string }[]; rotulo: string }) {
  return (
    <nav className="segmentado" aria-label={rotulo}>
      {opcoes.map((o) => (
        <NavLink key={o.para} to={o.para} className="segmentado__opcao">
          {o.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
