import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { type CanalCodigo, type ItemEntrada as ItemModelo, type LinkGerado } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves as chavesConsulta, useAcao, useCobranca, useModelos, usePastas, useSessao } from '../../dados/consultas';
import { Bloqueio, Carregando, SeloConta } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { useNotificar } from '../../ui/Notificacoes';
import { dataLonga, diaDaqui, primeiroNome, soDigitos } from '../../util/formatos';
import { comChave, ListaDocumentos, PuxarModelo, type Item } from './ListaDocumentos';


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

  const contatoOk = cliente.nome.trim().length >= 2 && soDigitos(cliente.whatsapp).length >= 10 && /\S+@\S+\.\S+/.test(cliente.email);
  const docsOk = itens.length > 0;
  const prazoOk = !!prazo && prazo >= diaDaqui(0);
  const falta = [
    { ok: cliente.nome.trim().length >= 2, texto: 'Nome do cliente' },
    { ok: soDigitos(cliente.whatsapp).length >= 10 && /\S+@\S+\.\S+/.test(cliente.email), texto: 'WhatsApp e e-mail' },
    { ok: docsOk, texto: docsOk ? `${itens.length} ${itens.length === 1 ? 'documento' : 'documentos'}` : 'Pelo menos um documento' },
    { ok: prazoOk, texto: prazoOk ? `Prazo: ${dataLonga(prazo)}` : 'Prazo' },
  ];
  const nomeEscrito = (v: string, minimo: number) => ({ size: Math.max(v.length, minimo) + 1 });

  return (
    <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      <div className="folha-pedido">
        <div className="folha">
          <div className="folha__frase">
            <span className="miudo texto-suave" style={{ fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Novo balcão
            </span>
            <p className="frase">
              Documentos de{' '}
              <input aria-label="Tipo de caso" placeholder="tipo de caso" value={tipo} onChange={(e) => setTipo(e.target.value)} {...nomeEscrito(tipo, 12)} /> para{' '}
              <input aria-label="Nome completo do cliente" placeholder="nome do cliente" required autoFocus {...campo('nome')} {...nomeEscrito(cliente.nome, 15)} />, até{' '}
              <input aria-label="Prazo para o cliente" type="date" required value={prazo} min={diaDaqui(0)} onChange={(e) => setPrazo(e.target.value)} />.
            </p>
            <span className="miudo texto-suave">O tipo de caso agrupa os balcões numa pasta em Início. Ex.: Inventário, Imposto de Renda, Primeira consulta.</span>
          </div>

          <section className={`etapa${contatoOk ? ' etapa--feita' : ''}`}>
            <span className="etapa__marca">{contatoOk ? <Icone nome="check" tamanho={16} /> : 1}</span>
            <div className="etapa__corpo">
              <div className="etapa__cabeca">
                <h2>Como falar com {nomeCliente === 'cliente' ? 'o cliente' : nomeCliente}</h2>
                <p className="pequeno texto-suave">Ninguém cria conta. O link vai pelo seu WhatsApp ou por e-mail, e o acesso pede um código.</p>
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
            </div>
          </section>

          <section className={`etapa${docsOk ? ' etapa--feita' : ''}`}>
            <span className="etapa__marca">{docsOk ? <Icone nome="check" tamanho={16} /> : 2}</span>
            <div className="etapa__corpo">
              <div className="etapa__cabeca">
                <h2>O que {nomeCliente === 'cliente' ? 'o cliente' : nomeCliente} precisa mandar</h2>
                <p className="pequeno texto-suave">Escreva como explicaria pessoalmente. A ordem aqui é a ordem que ele vê.</p>
              </div>
              <div>
                <ListaDocumentos itens={itens} mudar={setItens} />
                <PuxarModelo adicionar={(novos) => setItens([...itens, ...comChave(novos.filter((n) => !itens.some((i) => i.nome === n.nome)))])} />
              </div>
            </div>
          </section>

          <section className={`etapa${prazoOk ? ' etapa--feita' : ''}`}>
            <span className="etapa__marca">{prazoOk ? <Icone nome="check" tamanho={16} /> : 3}</span>
            <div className="etapa__corpo">
              <div className="etapa__cabeca">
                <h2>Acesso e lembretes</h2>
                <p className="pequeno texto-suave">Como chega o código para abrir o link e se a Trames lembra {nomeCliente === 'cliente' ? 'o cliente' : nomeCliente} do prazo.</p>
              </div>
              <div className="opcoes-envio">
                <div className="opcao-envio">
                  <Canal rotulo="Código de acesso por" valor={canalCodigo} mudar={setCanalCodigo} pode={comWhatsapp} />
                  <span className="miudo texto-suave">No mesmo celular, só pede de novo depois de 30 dias.</span>
                </div>
                <div className="opcao-envio">
                  <label className="linha linha--entre" style={{ flexWrap: 'nowrap', cursor: 'pointer' }}>
                    <span className="tr-campo__rotulo">Lembretes automáticos</span>
                    <input type="checkbox" className="interruptor" checked={lembrete} onChange={(e) => setLembrete(e.target.checked)} />
                  </label>
                  {lembrete ? (
                    <>
                      <Canal rotulo="Por" valor={canalLembrete} mudar={setCanalLembrete} pode={comWhatsapp} />
                      <span className="miudo texto-suave">3 dias antes do prazo, no dia e 2 dias depois, só se faltar algo obrigatório.</span>
                    </>
                  ) : (
                    <span className="miudo texto-suave">Você pode lembrar manualmente, na tela do balcão.</span>
                  )}
                </div>
              </div>
              {comWhatsapp ? (
                (canalCodigo === 'whatsapp' || (lembrete && canalLembrete === 'whatsapp')) && (
                  <p className="miudo texto-suave">Mensagens pelo WhatsApp contam na cota do plano. Se a cota acabar, vão por e-mail até o mês virar.</p>
                )
              ) : (
                <Bloqueio recurso="whatsapp" compacto />
              )}
              {pastas.length > 0 && (
                <label className="tr-campo" style={{ maxWidth: 280 }}>
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
              )}
            </div>
          </section>
        </div>

        <aside className="painel-pedido" aria-label="Resumo">
          <span className="miudo texto-suave" style={{ fontWeight: 500 }}>
            Assim {nomeCliente === 'cliente' ? 'o cliente' : nomeCliente} vai ver no celular
          </span>
          <div className="previa-cliente" aria-hidden="true">
            <div className="previa-cliente__tela">
              <div className="linha miudo texto-suave">
                {sessao.tem('marca') && <SeloConta conta={sessao.organizacao} tamanho={24} />}
                {sessao.organizacao.nome}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: '26px', fontWeight: 600 }}>Olá, {primeiroNome(cliente.nome) || '[nome]'}</div>
              <p className="miudo texto-suave" style={{ lineHeight: '19px' }}>
                O escritório está reunindo os documentos{tipo ? ` de ${tipo.toLowerCase()}` : ''} e pediu {itens.length} {itens.length === 1 ? 'item' : 'itens'} até {dataLonga(prazo)}.
              </p>
              <div className="coluna" style={{ gap: 6 }}>
                {itens.map((d) => (
                  <div key={d.chave} className="linha linha--entre miudo" style={{ background: 'var(--areia-elevada)', border: '1px solid var(--linha)', borderRadius: 10, padding: '9px 12px', flexWrap: 'nowrap' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</span>
                    <span style={{ color: 'var(--mangue)', fontWeight: 500 }}>Enviar</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="cartao" style={{ gap: 14 }}>
            <ul className="falta">
              {falta.map((f) => (
                <li key={f.texto} className={f.ok ? 'ok' : undefined}>
                  {f.ok ? <Icone nome="check" /> : <span className="falta__bolinha" />}
                  {f.texto}
                </li>
              ))}
            </ul>
            {erro && (
              <div className="aviso aviso--erro" role="alert">
                <Icone nome="info" />
                {erro}
              </div>
            )}
            <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" disabled={!podeAbrir || criarBalcao.isPending}>
              {criarBalcao.isPending ? 'Criando…' : 'Criar balcão e gerar link'}
            </button>
            <span className="miudo texto-suave" style={{ textAlign: 'center' }}>
              Na próxima tela você manda o link.
            </span>
          </div>
        </aside>
      </div>
    </form>
  );
}
