import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Permissao } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useEquipe, useSessao } from '../../dados/consultas';
import { AvisoErro, Bloqueio, Carregando, useToast } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { iniciais, plural } from '../../util/formatos';
import { useConfirmar } from '../../ui/Confirmar';

const PERMISSOES: Record<Permissao, { nome: string; texto: string }> = {
  admin: { nome: 'Administra', texto: 'Tudo, inclusive plano e equipe' },
  monta: { nome: 'Monta balcões', texto: 'Cria balcões e confere documentos' },
  confere: { nome: 'Só confere', texto: 'Aprova ou recusa documentos' },
};

export function Equipe() {
  const confirmar = useConfirmar();
  const s = useSessao();
  const consulta = useEquipe();
  const limite = s.plano.limitePessoas;
  const comPermissoes = s.tem('permissoes');
  const souAdmin = s.usuario.permissao === 'admin';
  const [convite, setConvite] = useState({ nome: '', email: '', permissao: 'monta' as Permissao });
  const [toast, avisar] = useToast();
  const convidar = useAcao((c: typeof convite) => api('POST', '/organizacao/equipe', c), [chaves.equipe]);
  const mudar = useAcao((x: { id: string; permissao: Permissao }) => api('PATCH', `/organizacao/equipe/${x.id}`, { permissao: x.permissao }), [chaves.equipe]);
  const remover = useAcao((id: string) => api('DELETE', `/organizacao/equipe/${id}`), [chaves.equipe]);

  if (consulta.isPending) return <Carregando />;
  const pessoas = consulta.data ?? [];
  const cheio = limite !== null && pessoas.length >= limite;

  async function enviarConvite(e: FormEvent) {
    e.preventDefault();
    await convidar.mutateAsync(convite);
    avisar(`Convite enviado para ${convite.email}.`);
    setConvite({ nome: '', email: '', permissao: 'monta' });
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Equipe</h1>
          <p className="subtitulo">
            {limite === null ? `${plural(pessoas.length, 'pessoa', 'pessoas')} na conta. O plano ${s.plano.nome} não tem limite de pessoas.` : `${pessoas.length} de ${limite} ${limite === 1 ? 'pessoa' : 'pessoas'} no plano ${s.plano.nome}.`} Para entrar, cada pessoa confirma um código enviado ao e-mail dela.
          </p>
        </div>
      </div>
      <AvisoErro erro={convidar.error ?? mudar.error ?? remover.error} />
      <div className="tabela-caixa">
        <table className="tabela">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>E-mail</th>
              <th>Permissão</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="linha" style={{ flexWrap: 'nowrap', gap: 10 }}>
                    <span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                      {iniciais(p.nome)}
                    </span>
                    <span style={{ fontWeight: 500 }}>
                      {p.nome}
                      {p.id === s.usuario.id && <span className="texto-suave" style={{ fontWeight: 400 }}> (você)</span>}
                      {p.convitePendente && <span className="texto-suave" style={{ fontWeight: 400 }}> · convite pendente</span>}
                    </span>
                  </span>
                </td>
                <td className="texto-suave">{p.email}</td>
                <td>
                  {comPermissoes && souAdmin && p.id !== s.usuario.id ? (
                    <select className="tr-campo__entrada" style={{ height: 36, fontSize: 14 }} value={p.permissao} onChange={(e) => mudar.mutate({ id: p.id, permissao: e.target.value as Permissao })} aria-label={`Permissão de ${p.nome}`}>
                      {(Object.keys(PERMISSOES) as Permissao[]).map((k) => (
                        <option key={k} value={k}>
                          {PERMISSOES[k].nome}
                        </option>
                      ))}
                    </select>
                  ) : comPermissoes ? (
                    PERMISSOES[p.permissao].nome
                  ) : (
                    <span className="texto-suave">Acesso completo</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {p.id !== s.usuario.id && souAdmin && (
                    <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ color: 'var(--recusado)' }} onClick={async () => (await confirmar({ titulo: `Tirar ${p.nome} da conta?`, texto: 'A pessoa sai na hora de todos os aparelhos. O que ela fez continua no histórico.', botao: 'Remover', perigo: true })) && remover.mutate(p.id)}>
                      Remover
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comPermissoes ? (
        <div className="linha" style={{ gap: 12 }}>
          {(Object.keys(PERMISSOES) as Permissao[]).map((k) => (
            <span key={k} className="pilula">
              <strong style={{ fontWeight: 500 }}>{PERMISSOES[k].nome}:</strong> {PERMISSOES[k].texto}
            </span>
          ))}
        </div>
      ) : (
        <Bloqueio recurso="permissoes" compacto />
      )}

      {cheio ? (
        <div className="aviso aviso--plano">
          <Icone nome="cadeado" />
          <span>
            {limite === 1 ? 'O plano Grátis é para 1 pessoa.' : `O plano ${s.plano.nome} permite até ${limite} pessoas.`} Para chamar mais gente, <Link to="/planos">mude de plano</Link>.
          </span>
        </div>
      ) : (
        souAdmin && (
          <form className="cartao" onSubmit={enviarConvite} style={{ maxWidth: 760 }}>
            <h2 className="titulo-2">Convidar pessoa</h2>
            <p className="pequeno texto-suave">A pessoa recebe um e-mail para criar a senha. O convite vale 7 dias.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16, alignItems: 'end' }}>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">Nome</span>
                <input className="tr-campo__entrada" required minLength={2} value={convite.nome} onChange={(e) => setConvite({ ...convite, nome: e.target.value })} />
              </label>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">E-mail</span>
                <input className="tr-campo__entrada" type="email" required value={convite.email} onChange={(e) => setConvite({ ...convite, email: e.target.value })} />
              </label>
              {comPermissoes && (
                <label className="tr-campo tr-campo--largo">
                  <span className="tr-campo__rotulo">Permissão</span>
                  <select className="tr-campo__entrada" value={convite.permissao} onChange={(e) => setConvite({ ...convite, permissao: e.target.value as Permissao })}>
                    {(Object.keys(PERMISSOES) as Permissao[]).map((k) => (
                      <option key={k} value={k}>
                        {PERMISSOES[k].nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="submit" className="tr-btn tr-btn--primario" disabled={convidar.isPending}>
                Enviar convite
              </button>
            </div>
          </form>
        )
      )}
      {toast}
    </>
  );
}
