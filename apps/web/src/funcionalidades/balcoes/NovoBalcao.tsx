import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { type CanalCodigo, type ItemEntrada as ItemModelo, type LinkGerado } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves as chavesConsulta, useAcao, useCobranca, useModelos, usePastas, useSessao } from '../../dados/consultas';
import { Bloqueio, Carregando, SeloConta } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { Computador } from '../../ui/Computador';
import { Iphone } from '../../ui/Iphone';
import { useNotificar } from '../../ui/Notificacoes';
import { dataLonga, diaDaqui, primeiroNome, soDigitos } from '../../util/formatos';
import { comChave, ListaDocumentos, PuxarModelo, type Item } from './ListaDocumentos';


const ARTIGOS = ['de', 'do', 'da', 'para'] as const;

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
  // A palavra antes do tipo de caso é só da frase e da prévia; o balcão guarda só o tipo.
  const [artigo, setArtigo] = useState<string>(ARTIGOS[0]);
  const conector = artigo;
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

  // Uso do plano aparece como pop-up, uma vez ao abrir o formulário; o detalhe fica em Plano e uso.
  const avisar = !soConfere && (noLimite || excedente);
  useEffect(() => {
    if (!avisar) return;
    notificar(
      noLimite
        ? { titulo: 'Você chegou no limite de balcões', texto: `O plano ${p.nome} permite ${p.limiteBalcoes} balcões ativos. Conclua um que já terminou ou mude de plano.`, acao: { rotulo: 'Ver plano e uso', para: '/app/configuracoes/plano' } }
        : { titulo: 'Você já usou os balcões do mês', texto: `O plano ${p.nome} inclui ${p.balcoesNoMes} balcões novos por mês. Este entra como adicional.`, acao: { rotulo: 'Ver plano e uso', para: '/app/configuracoes/plano' } },
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
      if (b.excedente) notificar({ titulo: 'Balcão adicional criado', texto: 'Ele aparece em Plano e uso, junto com o resto do mês.', acao: { rotulo: 'Ver plano e uso', para: '/app/configuracoes/plano' } });
      navegar(`/app/balcao/${b.id}/link`, { state: { link: b.link, criado: true } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para criar o balcão.');
    }
  }

  const nomeOk = cliente.nome.trim().length >= 2;
  const contatoOk = nomeOk && soDigitos(cliente.whatsapp).length >= 10 && /\S+@\S+\.\S+/.test(cliente.email);
  const docsOk = itens.length > 0;
  const prazoOk = !!prazo && prazo >= diaDaqui(0);
  const obrigatorios = itens.filter((i) => i.obrigatorio).length;
  const oCliente = nomeCliente === 'cliente' ? 'o cliente' : nomeCliente;
  const nomeEscrito = (v: string, minimo: number) => ({ size: Math.max(v.length, minimo) + 1 });
  const marca = (ok: boolean, n: number) => <span className={`pedido-bloco__marca${ok ? ' pedido-bloco__marca--ok' : ''}`}>{ok ? <Icone nome="check" tamanho={14} /> : n}</span>;

  /** O que o cliente vê: igual no celular e no computador. */
  const conteudoCliente = (
    <>
      <div className="linha miudo texto-suave" style={{ gap: 8 }}>
        {sessao.tem('marca') && <SeloConta conta={sessao.organizacao} tamanho={24} />}
        {sessao.organizacao.nome}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: '28px', fontWeight: 600 }}>Olá, {primeiroNome(cliente.nome) || '[nome]'}</div>
      <p className="miudo texto-suave" style={{ lineHeight: '19px' }}>
        O escritório está reunindo os documentos{tipo ? ` ${conector ? `${conector} ` : ''}${tipo.toLowerCase()}` : ''} e pediu {itens.length} {itens.length === 1 ? 'item' : 'itens'} até {dataLonga(prazo)}.
      </p>
      <div className="coluna" style={{ gap: 6 }}>
        {itens.map((d) => (
          <div key={d.chave} className="linha linha--entre miudo" style={{ background: 'var(--areia-elevada)', border: '1px solid var(--linha)', borderRadius: 10, padding: '9px 12px', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</span>
              {d.detalhe.trim() && <span style={{ color: 'var(--tinta-suave)', fontSize: 12, lineHeight: '16px' }}>{d.detalhe}</span>}
            </span>
            <span style={{ color: 'var(--mangue)', fontWeight: 500 }}>Enviar</span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <form onSubmit={criar} className="pedido">
      <header className="linha" style={{ gap: 12 }}>
        <Link to="/app/balcoes" className="tr-btn tr-btn--discreto tr-btn--sm">
          <Icone nome="voltar" />
          Balcões
        </Link>
        {modelo && <span className="tr-etiqueta">A partir do modelo {modelo.nome}</span>}
      </header>

      {soConfere && (
        <div className="aviso">
          <Icone nome="info" />
          <span>Sua permissão nesta conta é só de conferir documentos. Peça a quem administra a conta para mudar, na tela Equipe.</span>
        </div>
      )}

      <section className="pedido__frase">
        <span className="rotulo">Novo balcão</span>
        <p className="frase">
          <span className="frase__pedaco">
            Documentos{' '}
            <select className="frase__artigo" aria-label="Palavra antes do tipo de caso" value={artigo} onChange={(e) => setArtigo(e.target.value)} style={{ width: `${artigo.length + 1.2}ch` }}>
              {ARTIGOS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
{' '}
            <input aria-label="Tipo de caso" placeholder="tipo de caso" value={tipo} onChange={(e) => setTipo(e.target.value)} {...nomeEscrito(tipo, 12)} />
          </span>{' '}
          <span className="frase__pedaco">
            para <input aria-label="Nome completo do cliente" placeholder="nome do cliente" required autoFocus {...campo('nome')} {...nomeEscrito(cliente.nome, 15)} />,
          </span>{' '}
          <span className="frase__pedaco">
            até <input aria-label="Prazo para o cliente" type="date" required value={prazo} min={diaDaqui(0)} onChange={(e) => setPrazo(e.target.value)} />.
          </span>
        </p>
        <span className="miudo texto-suave">O tipo de caso agrupa os balcões numa pasta em Início. Ex.: Inventário, Imposto de Renda, Primeira consulta.</span>
      </section>

      <section className="pedido-bloco">
        <div className="pedido-bloco__titulo">
          {marca(contatoOk, 1)}
          <div>
            <h2>Contato {nomeCliente === 'cliente' ? 'do cliente' : `de ${nomeCliente}`}</h2>
            <p className="miudo texto-suave">Ninguém cria conta. O link vai pelo seu WhatsApp ou por e-mail.</p>
          </div>
        </div>
        <div className="campos-3">
          <label className="tr-campo tr-campo--largo">
            <span className="tr-campo__rotulo">WhatsApp</span>
            <input className="tr-campo__entrada" inputMode="tel" required placeholder="(81) 90000-0000" {...campo('whatsapp')} />
          </label>
          <label className="tr-campo tr-campo--largo">
            <span className="tr-campo__rotulo">E-mail</span>
            <input className="tr-campo__entrada" type="email" required placeholder="nome@email.com" {...campo('email')} />
          </label>
          <label className="tr-campo tr-campo--largo">
            <span className="tr-campo__rotulo">CPF (opcional)</span>
            <input className="tr-campo__entrada" inputMode="numeric" placeholder="000.000.000-00" {...campo('cpf')} />
          </label>
        </div>
      </section>

      <section className="pedido-bloco pedido-bloco--docs">
        <div className="pedido-bloco__esquerda">
          <div className="pedido-bloco__titulo">
            {marca(docsOk, 2)}
            <div>
              <h2>Documentos</h2>
              <p className="miudo texto-suave">Escreva como explicaria pessoalmente, inclusive para que serve cada um: {oCliente} vê a explicação embaixo do nome. A ordem aqui é a ordem que ele vê.</p>
            </div>
          </div>
          <div className="marca-esticada" aria-hidden="true">
            <span className="marca-esticada__fora" />
            <span className="marca-esticada__dentro" />
          </div>
        </div>
        <div>
          <ListaDocumentos itens={itens} mudar={setItens} />
          <PuxarModelo adicionar={(novos) => setItens([...itens, ...comChave(novos.filter((n) => !itens.some((i) => i.nome === n.nome)))])} />
        </div>
      </section>

      <section className="pedido-bloco">
        <div className="pedido-bloco__titulo">
          {marca(prazoOk, 3)}
          <div>
            <h2>Acesso e lembretes</h2>
            <p className="miudo texto-suave">Cada vez que {oCliente} abrir o link, chega um código novo.</p>
          </div>
        </div>
        <div className="coluna" style={{ gap: 12 }}>
          <div className="pedido-envio">
            <Canal rotulo="Código de acesso por" valor={canalCodigo} mudar={setCanalCodigo} pode={comWhatsapp} />
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Lembretes automáticos</span>
              <span className="pedido-envio__interruptor">
                <input type="checkbox" className="interruptor" checked={lembrete} onChange={(e) => setLembrete(e.target.checked)} />
                <span className="miudo">{lembrete ? '3 dias antes e no dia do prazo' : 'Desligados'}</span>
              </span>
            </label>
            {lembrete ? <Canal rotulo="Lembretes por" valor={canalLembrete} mudar={setCanalLembrete} pode={comWhatsapp} /> : <span />}
            {pastas.length > 0 ? (
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">Guardar na pasta</span>
                <select className="tr-campo__entrada" value={pastaId} onChange={(e) => setPastaId(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {pastas.map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.nome}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span />
            )}
          </div>
          {comWhatsapp ? (
            (canalCodigo === 'whatsapp' || (lembrete && canalLembrete === 'whatsapp')) && <p className="miudo texto-suave">Mensagens pelo WhatsApp contam na cota do plano. Se a cota acabar, vão por e-mail até o mês virar.</p>
          ) : (
            <Bloqueio recurso="whatsapp" compacto />
          )}
        </div>
      </section>

      <section className="pedido-resumo" aria-label="Resumo">
        <h2 className="titulo-cartao">Resumo</h2>
        <dl className="pedido-resumo__itens">
          <div className={nomeOk ? 'ok' : undefined}>
            <dt>Cliente</dt>
            <dd>{nomeOk ? cliente.nome.trim() : 'Falta o nome'}</dd>
            <dd className="miudo texto-suave">{[cliente.whatsapp.trim(), cliente.email.trim()].filter(Boolean).join(' · ') || 'Falta WhatsApp e e-mail'}</dd>
          </div>
          <div className={docsOk ? 'ok' : undefined}>
            <dt>Documentos</dt>
            <dd>{docsOk ? `${itens.length} ${itens.length === 1 ? 'documento' : 'documentos'}` : 'Nenhum ainda'}</dd>
            <dd className="miudo texto-suave">{docsOk ? `${obrigatorios} ${obrigatorios === 1 ? 'obrigatório' : 'obrigatórios'}` : 'Inclua pelo menos um'}</dd>
          </div>
          <div className={prazoOk ? 'ok' : undefined}>
            <dt>Prazo</dt>
            <dd>{prazoOk ? dataLonga(prazo, true) : 'Escolha uma data'}</dd>
            <dd className="miudo texto-suave">{tipo ? `Tipo: ${tipo}` : 'Sem tipo de caso'}</dd>
          </div>
          <div className="ok">
            <dt>Envio</dt>
            <dd>Código por {comWhatsapp && canalCodigo === 'whatsapp' ? 'WhatsApp' : 'e-mail'}</dd>
            <dd className="miudo texto-suave">{lembrete ? `Lembretes por ${comWhatsapp && canalLembrete === 'whatsapp' ? 'WhatsApp' : 'e-mail'}` : 'Sem lembretes'}</dd>
          </div>
        </dl>
        <div className="pedido-resumo__acao">
          {erro && (
            <div className="aviso aviso--erro" role="alert">
              <Icone nome="info" />
              {erro}
            </div>
          )}
          <span className="miudo texto-suave">Na próxima tela você manda o link.</span>
          <button type="submit" className="tr-btn tr-btn--primario" disabled={!podeAbrir || criarBalcao.isPending}>
            {criarBalcao.isPending ? 'Criando…' : 'Criar balcão e gerar link'}
          </button>
        </div>
      </section>

      <section className="pedido-previa" aria-label="Prévia do que o cliente vê">
        <div className="coluna" style={{ gap: 2 }}>
          <h2 className="titulo-cartao">Assim {oCliente} vai ver</h2>
          <p className="miudo texto-suave">A prévia acompanha o que você escreve: o nome do escritório, a frase de abertura e a lista na ordem em que está.</p>
        </div>
        <div className="pedido-previa__aparelhos">
          <Iphone>{conteudoCliente}</Iphone>
          <Computador endereco="trames.app/b/…">
            <div className="computador__pagina">{conteudoCliente}</div>
          </Computador>
        </div>
      </section>
    </form>
  );
}
