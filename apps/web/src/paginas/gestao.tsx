import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PLANOS, type Permissao } from '@trames/shared';
import { api } from '../dados/api';
import { chaves, useAcao, useClientes, useCobranca, useEquipe, useRelatorio, useSessao } from '../dados/consultas';
import { AvisoErro, Bloqueio, Carregando, SeloConta, Status, useToast } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { dataLonga, diasAte, iniciais, plural, prazoRelativo } from '../util';

export function Clientes() {
  const s = useSessao();
  const consulta = useClientes();
  const [busca, setBusca] = useState('');
  const [toast, avisar] = useToast();
  const excluir = useAcao((id: string) => api('DELETE', `/clientes/${id}`), [chaves.clientes, chaves.balcoes, chaves.cobranca]);
  const admin = s.usuario.permissao === 'admin';

  async function exportar(id: string, nome: string) {
    const r = await fetch(`/api/clientes/${id}/exportar`, { credentials: 'same-origin' });
    if (!r.ok) return avisar('Não deu para exportar.');
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `dados-${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (consulta.isPending) return <Carregando />;
  const termo = busca.trim().toLowerCase();
  const linhas = (consulta.data ?? []).filter((c) => c.nome.toLowerCase().includes(termo));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Clientes</h1>
          <p className="subtitulo">Todo mundo para quem você já abriu um balcão. A pedido do cliente, dá para exportar ou apagar os dados dele (LGPD).</p>
        </div>
        <label className="tr-campo" style={{ width: 320 }}>
          <span className="sr-only">Buscar cliente</span>
          <input className="tr-campo__entrada" placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>
      <AvisoErro erro={excluir.error} />
      <div className="tabela-caixa">
        <table className="tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>WhatsApp</th>
              <th>E-mail</th>
              <th>Balcões</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.nome}</td>
                <td className="tr-protocolo">final {c.whatsappFinal}</td>
                <td className="texto-suave">{c.email || '—'}</td>
                <td>
                  {plural(c.balcoesAbertos, 'aberto', 'abertos')}
                  {c.balcoesTotal > c.balcoesAbertos && <span className="texto-suave"> · {c.balcoesTotal - c.balcoesAbertos} concluído</span>}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.ultimoBalcaoId && (
                    <Link to={`/app/balcao/${c.ultimoBalcaoId}`} className="tr-btn tr-btn--secundario tr-btn--sm">
                      Abrir
                    </Link>
                  )}
                  {admin && (
                    <>
                      <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => exportar(c.id, c.nome)}>
                        Exportar dados
                      </button>
                      <button
                        type="button"
                        className="tr-btn tr-btn--discreto tr-btn--sm"
                        style={{ color: 'var(--recusado)' }}
                        onClick={async () => {
                          if (!window.confirm(`Apagar ${c.nome}, todos os balcões e todos os arquivos? Não dá para desfazer.`)) return;
                          await excluir.mutateAsync(c.id);
                          avisar('Dados do cliente apagados. Os arquivos saem do storage em instantes.');
                        }}
                      >
                        Apagar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast}
    </>
  );
}

const PERMISSOES: Record<Permissao, { nome: string; texto: string }> = {
  admin: { nome: 'Administra', texto: 'Tudo, inclusive plano e equipe' },
  monta: { nome: 'Monta balcões', texto: 'Cria balcões e confere documentos' },
  confere: { nome: 'Só confere', texto: 'Aprova ou recusa documentos' },
};

export function Equipe() {
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
                    <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ color: 'var(--recusado)' }} onClick={() => window.confirm(`Tirar ${p.nome} da conta?`) && remover.mutate(p.id)}>
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

function Numero({ valor, rotulo, cor }: { valor: number; rotulo: string; cor?: string }) {
  return (
    <div className="cartao" style={{ padding: 20, gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: '40px', fontWeight: 600, color: cor }}>{valor}</span>
      <span className="pequeno texto-suave">{rotulo}</span>
    </div>
  );
}

export function Relatorio() {
  const s = useSessao();
  const consulta = useRelatorio(s.tem('relatorio'));
  const [so, setSo] = useState<'todos' | 'atrasados' | 'semana'>('todos');

  if (!s.tem('relatorio')) {
    return (
      <>
        <h1 className="titulo-1">Relatório de prazos e pendências</h1>
        <Bloqueio recurso="relatorio" />
      </>
    );
  }
  if (consulta.isPending) return <Carregando />;

  const abertos = consulta.data ?? [];
  const atrasados = abertos.filter((b) => diasAte(b.prazo) < 0);
  const semana = abertos.filter((b) => diasAte(b.prazo) >= 0 && diasAte(b.prazo) <= 7);
  const pendentes = abertos.reduce((n, b) => n + b.contagem.pendente + b.contagem.recusado, 0);
  const analise = abertos.reduce((n, b) => n + b.contagem.analise, 0);
  const lista = so === 'atrasados' ? atrasados : so === 'semana' ? semana : abertos;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Relatório de prazos e pendências</h1>
          <p className="subtitulo">Os balcões abertos, do prazo mais urgente para o mais folgado.</p>
        </div>
        <button type="button" className="tr-btn tr-btn--secundario" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <Numero valor={abertos.length} rotulo="balcões abertos" />
        <Numero valor={atrasados.length} rotulo="com prazo vencido" cor="var(--recusado)" />
        <Numero valor={semana.length} rotulo="vencem em até 7 dias" cor="var(--pendente)" />
        <Numero valor={pendentes} rotulo="documentos que o cliente deve" />
        <Numero valor={analise} rotulo="documentos para conferir" cor="var(--em-analise)" />
      </div>
      <div className="linha">
        {(
          [
            ['todos', `Todos · ${abertos.length}`],
            ['atrasados', `Atrasados · ${atrasados.length}`],
            ['semana', `Próximos 7 dias · ${semana.length}`],
          ] as const
        ).map(([id, rotulo]) => (
          <button key={id} type="button" className="filtro" aria-pressed={so === id} onClick={() => setSo(id)}>
            {rotulo}
          </button>
        ))}
      </div>
      <div className="tabela-caixa">
        <table className="tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Prazo</th>
              <th>Faltam do cliente</th>
              <th>Para conferir</th>
              <th>Aprovados</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((b) => {
              const c = b.contagem;
              const d = diasAte(b.prazo);
              return (
                <tr key={b.id}>
                  <td>
                    <Link to={`/app/balcao/${b.id}`} style={{ fontWeight: 500 }}>
                      {b.clienteNome}
                    </Link>
                    <div className="tr-protocolo texto-suave">{b.protocolo}</div>
                  </td>
                  <td>{b.tipo && <span className="tr-etiqueta">{b.tipo}</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {dataLonga(b.prazo)}
                    <div className="miudo" style={{ color: d < 0 ? 'var(--recusado)' : d <= 7 ? 'var(--pendente)' : 'var(--tinta-suave)' }}>
                      {d < 0 ? `venceu ${prazoRelativo(b.prazo)}` : `vence ${prazoRelativo(b.prazo)}`}
                    </div>
                  </td>
                  <td>{c.pendente + c.recusado ? <Status status={c.recusado ? 'recusado' : 'pendente'} texto={`${c.pendente + c.recusado}${c.recusado ? ` (${c.recusado} recusado)` : ''}`} /> : '—'}</td>
                  <td>{c.analise ? <Status status="analise" texto={String(c.analise)} /> : '—'}</td>
                  <td>
                    {c.aprovado} de {c.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

const CORES = ['#13594b', '#8a5330', '#1c5d84', '#a9361b', '#865600', '#2e241b'];

export function Conta() {
  const s = useSessao();
  const cobranca = useCobranca().data;
  const { organizacao: o, plano } = s;
  const [f, setF] = useState({ nome: o.nome, sigla: o.sigla, cor: o.cor, diasRetencao: o.diasRetencao });
  const [toast, avisar] = useToast();
  const salvar = useAcao((corpo: typeof f) => api('PUT', '/organizacao', corpo), [chaves.eu]);
  const marca = s.tem('marca');
  const admin = s.usuario.permissao === 'admin';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await salvar.mutateAsync({ ...f, sigla: f.sigla.toUpperCase().slice(0, 2) });
    avisar('Alterações salvas.');
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Conta e marca</h1>
          <p className="subtitulo">O que o seu cliente vê ao abrir o balcão, por quanto tempo os arquivos ficam guardados, e o seu plano.</p>
        </div>
      </div>
      <AvisoErro erro={salvar.error} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <form className="cartao" style={{ flex: '2 1 420px', gap: 20 }} onSubmit={enviar}>
          <h2 className="titulo-2">Escritório</h2>
          <fieldset disabled={!admin} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Nome do escritório ou da clínica</span>
              <input className="tr-campo__entrada" required minLength={2} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </label>
            {marca ? (
              <>
                <label className="tr-campo" style={{ maxWidth: 140 }}>
                  <span className="tr-campo__rotulo">Sigla</span>
                  <input className="tr-campo__entrada" maxLength={2} value={f.sigla} onChange={(e) => setF({ ...f, sigla: e.target.value.toUpperCase() })} />
                </label>
                <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <legend className="tr-campo__rotulo" style={{ marginBottom: 8 }}>
                    Cor
                  </legend>
                  <div className="linha">
                    {CORES.map((cor) => (
                      <button key={cor} type="button" aria-label={`Cor ${cor}`} aria-pressed={f.cor === cor} onClick={() => setF({ ...f, cor })} style={{ width: 36, height: 36, borderRadius: 10, background: cor, cursor: 'pointer', border: f.cor === cor ? '3px solid var(--areia)' : '0', boxShadow: f.cor === cor ? '0 0 0 2px var(--tinta)' : 'none' }} />
                    ))}
                  </div>
                </fieldset>
                <div className="aviso" style={{ alignItems: 'center' }}>
                  <SeloConta conta={f} />
                  <span>Assim aparece no topo do balcão do cliente.</span>
                </div>
              </>
            ) : (
              <Bloqueio recurso="marca" compacto />
            )}
            <label className="tr-campo" style={{ maxWidth: 260 }}>
              <span className="tr-campo__rotulo">Apagar os arquivos depois de concluído o balcão</span>
              <select className="tr-campo__entrada" value={f.diasRetencao} onChange={(e) => setF({ ...f, diasRetencao: Number(e.target.value) })}>
                {[30, 90, 180, 365, 730, 1825].map((d) => (
                  <option key={d} value={d}>
                    {d < 365 ? `${d} dias` : `${d / 365} ${d === 365 ? 'ano' : 'anos'}`}
                  </option>
                ))}
              </select>
              <span className="tr-campo__dica">Os arquivos saem do storage; fica só o registro de que existiram.</span>
            </label>
          </fieldset>
          {admin && (
            <button type="submit" className="tr-btn tr-btn--primario" style={{ alignSelf: 'flex-start' }} disabled={salvar.isPending}>
              Salvar
            </button>
          )}
        </form>

        <section className="cartao" style={{ flex: '1 1 300px', gap: 14 }}>
          <span className="miudo texto-suave" style={{ fontWeight: 500 }}>
            Seu plano
          </span>
          <div className="linha linha--entre">
            <h2 style={{ fontSize: 28, lineHeight: '32px' }}>{plano.nome}</h2>
            <span className="pequeno texto-suave">{plano.preco ? `R$ ${plano.preco} por mês` : 'R$ 0'}</span>
          </div>
          {cobranca && (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }}>
              <li>{plano.limiteBalcoes === null ? `${cobranca.balcoesAtivos} balcões ativos (sem limite)` : `${cobranca.balcoesAtivos} de ${plano.limiteBalcoes} balcões ativos`}</li>
              <li>{plano.limitePessoas === null ? `${cobranca.pessoas} pessoas (sem limite)` : `${cobranca.pessoas} de ${plano.limitePessoas} ${plano.limitePessoas === 1 ? 'pessoa' : 'pessoas'}`}</li>
            </ul>
          )}
          <Link to="/planos" className="tr-btn tr-btn--secundario tr-btn--bloco">
            {plano.id === 'ultra' ? 'Ver planos' : `Conhecer o ${PLANOS[plano.id === 'gratis' ? 'pro' : 'ultra'].nome}`}
          </Link>
        </section>
      </div>
      {toast}
    </>
  );
}
