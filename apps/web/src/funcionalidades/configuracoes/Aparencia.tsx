import { useState } from 'react';
import { salvarTema, temaSalvo, type Tema } from '../../ui/tema';

const OPCOES: { id: Tema; rotulo: string; texto: string; cores: [string, string, string] }[] = [
  { id: 'claro', rotulo: 'Claro', texto: 'Areia, como o balcão do cliente', cores: ['#eee8dd', '#f7f4ee', '#13594b'] },
  { id: 'escuro', rotulo: 'Escuro', texto: 'Para trabalhar à noite', cores: ['#211c17', '#171310', '#6cc0a7'] },
  { id: 'sistema', rotulo: 'Automático', texto: 'Segue o seu computador', cores: ['#eee8dd', '#171310', '#13594b'] },
];

/** Tema do painel. Fica salvo neste navegador; a página do cliente continua clara. */
export function Aparencia() {
  const [tema, setTema] = useState(temaSalvo);

  function escolher(t: Tema) {
    setTema(t);
    salvarTema(t);
  }

  return (
    <section className="secao">
      <div className="secao__cabeca">
        <h2>Aparência</h2>
        <p className="pequeno texto-suave">Vale para este navegador. O que o seu cliente vê não muda.</p>
      </div>
      <div className="secao__corpo">
        <div className="temas" role="radiogroup" aria-label="Tema">
          {OPCOES.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={tema === o.id} className="tema" onClick={() => escolher(o.id)}>
              <span className="tema__amostra" aria-hidden="true">
                <span style={{ background: o.cores[0] }} />
                <span style={{ background: o.id === 'sistema' ? `linear-gradient(135deg, #f7f4ee 50%, ${o.cores[1]} 50%)` : o.cores[1], padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ height: 8, width: '60%', borderRadius: 4, background: o.cores[2] }} />
                  <span style={{ height: 6, width: '80%', borderRadius: 4, background: o.cores[2], opacity: 0.3 }} />
                  <span style={{ height: 6, width: '45%', borderRadius: 4, background: o.cores[2], opacity: 0.3 }} />
                </span>
              </span>
              <span className="coluna" style={{ gap: 0 }}>
                <span style={{ fontWeight: 500 }}>{o.rotulo}</span>
                <span className="miudo texto-suave">{o.texto}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
