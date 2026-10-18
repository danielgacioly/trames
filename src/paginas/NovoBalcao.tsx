import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { dia } from '../dados/seed';
import { acoes, podeAbrirBalcao, tem, useDb, useSessao } from '../dados/store';
import type { ItemModelo } from '../dados/tipos';
import { Bloqueio, SeloConta } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { dataLonga, primeiroNome, soDigitos } from '../util';

type Item = ItemModelo & { chave: number };

let chaves = 0;
const comChave = (itens: ItemModelo[]): Item[] => itens.map((it) => ({ ...it, chave: ++chaves }));

/** Lista editável de documentos, usada no balcão novo e no editor de modelos. */
export function ListaDocumentos({ itens, mudar }: { itens: Item[]; mudar: (itens: Item[]) => void }) {
  const editar = (chave: number, dados: Partial<Item>) => mudar(itens.map((x) => (x.chave === chave ? { ...x, ...dados } : x)));
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {itens.map((d, k) => (
        <li key={d.chave} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 12px 12px 14px', border: '1px solid var(--linha)', borderRadius: 12, background: 'var(--areia)' }}>
          <span className="miudo texto-suave" style={{ width: 18, paddingTop: 9, flex: 'none' }}>
            {k + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              aria-label={`Nome do documento ${k + 1}`}
              value={d.nome}
              onChange={(e) => editar(d.chave, { nome: e.target.value })}
              style={{ font: 'inherit', fontSize: 16, fontWeight: 500, border: '1px solid transparent', borderRadius: 8, background: 'transparent', padding: '4px 6px', color: 'var(--tinta)' }}
            />
            <input
              aria-label={`Explicação do documento ${k + 1}`}
              value={d.detalhe}
              placeholder="Diga ao cliente o que serve neste item."
              onChange={(e) => editar(d.chave, { detalhe: e.target.value })}
              style={{ font: 'inherit', fontSize: 14, border: '1px solid transparent', borderRadius: 8, background: 'transparent', padding: '2px 6px', color: 'var(--tinta-suave)' }}
            />
          </div>
          <button
            type="button"
            onClick={() => editar(d.chave, { obrigatorio: !d.obrigatorio })}
            aria-pressed={d.obrigatorio}
            style={{
              fontSize: 13,
              height: 32,
              padding: '0 12px',
              borderRadius: 9999,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginTop: 2,
              ...(d.obrigatorio
                ? { border: '1px solid var(--mangue)', background: 'var(--mangue-suave)', color: 'var(--mangue)' }
                : { border: '1px solid var(--linha-forte)', background: 'var(--areia-elevada)', color: 'var(--tinta-suave)' }),
            }}
          >
            {d.obrigatorio ? 'Obrigatório' : 'Se tiver'}
          </button>
          <button
            type="button"
            onClick={() => mudar(itens.filter((x) => x.chave !== d.chave))}
            aria-label={`Remover ${d.nome}`}
            style={{ width: 32, height: 32, marginTop: 2, flex: 'none', display: 'grid', placeItems: 'center', border: 0, borderRadius: 8, background: 'transparent', color: 'var(--tinta-suave)', cursor: 'pointer' }}
          >
            <Icone nome="xis" tamanho={18} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function novoItem(): Item {
  return { chave: ++chaves, nome: 'Novo documento', detalhe: '', obrigatorio: true };
}

export { comChave, type Item };

export function NovoBalcao() {
  const db = useDb();
  const sessao = useSessao()!;
  const navegar = useNavigate();
  const local = useLocation();
  const [params] = useSearchParams();
  const vindoDoTuru = local.state as { itens?: ItemModelo[]; tipo?: string } | null;
  const modelo = db.modelos.find((m) => m.id === params.get('modelo'));

  const [tipo, setTipo] = useState(vindoDoTuru?.tipo ?? modelo?.nome ?? '');
  const [itens, setItens] = useState<Item[]>(() => comChave(vindoDoTuru?.itens ?? modelo?.itens ?? []));
  const [cliente, setCliente] = useState({ nome: '', cpf: '', whatsapp: '', email: '' });
  const [prazo, setPrazo] = useState(dia(21));
  const [lembrete, setLembrete] = useState(tem(sessao, 'lembretes'));
  const [erro, setErro] = useState('');

  const soConfere = tem(sessao, 'permissoes') && sessao.usuario.permissao === 'confere';
  const podeAbrir = podeAbrirBalcao(db, sessao) && !soConfere;
  const podeLembrar = tem(sessao, 'lembretes');
  const nomeCliente = primeiroNome(cliente.nome) || 'cliente';
  const campo = (k: keyof typeof cliente) => ({ value: cliente[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCliente({ ...cliente, [k]: e.target.value }) });

  function criar(e: FormEvent) {
    e.preventDefault();
    if (!podeAbrir) return;
    if (!itens.length) return setErro('Inclua pelo menos um documento.');
    if (soDigitos(cliente.whatsapp).length < 10) return setErro('Confira o WhatsApp do cliente, com DDD.');
    const b = acoes.criarBalcao({
      contaId: sessao.conta.id,
      tipo: tipo.trim() || 'Balcão',
      cliente: { ...cliente, nome: cliente.nome.trim() },
      prazo,
      lembrete: podeLembrar && lembrete,
      itens: itens.map(({ chave: _, ...it }) => it),
    });
    navegar(`/app/balcao/${b.id}/link`);
  }

  return (
    <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header className="linha linha--entre" style={{ gap: 16 }}>
        <div className="linha" style={{ gap: 16, minWidth: 0 }}>
          <Link to="/app" className="tr-btn tr-btn--discreto tr-btn--sm">
            <Icone nome="voltar" />
            Balcões
          </Link>
          <span style={{ width: 1, height: 24, background: 'var(--linha)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>Novo balcão</span>
          {modelo && <span className="tr-etiqueta">Modelo: {modelo.nome}</span>}
          {vindoDoTuru && <span className="tr-etiqueta">Lista do Turu</span>}
        </div>
        <button type="submit" className="tr-btn tr-btn--primario" disabled={!podeAbrir}>
          Criar balcão e gerar link
        </button>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {soConfere && (
            <div className="aviso">
              <Icone nome="info" />
              <span>Sua permissão nesta conta é só de conferir documentos. Peça a quem administra a conta para mudar, na tela Equipe.</span>
            </div>
          )}
          {!podeAbrirBalcao(db, sessao) && (
            <div className="aviso aviso--plano">
              <Icone nome="cadeado" />
              <span>
                O plano {sessao.plano.nome} permite {sessao.plano.limiteBalcoes} balcões ativos e você já está usando todos. Conclua um balcão que já terminou ou{' '}
                <Link to="/planos">mude de plano</Link> para abrir um novo.
              </span>
            </div>
          )}
          {erro && (
            <div className="aviso aviso--erro" role="alert">
              <Icone nome="info" />
              {erro}
            </div>
          )}

          <section className="cartao" style={{ gap: 20 }}>
            <div className="coluna" style={{ gap: 4 }}>
              <h2 className="titulo-2">Para quem é</h2>
              <p className="pequeno texto-suave">O cliente não precisa criar conta. Com esses dados ele recebe o link e o código de acesso.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16 }}>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">Nome completo</span>
                <input className="tr-campo__entrada" required {...campo('nome')} />
              </label>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">CPF</span>
                <input className="tr-campo__entrada" inputMode="numeric" placeholder="000.000.000-00" {...campo('cpf')} />
              </label>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">WhatsApp</span>
                <input className="tr-campo__entrada" inputMode="tel" required placeholder="(81) 90000-0000" {...campo('whatsapp')} />
              </label>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">E-mail</span>
                <input className="tr-campo__entrada" type="email" {...campo('email')} />
              </label>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">Tipo de caso</span>
                <input className="tr-campo__entrada" placeholder="Ex.: Inventário" value={tipo} onChange={(e) => setTipo(e.target.value)} />
                <span className="tr-campo__dica">Aparece como etiqueta no painel.</span>
              </label>
            </div>
          </section>

          <section className="cartao">
            <div className="linha linha--entre" style={{ alignItems: 'flex-end', gap: 12 }}>
              <div className="coluna" style={{ gap: 4 }}>
                <h2 className="titulo-2">Documentos</h2>
                <p className="pequeno texto-suave">Escreva o que serve em cada item como você explicaria ao cliente.</p>
              </div>
              <span className="pequeno texto-suave">{itens.length} documentos</span>
            </div>
            {itens.length === 0 && (
              <p className="pequeno texto-suave">
                Nenhum documento ainda. Adicione um por um ou <Link to="/app/modelos">comece por um modelo</Link>.
              </p>
            )}
            <ListaDocumentos itens={itens} mudar={setItens} />
            <div className="linha">
              <button type="button" className="tr-btn tr-btn--secundario" onClick={() => setItens([...itens, novoItem()])}>
                <Icone nome="mais" />
                Adicionar documento
              </button>
              {tem(sessao, 'turu') && (
                <Link to="/app/turu" className="tr-btn tr-btn--discreto">
                  <img src="/marca/turu.svg" alt="" style={{ width: 20, height: 20, borderRadius: 6 }} />
                  Pedir sugestões ao Turu
                </Link>
              )}
            </div>
          </section>

          <section className="cartao" style={{ gap: 20 }}>
            <h2 className="titulo-2">Prazo e lembretes</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16, alignItems: 'end' }}>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">Prazo para o cliente</span>
                <input className="tr-campo__entrada" type="date" required value={prazo} min={dia(0)} onChange={(e) => setPrazo(e.target.value)} />
              </label>
              <label className="linha" style={{ height: 44, fontSize: 15, cursor: podeLembrar ? 'pointer' : 'not-allowed', color: podeLembrar ? 'var(--tinta)' : 'var(--tinta-suave)' }}>
                <input type="checkbox" checked={podeLembrar && lembrete} disabled={!podeLembrar} onChange={(e) => setLembrete(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#13594b' }} />
                Lembrar {nomeCliente === 'cliente' ? 'o cliente' : nomeCliente} a cada 3 dias pelo WhatsApp
              </label>
            </div>
            {!podeLembrar && <Bloqueio recurso="lembretes" compacto />}
          </section>
        </div>

        <aside style={{ flex: '1 1 320px', minWidth: 0, maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 24 }}>
          <span className="miudo texto-suave" style={{ fontWeight: 500 }}>
            Assim {nomeCliente === 'cliente' ? 'o cliente' : nomeCliente} vai ver
          </span>
          <div style={{ borderRadius: 36, background: 'var(--lama)', padding: 10 }}>
            <div style={{ borderRadius: 28, background: 'var(--areia)', padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="linha miudo texto-suave">
                {tem(sessao, 'marca') && <SeloConta conta={sessao.conta} tamanho={24} />}
                {sessao.conta.nome}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: '26px', fontWeight: 600 }}>Olá, {primeiroNome(cliente.nome) || '[nome]'}</div>
              <p className="miudo texto-suave" style={{ lineHeight: '19px' }}>
                O escritório está reunindo os documentos{tipo ? ` de ${tipo.toLowerCase()}` : ''} e pediu {itens.length} itens até {dataLonga(prazo)}.
              </p>
              <div className="coluna" style={{ gap: 6 }}>
                {itens.map((d) => (
                  <div key={d.chave} className="linha linha--entre miudo" style={{ background: 'var(--areia-elevada)', border: '1px solid var(--linha)', borderRadius: 10, padding: '9px 12px', flexWrap: 'nowrap' }}>
                    <span>{d.nome}</span>
                    <span style={{ color: 'var(--mangue)', fontWeight: 500 }}>Enviar</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}

export function LinkBalcao() {
  const { id } = useParams();
  const db = useDb();
  const sessao = useSessao()!;
  const b = db.balcoes.find((x) => x.id === id && x.contaId === sessao.conta.id);
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/b/${b?.codigo}`;
  const nome = b ? primeiroNome(b.cliente.nome) : '';
  const [mensagem, setMensagem] = useState(
    b
      ? `Olá, ${nome}. Aqui é ${primeiroNome(sessao.usuario.nome)}, do ${sessao.conta.nome}. Abrimos um balcão para reunir os documentos${b.tipo ? ` de ${b.tipo.toLowerCase()}` : ''} (protocolo ${b.protocolo}). Por este link você vê a lista e envia tudo pelo celular: ${link}`
      : '',
  );
  if (!b) return <p>Balcão não encontrado.</p>;

  const whats = `https://wa.me/55${soDigitos(b.cliente.whatsapp)}?text=${encodeURIComponent(mensagem)}`;
  const email = `mailto:${b.cliente.email}?subject=${encodeURIComponent(`Documentos · ${sessao.conta.nome}`)}&body=${encodeURIComponent(mensagem)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link to="/app" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start' }}>
        <Icone nome="voltar" />
        Balcões
      </Link>
      <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', background: 'var(--areia-elevada)', border: '1px solid var(--linha)', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', gap: 28, boxShadow: 'var(--shadow-lg)' }}>
        <div className="coluna" style={{ gap: 14 }}>
          <span style={{ width: 52, height: 52, borderRadius: 9999, background: 'var(--mangue-suave)', color: 'var(--mangue)', display: 'grid', placeItems: 'center' }}>
            <Icone nome="check" tamanho={26} />
          </span>
          <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>Balcão criado</h1>
          <p className="subtitulo">
            Agora é só mandar o link para {nome}. Quando abrir, vamos pedir um código que chega no WhatsApp {b.cliente.whatsapp ? `terminado em ${soDigitos(b.cliente.whatsapp).slice(-4)}` : ''}.
          </p>
        </div>
        <div className="coluna">
          <span className="miudo" style={{ fontWeight: 500 }}>
            Link do balcão
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', border: '1px solid var(--linha-forte)', borderRadius: 12 }}>
            <span className="tr-protocolo" style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {link.replace(/^https?:\/\//, '')}
            </span>
            <button
              type="button"
              className="tr-btn tr-btn--secundario tr-btn--sm"
              style={copiado ? { color: 'var(--mangue)' } : undefined}
              onClick={() => {
                navigator.clipboard?.writeText(link).catch(() => {});
                setCopiado(true);
              }}
            >
              <Icone nome={copiado ? 'check' : 'copiar'} />
              {copiado ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
          <span className="tr-protocolo texto-suave">Protocolo {b.protocolo}</span>
        </div>
        <label className="coluna">
          <span className="miudo" style={{ fontWeight: 500 }}>
            Mensagem que vai junto
          </span>
          <textarea className="entrada-texto" rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)} style={{ background: 'var(--areia)' }} />
        </label>
        <div className="linha" style={{ gap: 10 }}>
          <a href={whats} target="_blank" rel="noreferrer" className="tr-btn tr-btn--primario" style={{ flex: '1 1 200px' }}>
            Enviar pelo WhatsApp
          </a>
          <a href={email} className="tr-btn tr-btn--secundario" style={{ flex: '1 1 200px' }}>
            Enviar por e-mail
          </a>
        </div>
        <div className="linha linha--entre pequeno" style={{ gap: 12, paddingTop: 16, borderTop: '1px solid var(--linha)' }}>
          <Link to={`/app/balcao/${b.id}`}>Abrir o balcão de {nome}</Link>
          <a href={`/b/${b.codigo}`} target="_blank" rel="noreferrer" style={{ color: 'var(--tinta-suave)' }}>
            Ver como o cliente (abre em outra aba)
          </a>
        </div>
      </div>
    </div>
  );
}
