import { useState } from 'react';

/*
 * "Ordenar por", separado do filtro. A escolha fica salva por lista neste navegador.
 *   const [ordem, setOrdem] = useOrdem('balcoes', ORDENS_BALCAO);
 *   <Ordenar valor={ordem} mudar={setOrdem} opcoes={ORDENS_BALCAO} />
 */
export type Opcoes<K extends string> = readonly { id: K; rotulo: string }[];

export function useOrdem<K extends string>(lista: string, opcoes: Opcoes<K>) {
  const chave = `trames.ordem.${lista}`;
  const [ordem, setOrdem] = useState<K>(() => {
    try {
      const salvo = localStorage.getItem(chave);
      if (opcoes.some((o) => o.id === salvo)) return salvo as K;
    } catch {
      /* sem storage: usa a primeira */
    }
    return opcoes[0].id;
  });
  const mudar = (k: K) => {
    setOrdem(k);
    try {
      localStorage.setItem(chave, k);
    } catch {
      /* vale só até recarregar */
    }
  };
  return [ordem, mudar] as const;
}

export function Ordenar<K extends string>({ valor, mudar, opcoes }: { valor: K; mudar: (k: K) => void; opcoes: Opcoes<K> }) {
  return (
    <label className="ordenar">
      <span>Ordenar por</span>
      <select value={valor} onChange={(e) => mudar(e.target.value as K)}>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}
