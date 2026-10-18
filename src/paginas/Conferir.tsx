import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { acoes, contagem, estaAberto, podeAbrirBalcao, podeConcluir, tem, useDb, useSessao } from '../dados/store';
import { Progresso, Status, useToast } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { dataLonga, primeiroNome, quandoEnviado } from '../util';

function PreviaArquivo({ nome }: { nome: string }) {
  const larguras = [92, 86, 90, 70, 88, 80, 60];
  return (
    <div style={{ background: 'var(--areia-funda)', borderRadius: 12, padding: 28, display: 'flex', justifyContent: 'center' }}>
      <div
        role="img"
        aria-label={`Prévia do arquivo ${nome}`}
        style={{ width: '100%', maxWidth: 360, aspectRatio: '3 / 4', background: '#fffdf8', borderRadius: 4, boxShadow: 'var(--shadow-sm)', padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <span style={{ height: 10, width: '55%', background: '#d8cfc0', borderRadius: 3 }} />
        <span style={{ height: 6, width: '35%', background: '#e6dfd3', borderRadius: 3 }} />
        <span style={{ height: 1, background: '#e6dfd3', margin: '8px 0' }} />
        {larguras.map((w, k) => (
          <span key={k} style={{ height: 6, width: `${w}%`, background: '#e6dfd3', borderRadius: 3, marginTop: k === 4 ? 10 : 0 }} />
        ))}
        <span style={{ marginTop: 'auto', alignSelf: 'flex-end', width: 64, height: 64, borderRadius: 9999, border: '2px solid #d8cfc0' }} />
      </div>
    </div>
  );
}

export function Conferir() {
  const { id } = useParams();
  const db = useDb();
  const sessao = useSessao()!;
  const navegar = useNavigate();
  const b = db.balcoes.find((x) => x.id === id && x.contaId === sessao.conta.id);
  const [selId, setSelId] = useState(() => b?.docs.find((d) => d.status === 'analise')?.id ?? b?.docs[0]?.id);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [toast, avisar] = useToast();

  if (!b) {
    return (
      <div className="coluna">
        <h1 className="titulo-1">Balcão não encontrado</h1>
        <Link to="/app">Voltar para os balcões</Link>
      </div>
    );
  }

  const nome = primeiroNome(b.cliente.nome);
  const c = contagem(b);
  const sel = b.docs.find((d) => d.id === selId) ?? b.docs[0];
  const aberto = estaAberto(b);
  const somenteConfere = sessao.usuario.permissao === 'confere' && tem(sessao, 'permissoes');

  function lembrar() {
    avisar(`Lembrete enviado para ${nome} pelo WhatsApp.`);
  }

  return (
    <>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Link to="/app" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start' }}>
          <Icone nome="voltar" />
          Balcões
        </Link>
        <div className="linha linha--entre" style={{ alignItems: 'flex-end', gap: 20 }}>
          <div className="coluna" style={{ gap: 6 }}>
            <div className="linha" style={{ gap: 12 }}>
              <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>{b.cliente.nome}</h1>
              <span className="tr-etiqueta">{b.tipo}</span>
              {!aberto && <Status status="aprovado" texto="Concluído" />}
            </div>
            <span className="tr-protocolo texto-suave">
              {b.protocolo} · {b.cliente.whatsapp} · prazo {dataLonga(b.prazo)}
              {b.lembrete && aberto && ' · lembrete automático a cada 3 dias'}
            </span>
          </div>
          <div className="linha">
            {aberto ? (
              <>
                <Link to={`/app/balcao/${b.id}/link`} className="tr-btn tr-btn--secundario tr-btn--sm">
                  Enviar o link de novo
                </Link>
                <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" onClick={lembrar}>
                  Lembrar {nome}
                </button>
                <button
                  type="button"
                  className="tr-btn tr-btn--primario tr-btn--sm"
                  disabled={!podeConcluir(b) || somenteConfere}
                  title={somenteConfere ? 'Sua permissão é só de conferir documentos' : podeConcluir(b) ? undefined : 'Disponível quando todos os documentos obrigatórios forem aprovados'}
                  onClick={() => {
                    acoes.concluirBalcao(b.id);
                    avisar('Balcão concluído. Ele não conta mais no limite do plano.');
                  }}
                >
                  Concluir balcão
                </button>
              </>
            ) : (
              <button
                type="button"
                className="tr-btn tr-btn--secundario tr-btn--sm"
                disabled={!podeAbrirBalcao(db, sessao)}
                title={podeAbrirBalcao(db, sessao) ? undefined : 'Você está no limite de balcões ativos do seu plano'}
                onClick={() => acoes.reabrirBalcao(b.id)}
              >
                Reabrir balcão
              </button>
            )}
          </div>
        </div>
        <div style={{ maxWidth: 520 }}>
          <Progresso feitos={c.aprovado} total={c.total} />
        </div>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <ul style={{ flex: '1 1 340px', minWidth: 0, listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {b.docs.map((d) => {
            const ativo = d.id === sel.id;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelId(d.id);
                    setRecusando(false);
                  }}
                  aria-current={ativo}
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: ativo ? '13px 15px' : '14px 16px', borderRadius: 12, border: ativo ? '2px solid var(--mangue)' : '1px solid var(--linha)', background: 'var(--areia-elevada)', color: 'var(--tinta)' }}
                >
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500 }}>{d.nome}</span>
                    <span className="miudo texto-suave">{d.arquivo ?? (d.obrigatorio ? 'Ainda não enviado' : 'Se tiver')}</span>
                  </span>
                  <Status status={d.status} />
                </button>
              </li>
            );
          })}
        </ul>

        <section className="cartao" style={{ flex: '999 1 520px', minWidth: 0, gap: 20 }} aria-label="Documento selecionado">
          <div className="linha linha--entre" style={{ alignItems: 'flex-start', gap: 12 }}>
            <div className="coluna" style={{ gap: 4 }}>
              <h2 className="titulo-2">{sel.nome}</h2>
              <span className="pequeno texto-suave">{sel.detalhe}</span>
            </div>
            <Status status={sel.status} />
          </div>

          {sel.arquivo ? (
            <div className="coluna" style={{ gap: 16 }}>
              <PreviaArquivo nome={sel.arquivo} />
              <div className="linha linha--entre pequeno texto-suave">
                <span className="tr-protocolo">{sel.arquivo}</span>
                {sel.enviadoEm && <span>{quandoEnviado(sel.enviadoEm)}, pelo celular</span>}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--areia-funda)', borderRadius: 12, padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <p className="texto-suave" style={{ maxWidth: 360 }}>
                {nome} ainda não enviou este documento. Se quiser, mandamos um lembrete agora.
              </p>
              {aberto && (
                <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" onClick={lembrar}>
                  Lembrar {nome}
                </button>
              )}
            </div>
          )}

          {aberto && sel.status === 'analise' && !recusando && (
            <div className="linha" style={{ gap: 10 }}>
              <button type="button" className="tr-btn tr-btn--primario" style={{ flex: '1 1 180px' }} onClick={() => acoes.aprovar(b.id, sel.id)}>
                <Icone nome="check" />
                Aprovar
              </button>
              <button
                type="button"
                className="tr-btn tr-btn--secundario"
                style={{ flex: '1 1 180px' }}
                onClick={() => {
                  setMotivo('');
                  setRecusando(true);
                }}
              >
                Recusar
              </button>
            </div>
          )}

          {recusando && (
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 12, background: 'var(--recusado-suave)' }}
              onSubmit={(e) => {
                e.preventDefault();
                acoes.recusar(b.id, sel.id, motivo.trim());
                setRecusando(false);
                avisar(`${nome} recebeu a sua mensagem e pode enviar outro arquivo pelo mesmo link.`);
              }}
            >
              <label className="coluna">
                <span className="miudo" style={{ fontWeight: 500 }}>
                  Diga a {nome} o que precisa mudar
                </span>
                <textarea className="entrada-texto" rows={3} required autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: a foto ficou escura na parte de baixo. Pode tirar outra com mais luz?" />
              </label>
              <div className="linha">
                <button type="submit" className="tr-btn tr-btn--primario tr-btn--sm">
                  Recusar e avisar {nome}
                </button>
                <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => setRecusando(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {sel.status === 'aprovado' && <p className="pequeno texto-suave">Você aprovou este documento. {nome} já vê o item como aprovado.</p>}
          {sel.status === 'recusado' && (
            <div className="tr-item__motivo" style={{ marginTop: 0 }}>
              Recusado: “{sel.motivo}” {nome} pode enviar outro arquivo pelo mesmo link.
            </div>
          )}
        </section>
      </div>
      {!aberto && (
        <button type="button" className="tr-btn tr-btn--discreto" style={{ alignSelf: 'flex-start' }} onClick={() => navegar('/app')}>
          Voltar para os balcões
        </button>
      )}
      {toast}
    </>
  );
}
