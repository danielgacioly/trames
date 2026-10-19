import { useState, type FormEvent } from 'react';
import { api } from '../../dados/api';
import { chaves, useAcao, useSessao } from '../../dados/consultas';
import { AvisoErro, useToast } from '../../ui/comuns';
import { iniciais } from '../../util/formatos';

const PERMISSOES = { admin: 'Administra a conta', monta: 'Monta balcões', confere: 'Confere documentos' };

/** Quem é a pessoa: nome e cargo aparecem para a equipe e no histórico dos balcões. */
export function Perfil() {
  const s = useSessao();
  const [f, setF] = useState({ nome: s.usuario.nome, cargo: s.usuario.cargo ?? '' });
  const [toast, avisar] = useToast();
  const salvar = useAcao((corpo: typeof f) => api('PUT', '/conta/perfil', corpo), [chaves.eu, chaves.equipe]);
  const mudou = f.nome.trim() !== s.usuario.nome || f.cargo.trim() !== (s.usuario.cargo ?? '');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await salvar.mutateAsync({ nome: f.nome.trim(), cargo: f.cargo.trim() });
    avisar('Perfil atualizado.');
  }

  return (
    <>
      <form className="secao" onSubmit={enviar}>
        <div className="secao__cabeca">
          <h2>Meu perfil</h2>
          <p className="pequeno texto-suave">Seu nome aparece para a equipe e no histórico de cada balcão. O cliente vê só o nome do escritório.</p>
        </div>
        <div className="secao__corpo">
          <div className="linha" style={{ gap: 16 }}>
            <span className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>
              {iniciais(f.nome || s.usuario.nome)}
            </span>
            <div className="coluna" style={{ gap: 2 }}>
              <strong style={{ fontWeight: 500 }}>{f.nome || s.usuario.nome}</strong>
              <span className="pequeno texto-suave">{f.cargo || PERMISSOES[s.usuario.permissao]}</span>
            </div>
          </div>
          <AvisoErro erro={salvar.error} />
          <div className="campos-2">
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Nome completo</span>
              <input className="tr-campo__entrada" required minLength={2} maxLength={120} autoComplete="name" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </label>
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Cargo (opcional)</span>
              <input className="tr-campo__entrada" maxLength={80} placeholder="Ex.: Advogada, Contador, Secretária" autoComplete="organization-title" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} />
            </label>
          </div>
          <label className="tr-campo tr-campo--largo">
            <span className="tr-campo__rotulo">E-mail de acesso</span>
            <input className="tr-campo__entrada" value={s.usuario.email} disabled />
            <span className="tr-campo__dica">É por ele que você entra e recebe o código de acesso. Para trocar, fale com o suporte.</span>
          </label>
        </div>
        <div className="secao__rodape">
          <span className="miudo texto-suave">Permissão: {PERMISSOES[s.usuario.permissao]}</span>
          <button type="submit" className="tr-btn tr-btn--primario tr-btn--sm" disabled={!mudou || salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
      {toast}
    </>
  );
}
