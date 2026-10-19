import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PRECO_EXCEDENTE_CENTAVOS, type CanalCodigo, type ItemEntrada as ItemModelo, type LinkGerado } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves as chavesConsulta, useAcao, useCobranca, useModelos, usePastas, useSessao } from '../../dados/consultas';
import { Bloqueio, Carregando, SeloConta } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { useNotificar } from '../../ui/Notificacoes';
import { dataLonga, diaDaqui, primeiroNome, soDigitos } from '../../util/formatos';
import { comChave, ListaDocumentos, novoItem, PuxarModelo, type Item } from './ListaDocumentos';

const reais = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Carrega o modelo (se veio ?modelo=) antes de montar o formulário. */
export function NovoBalcao() {
  const [params] = useSearchParams();
  const modelos = useModelos();
  const idModelo = params.get('modelo');
  if (idModelo && modelos.isPending) return <Carregando />;
  const modelo = modelos.data?.find((m) => m.id === idModelo);
  return <FormularioBalcao key={idModelo ?? 'novo'} modelo={modelo} pastaInicial={params.get('pasta')} />;
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

function FormularioBalcao({ modelo, pastaInicial }: { modelo?: { nome: string; itens: ItemModelo[] }; pastaInicial: string | null }) {
  const sessao = useSessao();
  const navegar = useNavigate();
  const uso = useCobranca().data;
  const [tipo, setTipo] = useState(modelo?.nome ?? '');
  const pastas = usePastas().data ?? [];
  const [pastaId, setPastaId] = useState(pastaInicial ?? '');
  const [itens, setItens] = useState<Item[]>(() => comChave(modelo?.itens ?? []));
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
  const notificar = useNotificar();

  // Uso do plano aparece como pop-up, uma vez ao abrir o formulário; o detalhe fica em Minha conta.
  const avisar = !soConfere && (noLimite || excedente);
  useEffect(() => {
    if (!avisar) return;
    notificar(
      noLimite
        ? { titulo: 'Você chegou no limite de balcões', texto: `O plano ${p.nome} permite ${p.limiteBalcoes} balcões ativos. Conclua um que já terminou ou mude de plano.`, acao: { rotulo: 'Ver em Minha conta', para: '/app/conta' } }
        : { titulo: 'Este balcão vai ser cobrado como excedente', texto: `${reais(PRECO_EXCEDENTE_CENTAVOS)}, porque o plano ${p.nome} inclui ${p.balcoesNoMes} balcões novos por mês.`, acao: { rotulo: 'Ver em Minha conta', para: '/app/conta' } },
    );
  }, [avisar]);
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
        pastaId: pastas.some((p) => p.id === pastaId) ? pastaId : null,
        itens: itens.map(({ nome, detalhe, obrigatorio }) => ({ nome, detalhe, obrigatorio })),
      });
      if (b.excedente) notificar({ titulo: 'Balcão cobrado como excedente', texto: `${reais(PRECO_EXCEDENTE_CENTAVOS)}, na próxima fatura.`, acao: { rotulo: 'Ver em Minha conta', para: '/app/conta' } });
      navegar(`/app/balcao/${b.id}/link`, { state: { link: b.link, criado: true } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para criar o balcão.');
    }
  }

  return (
    <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header className="linha linha--entre" style={{ gap: 16 }}>
        <div className="linha" style={{ gap: 16, minWidth: 0 }}>
          <Link to="/app/balcoes" className="tr-btn tr-btn--discreto tr-btn--sm">
            <Icone nome="voltar" />
            Balcões
          </Link>
          <span style={{ width: 1, height: 24, background: 'var(--linha)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>Novo balcão</span>
          {modelo && <span className="tr-etiqueta">Modelo: {modelo.nome}</span>}
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
                <span className="tr-campo__dica">Os balcões do mesmo tipo ficam juntos, numa pasta em Início.</span>
              </label>
              {pastas.length > 0 && (
                <label className="tr-campo tr-campo--largo">
                  <span className="tr-campo__rotulo">Pasta</span>
                  <select className="tr-campo__entrada" value={pastaId} onChange={(e) => setPastaId(e.target.value)}>
                    <option value="">Sem pasta</option>
                    {pastas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <span className="tr-campo__dica">Opcional. Dá para mudar depois, na tela do balcão.</span>
                </label>
              )}
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
                  Mensagens pelo WhatsApp contam na cota do plano ({p.cotaWhatsapp.toLocaleString('pt-BR')} por mês). Se a cota acabar, vão por e-mail até o mês virar.
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
