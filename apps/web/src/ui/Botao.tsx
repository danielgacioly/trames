import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Icone, type NomeIcone } from './Icone';

export type Variante = 'padrao' | 'primario' | 'simples' | 'perigo' | 'icone';

const classes = (variante: Variante, grande?: boolean, bloco?: boolean) =>
  ['botao', variante !== 'padrao' && `botao--${variante}`, grande && 'botao--grande', bloco && 'botao--bloco'].filter(Boolean).join(' ');

interface Comum {
  variante?: Variante;
  icone?: NomeIcone;
  grande?: boolean;
  bloco?: boolean;
  children?: ReactNode;
}

export const Botao = forwardRef<HTMLButtonElement, Comum & ButtonHTMLAttributes<HTMLButtonElement>>(function Botao(
  { variante = 'padrao', icone, grande, bloco, children, type = 'button', ...resto },
  ref,
) {
  return (
    <button ref={ref} type={type} className={classes(variante, grande, bloco)} {...resto}>
      {icone && <Icone nome={icone} />}
      {children}
    </button>
  );
});

export function BotaoLink({ variante = 'padrao', icone, grande, bloco, children, ...resto }: Comum & LinkProps) {
  return (
    <Link className={classes(variante, grande, bloco)} {...resto}>
      {icone && <Icone nome={icone} />}
      {children}
    </Link>
  );
}
