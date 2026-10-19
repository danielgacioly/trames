import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ItemEntrada, TuruResposta } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useSessao } from '../../dados/consultas';
import { AvisoErro, Botao, Icone, Pagina, Secao, useNotificar } from '../../ui';
import { plural, primeiroNome } from '../../util/formatos';

/**
 * O Turu roda na API (Claude). Ele recebe só o texto da conversa e a lista atual,
 * nunca documentos nem dados do cliente.
 */
interface Mensagem {
  de: 'turu' | 'eu';
  texto: string;
}

export function Turu() {
  const s = useSessao();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const [mensagens, setMensagens] = useState<Mensagem[]>([{ de: 'turu', texto: `Oi, ${primeiroNome(s.usuario.nome)}. Me conte o caso como contaria a um colega e eu monto a lista de documentos. Depois você revisa tudo.` }]);
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<ItemEntrada[] | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const perguntar = useAcao((corpo: unknown) => api<TuruResposta>('POST', '/turu', corpo));
  const salvarModelo = useAcao((corpo: unknown) => api('POST', '/modelos', corpo), [chaves.modelos]);
  const pensando = perguntar.isPending;
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
    <Pagina titulo="Turu" subtitulo="Conte o caso e o Turu monta a lista de documentos. Não precisa de nome, CPF nem outros dados do cliente.">
      <div className="conferir" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)' }}>
        <section className="visualizacao" aria-label="Conversa com o Turu">
          <div className="conversa">
            {mensagens.map((m, k) => (
              <p key={k} className={`balao balao--${m.de}`}>
                {m.texto}
              </p>
            ))}
            {pensando && <p className="pequeno terciario">O Turu está montando a lista…</p>}
            <AvisoErro erro={perguntar.error} />
            <div ref={fim} />
          </div>
          <form onSubmit={enviar} className="visualizacao__rodape" style={{ flexWrap: 'nowrap' }}>
            <input
              className="entrada"
              aria-label="Mensagem para o Turu"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={lista ? 'Peça um ajuste: “deixa a certidão de casamento como se tiver”' : 'Ex.: inventário, viúva, três filhos, um mora em Portugal'}
            />
            <Botao type="submit" variante="primario" aria-label="Enviar" disabled={pensando || !texto.trim()}>
              <Icone nome="seta" />
            </Botao>
          </form>
        </section>

        <Secao titulo="Lista sugerida" acao={lista && <span className="pequeno terciario">{plural(lista.length, 'item', 'itens')}</span>}>
          {lista ? (
            <>
              {lista.map((it) => (
                <div key={it.nome} className="linha">
                  <span className="linha__corpo">{it.nome}</span>
                  {!it.obrigatorio && <span className="pequeno terciario">se tiver</span>}
                </div>
              ))}
              <div className="linha pilha" style={{ alignItems: 'stretch' }}>
                <Botao variante="primario" bloco onClick={() => navegar('/app/novo', { state: { itens: lista, tipo } })}>
                  Abrir balcão com esta lista
                </Botao>
                <Botao
                  bloco
                  disabled={salvarModelo.isPending}
                  onClick={async () => {
                    await salvarModelo.mutateAsync({ nome: tipo ? `${tipo} (Turu)` : 'Modelo do Turu', quando: 'Montado com o Turu.', itens: lista });
                    notificar({ titulo: 'Modelo salvo', texto: 'Está em Modelos › Meus modelos.' });
                  }}
                >
                  Salvar como modelo
                </Botao>
              </div>
            </>
          ) : (
            <p className="grupo--vazio pequeno">A lista aparece aqui assim que você contar o caso.</p>
          )}
        </Secao>
      </div>
    </Pagina>
  );
}
