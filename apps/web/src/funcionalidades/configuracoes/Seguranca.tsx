import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { AparelhoDto } from '@trames/shared';
import { api } from '../../dados/api';
import { useAcao } from '../../dados/consultas';
import { AvisoErro, useToast } from '../../ui/comuns';
import { quandoEnviado } from '../../util/formatos';

const CHAVE_APARELHOS = ['conta', 'aparelhos'] as const;

/** Senha (sabendo a atual) e os aparelhos em que a pessoa está conectada. */
export function Seguranca() {
  const [f, setF] = useState({ atual: '', nova: '', repetir: '' });
  const [erro, setErro] = useState('');
  const [toast, avisar] = useToast();
  const aparelhos = useQuery({ queryKey: CHAVE_APARELHOS, queryFn: () => api<AparelhoDto[]>('GET', '/conta/aparelhos') });
  const trocar = useAcao((corpo: { atual: string; nova: string }) => api('PUT', '/conta/senha', corpo), [CHAVE_APARELHOS]);
  const desconectar = useAcao((id: string) => api('DELETE', `/conta/aparelhos/${id}`), [CHAVE_APARELHOS]);
  const outros = (aparelhos.data ?? []).filter((a) => !a.atual);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (f.nova.length < 10) return setErro('A senha nova precisa de pelo menos 10 caracteres.');
    if (f.nova !== f.repetir) return setErro('As duas senhas novas não são iguais.');
    await trocar.mutateAsync({ atual: f.atual, nova: f.nova });
    setF({ atual: '', nova: '', repetir: '' });
    avisar('Senha trocada. Os outros aparelhos foram desconectados.');
  }

  return (
    <>
      <form className="secao" onSubmit={enviar}>
        <div className="secao__cabeca">
          <h2>Senha</h2>
          <p className="pequeno texto-suave">Ao trocar, os outros aparelhos saem da conta. Este continua conectado.</p>
        </div>
        <div className="secao__corpo">
          <AvisoErro erro={erro ? new Error(erro) : trocar.error} />
          <label className="tr-campo tr-campo--largo" style={{ maxWidth: 360 }}>
            <span className="tr-campo__rotulo">Senha atual</span>
            <input className="tr-campo__entrada" type="password" required autoComplete="current-password" value={f.atual} onChange={(e) => setF({ ...f, atual: e.target.value })} />
          </label>
          <div className="campos-2">
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Senha nova</span>
              <input className="tr-campo__entrada" type="password" required minLength={10} autoComplete="new-password" value={f.nova} onChange={(e) => setF({ ...f, nova: e.target.value })} />
              <span className="tr-campo__dica">Pelo menos 10 caracteres. Uma frase curta é mais fácil de lembrar.</span>
            </label>
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Repita a senha nova</span>
              <input className="tr-campo__entrada" type="password" required autoComplete="new-password" value={f.repetir} onChange={(e) => setF({ ...f, repetir: e.target.value })} />
            </label>
          </div>
        </div>
        <div className="secao__rodape">
          <span className="miudo texto-suave">Ao entrar, você também confirma um código enviado para o seu e-mail.</span>
          <button type="submit" className="tr-btn tr-btn--primario tr-btn--sm" disabled={trocar.isPending || !f.atual || !f.nova}>
            {trocar.isPending ? 'Trocando…' : 'Trocar senha'}
          </button>
        </div>
      </form>

      <section className="secao">
        <div className="secao__cabeca">
          <h2>Aparelhos conectados</h2>
          <p className="pequeno texto-suave">Onde a sua conta está aberta agora. Não reconhece algum? Desconecte e troque a senha.</p>
        </div>
        <div className="secao__corpo" style={{ gap: 0 }}>
          <AvisoErro erro={aparelhos.error ?? desconectar.error} />
          {(aparelhos.data ?? []).map((a) => (
            <div key={a.id} className="linha-config">
              <div className="coluna" style={{ gap: 2 }}>
                <strong style={{ fontWeight: 500 }}>
                  {a.aparelho}
                  {a.atual && <span className="tr-etiqueta" style={{ marginLeft: 8, background: 'var(--mangue-suave)', color: 'var(--mangue)' }}>Este aparelho</span>}
                </strong>
                <span className="miudo texto-suave">Entrou {quandoEnviado(a.criadaEm)}</span>
              </div>
              {!a.atual && (
                <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" disabled={desconectar.isPending} onClick={() => desconectar.mutate(a.id)}>
                  Desconectar
                </button>
              )}
            </div>
          ))}
        </div>
        {outros.length > 1 && (
          <div className="secao__rodape">
            <span className="miudo texto-suave">{outros.length} outros aparelhos</span>
            <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" disabled={desconectar.isPending} onClick={() => desconectar.mutate('outros')}>
              Sair de todos os outros
            </button>
          </div>
        )}
      </section>
      {toast}
    </>
  );
}
