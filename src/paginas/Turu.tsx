import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { acoes, modelosPadrao, tem, useDb, useSessao } from '../dados/store';
import type { ItemModelo, Modelo } from '../dados/tipos';
import { Bloqueio, useToast } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { primeiroNome } from '../util';

/**
 * O Turu deste protótipo é simulado: escolhe o modelo mais parecido com o caso
 * pelas palavras da mensagem e aplica alguns ajustes comuns. Não há IA de verdade.
 */
const PALAVRAS: Record<string, string[]> = {
  'adv-inventario': ['inventário', 'inventario', 'faleceu', 'falecid', 'herdeir', 'herança', 'viúv', 'óbito'],
  'adv-aposentadoria': ['aposentad', 'inss', 'benefício', 'previdenci'],
  'adv-divorcio': ['divórcio', 'divorcio', 'separação', 'casal'],
  'adv-trabalhista': ['trabalhista', 'demitid', 'rescisão', 'patrão', 'horas extras'],
  'adv-imovel': ['compra', 'venda', 'escritura'],
  'adv-pensao': ['pensão', 'alimentos'],
  'cont-irpf': ['imposto de renda', 'irpf', 'declaração', 'restituição'],
  'cont-abertura': ['abrir empresa', 'abertura', 'cnpj', 'mei'],
  'cont-mensal': ['mensal', 'fechamento', 'simples nacional'],
  'cont-admissao': ['admissão', 'contratar', 'funcionário novo', 'registrar funcionário'],
  'sau-preop': ['cirurgia', 'operação', 'pré-operatório'],
  'sau-consulta': ['consulta', 'primeira vez'],
  'sau-reembolso': ['reembolso'],
};

const EXTRAS: { palavras: string[]; item: ItemModelo; jaCoberto?: string }[] = [
  { palavras: ['portugal', 'exterior', 'fora do brasil', 'estados unidos', 'mora fora'], item: { nome: 'Procuração com apostila de Haia', detalhe: 'Só para quem mora fora do Brasil. Feita no consulado ou em cartório local, com apostila.', obrigatorio: true } },
  { palavras: ['carro', 'moto', 'veículo'], item: { nome: 'Documento do carro (CRLV)', detalhe: 'O documento mais recente, em PDF ou foto.', obrigatorio: true } },
  { palavras: ['apartamento', 'casa', 'imóvel', 'terreno'], item: { nome: 'Matrícula atualizada do imóvel', detalhe: 'Pedida no cartório de registro de imóveis, emitida há menos de 30 dias.', obrigatorio: true } },
  { palavras: ['filhos', 'filho', 'filha'], jaCoberto: 'herdeir', item: { nome: 'RG e CPF de cada filho', detalhe: 'Um documento com foto de cada um.', obrigatorio: true } },
  { palavras: ['empresa', 'sócio'], item: { nome: 'Contrato social', detalhe: 'A última alteração registrada na junta comercial.', obrigatorio: true } },
];

const BASICOS: ItemModelo[] = [
  { nome: 'RG ou CNH', detalhe: 'Frente e verso, ou a CNH digital em PDF.', obrigatorio: true },
  { nome: 'CPF', detalhe: 'Pode ser o cartão ou um print do app da Receita.', obrigatorio: true },
  { nome: 'Comprovante de residência', detalhe: 'Conta de luz, água ou internet dos últimos 90 dias.', obrigatorio: true },
];

interface Mensagem {
  de: 'turu' | 'eu';
  texto: string;
}

function normal(s: string) {
  return s.toLowerCase();
}

function escolherModelo(texto: string, modelos: Modelo[]) {
  const t = normal(texto);
  let melhor: Modelo | undefined;
  let pontos = 0;
  for (const m of modelos) {
    const p = (PALAVRAS[m.id] ?? []).filter((w) => t.includes(w)).length;
    if (p > pontos) {
      melhor = m;
      pontos = p;
    }
  }
  return melhor;
}

/** Acha itens da lista citados na mensagem ("a certidão de casamento" → "Certidão de casamento"). */
function itensCitados(texto: string, lista: ItemModelo[]) {
  const t = normal(texto);
  return lista.filter((it) => {
    const palavras = normal(it.nome).split(/\s+/).filter((w) => w.length > 3);
    return palavras.length > 0 && palavras.filter((w) => t.includes(w)).length >= Math.min(2, palavras.length);
  });
}

function responder(texto: string, lista: ItemModelo[] | null, modelos: Modelo[]): { resposta: string; lista: ItemModelo[]; tipo?: string } {
  const t = normal(texto);
  if (!lista) {
    const m = escolherModelo(texto, modelos);
    let itens = [...(m?.itens ?? BASICOS)];
    const acrescentados: string[] = [];
    for (const e of EXTRAS) {
      const jaTem = itens.some((it) => normal(it.nome) === normal(e.item.nome) || (e.jaCoberto && normal(it.nome).includes(e.jaCoberto)));
      if (e.palavras.some((w) => t.includes(w)) && !jaTem) {
        itens = [...itens, e.item];
        acrescentados.push(e.item.nome);
      }
    }
    const base = m ? `Montei uma lista com ${itens.length} documentos a partir do modelo de ${m.nome.toLowerCase()}.` : `Não reconheci um modelo parecido, então comecei por ${itens.length} documentos básicos.`;
    const extra = acrescentados.length ? ` Pelo que você contou, incluí também: ${acrescentados.join(', ')}.` : '';
    return {
      resposta: `${base}${extra} Quer que eu marque algum como "se tiver", tire ou acrescente algum item?`,
      lista: itens,
      tipo: m?.nome,
    };
  }

  const citados = itensCitados(texto, lista);
  if (/(tira|remove|exclui|sem )/.test(t) && citados.length) {
    return { resposta: `Pronto, tirei ${citados.map((c) => c.nome.toLowerCase()).join(' e ')}. A lista está ao lado.`, lista: lista.filter((it) => !citados.includes(it)) };
  }
  if (/(se tiver|opcional|não é obrigat)/.test(t) && citados.length) {
    return {
      resposta: `Marquei ${citados.map((c) => c.nome.toLowerCase()).join(' e ')} como "se tiver".`,
      lista: lista.map((it) => (citados.includes(it) ? { ...it, obrigatorio: false } : it)),
    };
  }
  const pedido = texto.match(/(?:acrescenta|inclui|adiciona|coloca)\s+(?:também\s+)?(?:o |a |os |as |um |uma )?(.+)/i);
  if (pedido) {
    const nome = pedido[1].replace(/[.!?]+$/, '').trim();
    const item = { nome: nome[0].toUpperCase() + nome.slice(1), detalhe: '', obrigatorio: true };
    return { resposta: `Acrescentei "${item.nome}". Vale escrever ao lado uma explicação curta para o cliente.`, lista: [...lista, item] };
  }
  if (/(simples|explica|explicaç)/.test(t)) {
    return { resposta: 'Reescrevi as explicações num tom mais direto, como você falaria com o cliente. Confira ao lado.', lista };
  }
  return { resposta: 'Anotei. Se quiser, me diga quais itens tirar, quais deixar como "se tiver" ou o que acrescentar.', lista };
}

export function Turu() {
  const db = useDb();
  const sessao = useSessao()!;
  const navegar = useNavigate();
  const nome = primeiroNome(sessao.usuario.nome);
  const [mensagens, setMensagens] = useState<Mensagem[]>([{ de: 'turu', texto: `Oi, ${nome}. Me conte o caso como contaria a um colega e eu monto a lista de documentos. Depois você revisa tudo.` }]);
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<ItemModelo[] | null>(null);
  const [tipo, setTipo] = useState<string | undefined>();
  const [pensando, setPensando] = useState(false);
  const [toast, avisar] = useToast();
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => fim.current?.scrollIntoView({ block: 'nearest' }), [mensagens, pensando]);

  if (!tem(sessao, 'turu')) {
    return (
      <>
        <h1 className="titulo-1">Turu</h1>
        <Bloqueio recurso="turu" />
      </>
    );
  }

  const modelos = [...modelosPadrao(db, sessao.conta.area), ...modelosPadrao(db).filter((m) => m.area !== sessao.conta.area)];

  function enviar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || pensando) return;
    setMensagens((m) => [...m, { de: 'eu', texto: t }]);
    setTexto('');
    setPensando(true);
    setTimeout(() => {
      const r = responder(t, lista, modelos);
      setLista(r.lista);
      if (r.tipo) setTipo(r.tipo);
      setMensagens((m) => [...m, { de: 'turu', texto: r.resposta }]);
      setPensando(false);
    }, 700);
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
            O Turu sugere, você decide. Confira a lista antes de mandar para o cliente.
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
                onClick={() => {
                  const primeira = mensagens.find((m) => m.de === 'eu')?.texto ?? '';
                  acoes.salvarModelo({
                    contaId: sessao.conta.id,
                    area: sessao.conta.area,
                    nome: tipo ? `${tipo} (Turu)` : 'Modelo do Turu',
                    quando: `Criado com o Turu: “${primeira.slice(0, 90)}${primeira.length > 90 ? '…' : ''}”`,
                    itens: lista,
                  });
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
