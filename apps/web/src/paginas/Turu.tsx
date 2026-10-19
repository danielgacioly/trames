import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ItemEntrada as ItemModelo, TuruResposta } from '@trames/shared';
import { api } from '../dados/api';
import { chaves, useAcao, useSessao } from '../dados/consultas';
import { AvisoErro, useToast } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { primeiroNome } from '../util';

/**
 * O Turu roda na API (Claude). Ele recebe só o texto da conversa e a lista atual,
 * nunca documentos nem dados do cliente.
 */
interface Mensagem {
  de: 'turu' | 'eu';
  texto: string;
}

export function Turu() {
  const sessao = useSessao();
  const navegar = useNavigate();
  const nome = primeiroNome(sessao.usuario.nome);
  const [mensagens, setMensagens] = useState<Mensagem[]>([{ de: 'turu', texto: `Oi, ${nome}. Me conte o caso como contaria a um colega e eu monto a lista de documentos. Depois você revisa tudo.` }]);
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<ItemModelo[] | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const perguntar = useAcao((corpo: unknown) => api<TuruResposta>('POST', '/turu', corpo));
  const pensando = perguntar.isPending;
  const salvarModelo = useAcao((corpo: unknown) => api('POST', '/modelos', corpo), [chaves.modelos]);
  const [toast, avisar] = useToast();
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' });
  }, [mensagens, pensando]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || pensando) return;
    const conversa: Mensagem[] = [...mensagens, { de: 'eu', texto: t }];
    setMensagens(conversa);
    setTexto('');
    try {
      const r = await perguntar.mutateAsync({ mensagens: conversa.slice(-30), lista });
      if (r.lista) setLista(r.lista);
      if (r.tipo) setTipo(r.tipo);
      setMensagens((m) => [...m, { de: 'turu', texto: r.resposta }]);
    } catch {
      setMensagens((m) => m.slice(0, -1));
      setTexto(t);
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
      <section className="cartao" style={{ flex: '999 1 460px', minWidth: 0, padding: 0, gap: 0, borderRadius: 20 }} aria-label="Conversa com o Turu">
        <div className="linha" style={{ gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--linha)' }}>
          <img src="/marca/turu.svg" alt="" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <div className="coluna" style={{ gap: 0 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: '22px', fontWeight: 600 }}>Turu</span>
            <span className="miudo texto-suave">Monta listas de documentos a partir do seu caso</span>
          </div>
        </div>
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 360, maxHeight: '60vh', overflowY: 'auto' }}>
          {mensagens.map((m, k) => (
            <div
              key={k}
              style={{
                maxWidth: '82%',
                alignSelf: m.de === 'eu' ? 'flex-end' : 'flex-start',
                background: m.de === 'eu' ? 'var(--mangue-suave)' : 'var(--areia-funda)',
                borderRadius: m.de === 'eu' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '12px 16px',
                fontSize: 15,
                lineHeight: '23px',
              }}
            >
              {m.texto}
            </div>
          ))}
          {pensando && <div className="texto-suave pequeno">O Turu está montando a lista…</div>}
          <AvisoErro erro={perguntar.error} />
          <div ref={fim} />
        </div>
        <form onSubmit={enviar} style={{ padding: '16px 22px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="linha" style={{ flexWrap: 'nowrap', border: '1px solid var(--linha-forte)', borderRadius: 14, padding: '6px 6px 6px 16px' }}>
            <label style={{ flex: 1, minWidth: 0 }}>
              <span className="sr-only">Mensagem para o Turu</span>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={lista ? 'Peça um ajuste: "deixa a certidão de casamento como se tiver"' : 'Ex.: inventário de uma senhora viúva, três filhos, um mora em Portugal. Deixou um apartamento e um carro.'}
                style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', font: 'inherit', fontSize: 15, color: 'var(--tinta)' }}
              />
            </label>
            <button type="submit" className="tr-btn tr-btn--primario tr-btn--sm" aria-label="Enviar mensagem" disabled={pensando || !texto.trim()}>
              <Icone nome="seta" />
            </button>
          </div>
          <span className="texto-suave" style={{ fontSize: 12, lineHeight: '16px' }}>
            O Turu sugere, você decide. Não precisa escrever nome, CPF nem outros dados do cliente: conte só o caso.
          </span>
        </form>
      </section>

      <section className="cartao" style={{ flex: '1 1 340px', minWidth: 0, borderRadius: 20, padding: 22, gap: 18 }} aria-label="Lista sugerida">
        <div className="linha linha--entre" style={{ alignItems: 'baseline' }}>
          <h2 className="titulo-cartao">Lista sugerida</h2>
          {lista && <span className="miudo texto-suave">{lista.length} documentos</span>}
        </div>
        {lista ? (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lista.map((it) => (
                <li key={it.nome} style={{ fontSize: 15, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  {it.nome}
                  {!it.obrigatorio && <span className="texto-suave" style={{ fontSize: 12 }}>se tiver</span>}
                </li>
              ))}
            </ul>
            <div className="coluna" style={{ paddingTop: 12, borderTop: '1px solid var(--linha)' }}>
              <button type="button" className="tr-btn tr-btn--primario tr-btn--bloco" onClick={() => navegar('/app/novo', { state: { itens: lista, tipo } })}>
                Abrir balcão com esta lista
              </button>
              <button
                type="button"
                className="tr-btn tr-btn--secundario tr-btn--bloco"
                disabled={salvarModelo.isPending}
                onClick={async () => {
                  await salvarModelo.mutateAsync({ nome: tipo ? `${tipo} (Turu)` : 'Modelo do Turu', quando: 'Montado com o Turu.', itens: lista });
                  avisar('Modelo salvo em Meus modelos.');
                }}
              >
                Salvar como modelo
              </button>
            </div>
          </>
        ) : (
          <p className="pequeno texto-suave">A lista aparece aqui assim que você contar o caso.</p>
        )}
      </section>
      {toast}
    </div>
  );
}
