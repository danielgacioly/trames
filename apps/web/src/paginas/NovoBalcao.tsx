import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PRECO_EXCEDENTE_CENTAVOS, type BalcaoDetalhe, type CanalCodigo, type ItemEntrada as ItemModelo, type LinkGerado, type StatusItem } from '@trames/shared';
import { api } from '../dados/api';
import { chaves as chavesConsulta, useAcao, useBalcao, useCobranca, useModelos, useSessao } from '../dados/consultas';
import { AvisoErro, Bloqueio, Carregando, SeloConta, Status } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { dataLonga, diaDaqui, primeiroNome, soDigitos } from '../util';

/** Item da lista em edição. id e status só existem nos itens que já estão no balcão. */
type Item = ItemModelo & { chave: number; id?: string; status?: StatusItem; temArquivo?: boolean; pedirDeNovo?: boolean };

let chaves = 0;
const comChave = (itens: ItemModelo[]): Item[] => itens.map((it) => ({ ...it, chave: ++chaves }));
const reais = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const botaoIcone = { width: 32, height: 32, flex: 'none', display: 'grid', placeItems: 'center', border: 0, borderRadius: 8, background: 'transparent', color: 'var(--tinta-suave)', cursor: 'pointer' } as const;

/**
 * Lista editável de documentos: a mesma no balcão novo, em "Editar lista" e no
 * editor de modelos. Arrastar (ou as setas) muda a ordem em que o cliente vê.
 */
export function ListaDocumentos({ itens, mudar, extra, remover }: { itens: Item[]; mudar: (itens: Item[]) => void; extra?: (d: Item) => ReactNode; remover?: (d: Item) => void }) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const editar = (chave: number, dados: Partial<Item>) => mudar(itens.map((x) => (x.chave === chave ? { ...x, ...dados } : x)));
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= itens.length || de === para) return;
    const nova = [...itens];
    const [x] = nova.splice(de, 1);
    nova.splice(para, 0, x);
    mudar(nova);
  };
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {itens.map((d, k) => (
        <li
          key={d.chave}
          draggable
          onDragStart={(e) => {
            setArrastando(k);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (arrastando !== null) mover(arrastando, k);
            setArrastando(null);
          }}
          onDragEnd={() => setArrastando(null)}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 12px 12px 6px', border: '1px solid var(--linha)', borderRadius: 12, background: 'var(--areia)', opacity: arrastando === k ? 0.5 : 1 }}
        >
          <div className="coluna" style={{ gap: 0, flex: 'none', alignItems: 'center' }}>
            <span title="Arraste para mudar a ordem" style={{ ...botaoIcone, cursor: 'grab', height: 20 }} aria-hidden="true">
              <Icone nome="alca" tamanho={18} />
            </span>
            <button type="button" style={{ ...botaoIcone, height: 24 }} aria-label={`Subir ${d.nome}`} disabled={k === 0} onClick={() => mover(k, k - 1)}>
              <Icone nome="cima" tamanho={16} />
            </button>
            <button type="button" style={{ ...botaoIcone, height: 24 }} aria-label={`Descer ${d.nome}`} disabled={k === itens.length - 1} onClick={() => mover(k, k + 1)}>
              <Icone nome="baixo" tamanho={16} />
            </button>
          </div>
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
            {extra?.(d)}
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
          <button type="button" onClick={() => (remover ? remover(d) : mudar(itens.filter((x) => x.chave !== d.chave)))} aria-label={`Remover ${d.nome}`} style={{ ...botaoIcone, marginTop: 2 }}>
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

/** Puxa os itens de um modelo para a lista (sem repetir o que já está nela). */
function PuxarModelo({ adicionar }: { adicionar: (itens: ItemModelo[]) => void }) {
  const modelos = useModelos();
  const [id, setId] = useState('');
  if (!modelos.data?.length) return null;
  return (
    <label className="linha" style={{ gap: 8 }}>
      <span className="sr-only">Puxar documentos de um modelo</span>
      <select className="tr-campo__entrada" style={{ height: 40, maxWidth: 260 }} value={id} onChange={(e) => setId(e.target.value)}>
        <option value="">Puxar de um modelo…</option>
        {modelos.data.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="tr-btn tr-btn--discreto"
        disabled={!id}
        onClick={() => {
          const m = modelos.data.find((x) => x.id === id);
          if (m) adicionar(m.itens);
          setId('');
        }}
      >
        Adicionar itens
      </button>
    </label>
  );
}

/** Carrega o modelo (se veio ?modelo=) antes de montar o formulário. */
export function NovoBalcao() {
  const [params] = useSearchParams();
  const local = useLocation();
  const modelos = useModelos();
  const idModelo = params.get('modelo');
  if (idModelo && modelos.isPending) return <Carregando />;
  const modelo = modelos.data?.find((m) => m.id === idModelo);
  const vindoDoTuru = local.state as { itens?: ItemModelo[]; tipo?: string } | null;
  return <FormularioBalcao key={idModelo ?? 'novo'} modelo={modelo} vindoDoTuru={vindoDoTuru} />;
}

function Canal({ valor, mudar, pode, rotulo }: { valor: CanalCodigo; mudar: (c: CanalCodigo) => void; pode: boolean; rotulo: string }) {
  return (
    <label className="tr-campo tr-campo--largo">
      <span className="tr-campo__rotulo">{rotulo}</span>
      <select className="tr-campo__entrada" value={pode ? valor : 'email'} disabled={!pode} onChange={(e) => mudar(e.target.value as CanalCodigo)}>
        <option value="email">E-mail</option>
        <option value="whatsapp">WhatsApp</option>
      </select>
    </label>
  );
}

function FormularioBalcao({ modelo, vindoDoTuru }: { modelo?: { nome: string; itens: ItemModelo[] }; vindoDoTuru: { itens?: ItemModelo[]; tipo?: string } | null }) {
  const sessao = useSessao();
  const navegar = useNavigate();
  const uso = useCobranca().data;
  const [tipo, setTipo] = useState(vindoDoTuru?.tipo ?? modelo?.nome ?? '');
  const [itens, setItens] = useState<Item[]>(() => comChave(vindoDoTuru?.itens ?? modelo?.itens ?? []));
  const [cliente, setCliente] = useState({ nome: '', cpf: '', whatsapp: '', email: '' });
  const [prazo, setPrazo] = useState(diaDaqui(21));
  const [canalCodigo, setCanalCodigo] = useState<CanalCodigo>('email');
  const [lembrete, setLembrete] = useState(true);
  const [canalLembrete, setCanalLembrete] = useState<CanalCodigo>('email');
  const [erro, setErro] = useState('');
  const criarBalcao = useAcao((corpo: unknown) => api<{ id: string; link: LinkGerado; excedente: boolean }>('POST', '/balcoes', corpo), [chavesConsulta.balcoes, chavesConsulta.cobranca, chavesConsulta.clientes]);

  const p = sessao.plano;
  const soConfere = sessao.tem('permissoes') && sessao.usuario.permissao === 'confere';
  const noLimite = p.limiteBalcoes !== null && (uso?.balcoesAtivos ?? 0) >= p.limiteBalcoes;
  const excedente = p.balcoesNoMes !== null && (uso?.balcoesNoMes ?? 0) >= p.balcoesNoMes;
  const podeAbrir = !noLimite && !soConfere;
  const comWhatsapp = sessao.tem('whatsapp');
  const nomeCliente = primeiroNome(cliente.nome) || 'cliente';
  const campo = (k: keyof typeof cliente) => ({ value: cliente[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCliente({ ...cliente, [k]: e.target.value }) });

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!podeAbrir) return;
    setErro('');
    if (!itens.length) return setErro('Inclua pelo menos um documento.');
    if (soDigitos(cliente.whatsapp).length < 10) return setErro('Confira o WhatsApp do cliente, com DDD.');
    if (!cliente.email.trim()) return setErro('Informe o e-mail do cliente: é por ele que vão o código de acesso, os lembretes e os avisos.');
    try {
      const b = await criarBalcao.mutateAsync({
        tipo: tipo.trim(),
        cliente: { ...cliente, nome: cliente.nome.trim(), email: cliente.email.trim() },
        prazo,
        canalCodigo: comWhatsapp ? canalCodigo : 'email',
        lembrete,
        canalLembrete: comWhatsapp ? canalLembrete : 'email',
        itens: itens.map(({ nome, detalhe, obrigatorio }) => ({ nome, detalhe, obrigatorio })),
      });
      navegar(`/app/balcao/${b.id}/link`, { state: { link: b.link, criado: true, excedente: b.excedente } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para criar o balcão.');
    }
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
        <button type="submit" className="tr-btn tr-btn--primario" disabled={!podeAbrir || criarBalcao.isPending}>
          {criarBalcao.isPending ? 'Criando…' : 'Criar balcão e gerar link'}
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
          {noLimite && (
            <div className="aviso aviso--plano">
              <Icone nome="cadeado" />
              <span>
                O plano {p.nome} permite {p.limiteBalcoes} balcões ativos e você já está usando todos. Conclua um balcão que já terminou ou <Link to="/planos">mude de plano</Link> para abrir um novo.
              </span>
            </div>
          )}
          {excedente && !soConfere && (
            <div className="aviso aviso--plano" role="status">
              <Icone nome="info" />
              <span>
                Este balcão será cobrado como excedente ({reais(PRECO_EXCEDENTE_CENTAVOS)}). A conta já criou {uso?.balcoesNoMes} balcões neste mês, e o plano {p.nome} inclui {p.balcoesNoMes}.
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
              <p className="pequeno texto-suave">O cliente não precisa criar conta. Ele recebe o link e, ao abrir, um código de acesso.</p>
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
                <span className="tr-campo__dica">Para você mandar o link pelo seu WhatsApp.</span>
              </label>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">E-mail</span>
                <input className="tr-campo__entrada" type="email" required {...campo('email')} />
                <span className="tr-campo__dica">Código de acesso, lembretes e avisos. Se o WhatsApp falhar ou a cota acabar, é por aqui que vão.</span>
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
                <p className="pequeno texto-suave">Escreva o que serve em cada item como você explicaria ao cliente. Arraste para mudar a ordem.</p>
              </div>
              <span className="pequeno texto-suave">{itens.length} documentos</span>
            </div>
            {itens.length === 0 && <p className="pequeno texto-suave">Nenhum documento ainda. Adicione um por um ou puxe de um modelo.</p>}
            <ListaDocumentos itens={itens} mudar={setItens} />
            <div className="linha">
              <button type="button" className="tr-btn tr-btn--secundario" onClick={() => setItens([...itens, novoItem()])}>
                <Icone nome="mais" />
                Adicionar documento
              </button>
              <PuxarModelo adicionar={(novos) => setItens([...itens, ...comChave(novos.filter((n) => !itens.some((i) => i.nome === n.nome)))])} />
            </div>
          </section>

          <section className="cartao" style={{ gap: 20 }}>
            <h2 className="titulo-2">Prazo, código e lembretes</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 16, alignItems: 'end' }}>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">Prazo para o cliente</span>
                <input className="tr-campo__entrada" type="date" required value={prazo} min={diaDaqui(0)} onChange={(e) => setPrazo(e.target.value)} />
              </label>
              <Canal rotulo="Código de acesso por" valor={canalCodigo} mudar={setCanalCodigo} pode={comWhatsapp} />
            </div>
            <label className="linha" style={{ fontSize: 15, cursor: 'pointer', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <input type="checkbox" checked={lembrete} onChange={(e) => setLembrete(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: '#13594b', flex: 'none' }} />
              <span>
                Lembrar {nomeCliente === 'cliente' ? 'o cliente' : nomeCliente} 3 dias antes do prazo, no dia e 2 dias depois
                <span className="miudo texto-suave" style={{ display: 'block' }}>
                  Só se ainda faltar documento obrigatório. O lembrete leva o mesmo link.
                </span>
              </span>
            </label>
            {lembrete && (
              <div style={{ maxWidth: 260 }}>
                <Canal rotulo="Lembretes por" valor={canalLembrete} mudar={setCanalLembrete} pode={comWhatsapp} />
              </div>
            )}
            {comWhatsapp ? (
              (canalCodigo === 'whatsapp' || (lembrete && canalLembrete === 'whatsapp')) && (
                <p className="miudo texto-suave">
                  Mensagens pelo WhatsApp contam na cota do plano ({p.cotaWhatsapp.toLocaleString('pt-BR')} por mês{uso ? `, ${uso.whatsappEnviados} usadas` : ''}). Se a cota acabar, vão por e-mail até o mês virar.
                </p>
              )
            ) : (
              <Bloqueio recurso="whatsapp" compacto />
            )}
          </section>
        </div>

        <aside style={{ flex: '1 1 320px', minWidth: 0, maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 24 }}>
          <span className="miudo texto-suave" style={{ fontWeight: 500 }}>
            Assim {nomeCliente === 'cliente' ? 'o cliente' : nomeCliente} vai ver
          </span>
          <div style={{ borderRadius: 36, background: 'var(--lama)', padding: 10 }}>
            <div style={{ borderRadius: 28, background: 'var(--areia)', padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="linha miudo texto-suave">
                {sessao.tem('marca') && <SeloConta conta={sessao.organizacao} tamanho={24} />}
                {sessao.organizacao.nome}
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

/* ---------- Link do balcão ---------- */

export function LinkBalcao() {
  const { id = '' } = useParams();
  const local = useLocation();
  const navegar = useNavigate();
  const sessao = useSessao();
  const consulta = useBalcao(id);
  const estado = local.state as { link?: LinkGerado; criado?: boolean; excedente?: boolean } | null;
  const [link, setLink] = useState<LinkGerado | null>(estado?.link ?? null);
  const [copiado, setCopiado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  // O banco guarda só o hash: um link antigo não pode ser mostrado de novo, então emite um para enviar.
  const emitir = useAcao(() => api<LinkGerado>('POST', `/balcoes/${id}/links`), [chavesConsulta.balcao(id), chavesConsulta.historico(id)]);
  const porEmail = useAcao((m: string) => api('POST', `/balcoes/${id}/enviar-link`, { mensagem: m, url: link!.url }), [chavesConsulta.historico(id)]);

  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  const b = consulta.data;
  const nome = primeiroNome(b.cliente.nome);
  const texto =
    mensagem ??
    `Olá, ${nome}. Aqui é ${primeiroNome(sessao.usuario.nome)}, do ${sessao.organizacao.nome}. Abrimos um balcão para reunir os documentos${b.tipo ? ` de ${b.tipo.toLowerCase()}` : ''} (protocolo ${b.protocolo}). Por este link você vê a lista e envia tudo pelo celular:`;
  const ondeCodigo = b.canalCodigo === 'whatsapp' ? `no WhatsApp terminado em ${b.cliente.whatsappFinal}` : `no e-mail ${b.cliente.email}`;

  /** Abre o WhatsApp do escritório com a mensagem pronta. A janela abre antes da resposta para o navegador não bloquear. */
  async function abrirWhatsapp() {
    setErro(null);
    const janela = window.open('', '_blank');
    try {
      const { url } = await api<{ url: string }>('POST', `/balcoes/${id}/whatsapp`, { mensagem: texto, url: link!.url });
      if (janela) janela.location.href = url;
      else window.location.href = url;
    } catch (e) {
      janela?.close();
      setErro(e);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link to="/app" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start' }}>
        <Icone nome="voltar" />
        Balcões
      </Link>
      <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', background: 'var(--areia-elevada)', border: '1px solid var(--linha)', borderRadius: 24, padding: 'clamp(20px, 5vw, 40px)', display: 'flex', flexDirection: 'column', gap: 28, boxShadow: 'var(--shadow-lg)' }}>
        <div className="coluna" style={{ gap: 14 }}>
          <span style={{ width: 52, height: 52, borderRadius: 9999, background: 'var(--mangue-suave)', color: 'var(--mangue)', display: 'grid', placeItems: 'center' }}>
            <Icone nome="check" tamanho={26} />
          </span>
          <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>{estado?.criado ? 'Balcão criado' : `Link do balcão de ${nome}`}</h1>
          <p className="subtitulo">
            Agora é só mandar o link para {nome}. Quando abrir, vamos pedir um código que chega {ondeCodigo}. Depois disso, o celular dele fica conectado por 30 dias.
          </p>
          {estado?.excedente && (
            <div className="aviso aviso--plano">
              <Icone nome="info" />
              <span>Este balcão passou dos {sessao.plano.balcoesNoMes} do mês e foi cobrado como excedente ({reais(PRECO_EXCEDENTE_CENTAVOS)}, na próxima fatura).</span>
            </div>
          )}
        </div>

        {link ? (
          <div className="coluna">
            <span className="miudo" style={{ fontWeight: 500 }}>
              Link do balcão
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', border: '1px solid var(--linha-forte)', borderRadius: 12 }}>
              <span className="tr-protocolo" style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {link.url.replace(/^https?:\/\//, '')}
              </span>
              <button
                type="button"
                className="tr-btn tr-btn--secundario tr-btn--sm"
                style={copiado ? { color: 'var(--mangue)' } : undefined}
                onClick={() => {
                  navigator.clipboard?.writeText(link.url).catch(() => {});
                  setCopiado(true);
                  api('POST', `/balcoes/${id}/registrar-envio`, { canal: 'copiado' }).catch(() => {});
                }}
              >
                <Icone nome={copiado ? 'check' : 'copiar'} />
                {copiado ? 'Copiado' : 'Copiar link'}
              </button>
            </div>
            <span className="miudo texto-suave">
              Protocolo <span className="tr-protocolo">{b.protocolo}</span> · vale até {dataLonga(link.expiraEm.slice(0, 10))}. Por segurança, guardamos só uma impressão digital do link: ele aparece só agora.
            </span>
          </div>
        ) : (
          <div className="aviso">
            <Icone nome="cadeado" />
            <span>
              Por segurança, a Trames não guarda os links, só uma impressão digital deles: um link já enviado não aparece de novo. Gere um link para mandar agora. Os que você já mandou continuam valendo, e {nome} continua conectado.
            </span>
          </div>
        )}

        {link && (
          <label className="coluna">
            <span className="miudo" style={{ fontWeight: 500 }}>
              Mensagem que vai junto (o link entra no fim)
            </span>
            <textarea className="entrada-texto" rows={4} value={texto} onChange={(e) => setMensagem(e.target.value)} style={{ background: 'var(--areia)' }} />
          </label>
        )}

        <AvisoErro erro={erro ?? porEmail.error ?? emitir.error} />
        {aviso && (
          <div className="aviso" role="status">
            <Icone nome="check" />
            {aviso}
          </div>
        )}

        <div className="coluna" style={{ gap: 10 }}>
          {link ? (
            <>
              <div className="linha" style={{ gap: 10 }}>
                <button type="button" className="tr-btn tr-btn--primario" style={{ flex: '1 1 200px' }} disabled={b.concluidoEm !== null} onClick={abrirWhatsapp}>
                  Enviar pelo WhatsApp
                </button>
                <button
                  type="button"
                  className="tr-btn tr-btn--secundario"
                  style={{ flex: '1 1 200px' }}
                  disabled={porEmail.isPending || !b.cliente.email}
                  title={b.cliente.email ? undefined : 'Este cliente não tem e-mail cadastrado'}
                  onClick={async () => {
                    setMensagem(texto);
                    await porEmail.mutateAsync(texto);
                    setAviso(`Mandamos o link para ${b.cliente.email}.`);
                  }}
                >
                  Enviar por e-mail
                </button>
              </div>
              <span className="miudo texto-suave">"Enviar pelo WhatsApp" abre o seu WhatsApp com a mensagem pronta para {nome}. Quem envia é você; a Trames não manda essa mensagem.</span>
            </>
          ) : (
            <button type="button" className="tr-btn tr-btn--primario" disabled={emitir.isPending || !!b.concluidoEm} onClick={async () => setLink(await emitir.mutateAsync())}>
              Gerar link para enviar
            </button>
          )}
        </div>
        <div className="linha linha--entre pequeno" style={{ gap: 12, paddingTop: 16, borderTop: '1px solid var(--linha)' }}>
          <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ paddingLeft: 0 }} onClick={() => navegar(`/app/balcao/${b.id}`)}>
            Abrir o balcão de {nome}
          </button>
          {link && (
            <a href={link.url} target="_blank" rel="noreferrer" style={{ color: 'var(--tinta-suave)' }}>
              Ver como o cliente (abre em outra aba)
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Editar a lista de um balcão aberto ---------- */

const itensDoBalcao = (b: BalcaoDetalhe): Item[] =>
  b.itens.map((i) => ({ chave: ++chaves, id: i.id, nome: i.nome, detalhe: i.detalhe, obrigatorio: i.obrigatorio, status: i.status, temArquivo: !!i.documento || i.historico.length > 0 }));

export function EditarLista() {
  const { id = '' } = useParams();
  const consulta = useBalcao(id);
  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  // Monta uma vez: as atualizações automáticas do balcão não apagam o que está sendo editado.
  return <EditorLista key={id} b={consulta.data} />;
}

function EditorLista({ b }: { b: BalcaoDetalhe }) {
  const navegar = useNavigate();
  const [original] = useState(() => itensDoBalcao(b));
  const [itens, setItens] = useState<Item[]>(original);
  const [removidos, setRemovidos] = useState<Item[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const recarregar = useAcao(async () => undefined, [chavesConsulta.balcao(b.id), chavesConsulta.balcoes, chavesConsulta.historico(b.id)]);
  const nome = primeiroNome(b.cliente.nome);

  if (b.concluidoEm) {
    return (
      <div className="coluna" style={{ gap: 16 }}>
        <Link to={`/app/balcao/${b.id}`} className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start' }}>
          <Icone nome="voltar" />
          Voltar
        </Link>
        <div className="aviso">
          <Icone nome="cadeado" />
          <span>Este balcão está concluído. Para mudar a lista, reabra o balcão.</span>
        </div>
      </div>
    );
  }

  function remover(d: Item) {
    if (itens.length <= 1) return setErro(new Error('O balcão precisa de pelo menos um documento.'));
    if (d.id && d.temArquivo && !window.confirm(`"${d.nome}" já tem arquivo enviado. Tirar da lista? O arquivo sai da lista de ${nome}, mas fica guardado até a retenção do balcão.`)) return;
    setItens(itens.filter((x) => x.chave !== d.chave));
    if (d.id) setRemovidos([...removidos, d]);
  }

  async function salvar() {
    setErro(null);
    if (itens.some((i) => !i.nome.trim())) return setErro(new Error('Todo documento precisa de um nome.'));
    setSalvando(true);
    try {
      for (const r of removidos) await api('DELETE', `/itens/${r.id}?confirmar=1`);
      for (const i of itens) {
        const antes = original.find((o) => o.id === i.id);
        if (!antes) continue;
        const mudou = antes.nome !== i.nome || antes.detalhe !== i.detalhe || antes.obrigatorio !== i.obrigatorio;
        if (mudou || i.pedirDeNovo) await api('PATCH', `/itens/${i.id}`, { nome: i.nome.trim(), detalhe: i.detalhe.trim(), obrigatorio: i.obrigatorio, pedirDeNovo: !!i.pedirDeNovo });
      }
      const novos = itens.filter((i) => !i.id);
      const ids = new Map<number, string>();
      if (novos.length) {
        const r = await api<{ ids: string[] }>('POST', `/balcoes/${b.id}/itens`, { itens: novos.map((n) => ({ nome: n.nome.trim(), detalhe: n.detalhe.trim(), obrigatorio: n.obrigatorio })) });
        novos.forEach((n, k) => ids.set(n.chave, r.ids[k]));
      }
      const ordem = itens.map((i) => i.id ?? ids.get(i.chave)!);
      const ordemServidor = [...original.filter((o) => !removidos.some((r) => r.id === o.id)).map((o) => o.id!), ...novos.map((n) => ids.get(n.chave)!)];
      if (ordem.join() !== ordemServidor.join()) await api('PUT', `/balcoes/${b.id}/ordem`, { ids: ordem });
      await recarregar.mutateAsync();
      navegar(`/app/balcao/${b.id}`, { state: { aviso: novos.length || itens.some((i) => i.pedirDeNovo) ? `Lista salva. ${nome} recebe um e-mail com o que mudou em até 10 minutos.` : 'Lista salva.' } });
    } catch (e) {
      setErro(e);
      setSalvando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header className="linha linha--entre" style={{ gap: 16 }}>
        <div className="linha" style={{ gap: 16, minWidth: 0 }}>
          <Link to={`/app/balcao/${b.id}`} className="tr-btn tr-btn--discreto tr-btn--sm">
            <Icone nome="voltar" />
            {b.cliente.nome}
          </Link>
          <span style={{ width: 1, height: 24, background: 'var(--linha)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>Editar lista</span>
        </div>
        <div className="linha">
          <Link to={`/app/balcao/${b.id}`} className="tr-btn tr-btn--discreto">
            Cancelar
          </Link>
          <button type="button" className="tr-btn tr-btn--primario" disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar lista'}
          </button>
        </div>
      </header>
      <AvisoErro erro={erro} />
      <section className="cartao">
        <div className="coluna" style={{ gap: 4 }}>
          <h2 className="titulo-2">Documentos de {nome}</h2>
          <p className="pequeno texto-suave">
            {nome} vê a lista nova na próxima vez que abrir o link. Se você incluir um documento ou pedir algum de novo, ele recebe um e-mail avisando (as mudanças de 10 minutos vão juntas).
          </p>
        </div>
        <ListaDocumentos
          itens={itens}
          mudar={setItens}
          remover={remover}
          extra={(d) =>
            d.id ? (
              <div className="linha miudo" style={{ gap: 10, padding: '2px 6px' }}>
                {d.status && <Status status={d.status} />}
                {d.status && d.status !== 'pendente' && (
                  <label className="linha" style={{ gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!d.pedirDeNovo} onChange={(e) => setItens(itens.map((x) => (x.chave === d.chave ? { ...x, pedirDeNovo: e.target.checked } : x)))} style={{ accentColor: '#13594b' }} />
                    Pedir de novo (o arquivo atual vai para o histórico)
                  </label>
                )}
              </div>
            ) : (
              <span className="miudo" style={{ padding: '2px 6px', color: 'var(--mangue)', fontWeight: 500 }}>
                Novo · entra como pendente
              </span>
            )
          }
        />
        <div className="linha">
          <button type="button" className="tr-btn tr-btn--secundario" onClick={() => setItens([...itens, novoItem()])}>
            <Icone nome="mais" />
            Adicionar documento
          </button>
          <PuxarModelo adicionar={(novos) => setItens([...itens, ...comChave(novos.filter((n) => !itens.some((i) => i.nome === n.nome)))])} />
        </div>
      </section>
    </div>
  );
}
