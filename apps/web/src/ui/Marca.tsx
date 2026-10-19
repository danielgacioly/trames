import { Link } from 'react-router-dom';
import { iniciais } from '../util/formatos';

/** Logo oficial (lockup). */
export function Logo({ altura = 26, para }: { altura?: number; para?: string }) {
  const img = <img className="logo" src="/marca/trames-lockup.svg" alt="trames" style={{ height: altura }} />;
  return para ? (
    <Link to={para} aria-label="trames" style={{ display: 'inline-flex' }}>
      {img}
    </Link>
  ) : (
    img
  );
}

/** Sigla colorida do escritório (a marca que o cliente vê no balcão). */
export function SeloConta({ conta, tamanho = 28 }: { conta: { sigla: string; cor: string }; tamanho?: number }) {
  return (
    <span className="selo" style={{ background: conta.cor, width: tamanho, height: tamanho, fontSize: tamanho * 0.38 }}>
      {conta.sigla}
    </span>
  );
}

export function Avatar({ nome, tamanho }: { nome: string; tamanho?: number }) {
  return (
    <span className="avatar" style={tamanho ? { width: tamanho, height: tamanho, fontSize: tamanho * 0.4 } : undefined} aria-hidden="true">
      {iniciais(nome)}
    </span>
  );
}
