import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PLANOS } from '../dados/planos';
import { acoes, balcoesAtivos, balcoesDaConta, contagem, estaAberto, pessoasDaConta, tem, useDb, useSessao } from '../dados/store';
import type { Balcao, Permissao } from '../dados/tipos';
import { Bloqueio, SeloConta, Status, useToast } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { dataLonga, diasAte, iniciais, plural, prazoRelativo } from '../util';

export function Clientes() {
  const db = useDb();
  const sessao = useSessao()!;
  const [busca, setBusca] = useState('');
  const porCliente = new Map<string, Balcao[]>();
  for (const b of balcoesDaConta(db, sessao.conta.id)) {
    porCliente.set(b.cliente.nome, [...(porCliente.get(b.cliente.nome) ?? []), b]);
  }
  const termo = busca.trim().toLowerCase();
  const linhas = [...porCliente.entries()].filter(([nome]) => nome.toLowerCase().includes(termo)).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Clientes</h1>
          <p className="subtitulo">Todo mundo para quem você já abriu um balcão.</p>
        </div>
        <label className="tr-campo" style={{ width: 320 }}>
          <span className="sr-only">Buscar cliente</span>
          <input className="tr-campo__entrada" placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>
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
            {linhas.map(([nome, bs]) => {
              const abertos = bs.filter(estaAberto);
              const ultimo = abertos[0] ?? bs[0];
              return (
                <tr key={nome}>
                  <td style={{ fontWeight: 500 }}>{nome}</td>
                  <td className="tr-protocolo">{ultimo.cliente.whatsapp}</td>
                  <td className="texto-suave">{ultimo.cliente.email || '—'}</td>
                  <td>
                    {plural(abertos.length, 'aberto', 'abertos')}
                    {bs.length > abertos.length && <span className="texto-suave"> · {bs.length - abertos.length} concluído</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/app/balcao/${ultimo.id}`} className="tr-btn tr-btn--secundario tr-btn--sm">
                      Abrir
                    </Link>
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

const PERMISSOES: Record<Permissao, { nome: string; texto: string }> = {
  admin: { nome: 'Administra', texto: 'Tudo, inclusive plano e equipe' },
  monta: { nome: 'Monta balcões', texto: 'Cria balcões e confere documentos' },
  confere: { nome: 'Só confere', texto: 'Aprova ou recusa documentos' },
};

export function Equipe() {
  const db = useDb();
  const sessao = useSessao()!;
  const pessoas = pessoasDaConta(db, sessao.conta.id);
  const limite = sessao.plano.limitePessoas;
  const cheio = limite !== null && pessoas.length >= limite;
  const comPermissoes = tem(sessao, 'permissoes');
  const souAdmin = sessao.usuario.permissao === 'admin';
  const [convite, setConvite] = useState({ nome: '', email: '', permissao: 'monta' as Permissao });
  const [toast, avisar] = useToast();

  function convidar(e: FormEvent) {
    e.preventDefault();
    acoes.convidar(sessao.conta.id, convite.nome, convite.email, comPermissoes ? convite.permissao : 'admin');
    avisar(`Convite enviado para ${convite.email}.`);
    setConvite({ nome: '', email: '', permissao: 'monta' });
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Equipe</h1>
          <p className="subtitulo">
            {limite === null ? `${plural(pessoas.length, 'pessoa', 'pessoas')} na conta. O plano ${sessao.plano.nome} não tem limite de pessoas.` : `${pessoas.length} de ${limite} ${limite === 1 ? 'pessoa' : 'pessoas'} no plano ${sessao.plano.nome}.`}
          </p>
        </div>
      </div>

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
                      {p.id === sessao.usuario.id && <span className="texto-suave" style={{ fontWeight: 400 }}> (você)</span>}
                    </span>
                  </span>
                </td>
                <td className="texto-suave">{p.email}</td>
                <td>
                  {comPermissoes && souAdmin && p.id !== sessao.usuario.id ? (
                    <select className="tr-campo__entrada" style={{ height: 36, fontSize: 14 }} value={p.permissao} onChange={(e) => acoes.mudarPermissao(p.id, e.target.value as Permissao)} aria-label={`Permissão de ${p.nome}`}>
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
                  {p.id !== sessao.usuario.id && souAdmin && (
                    <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ color: 'var(--recusado)' }} onClick={() => window.confirm(`Tirar ${p.nome} da conta?`) && acoes.removerPessoa(p.id)}>
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
            {limite === 1 ? 'O plano Grátis é para 1 pessoa.' : `O plano ${sessao.plano.nome} permite até ${limite} pessoas.`} Para chamar mais gente, <Link to="/planos">mude de plano</Link>.
          </span>
        </div>
      ) : (
        souAdmin && (
          <form className="cartao" onSubmit={convidar} style={{ maxWidth: 760 }}>
            <h2 className="titulo-2">Convidar pessoa</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16, alignItems: 'end' }}>
              <label className="tr-campo tr-campo--largo">
                <span className="tr-campo__rotulo">Nome</span>
                <input className="tr-campo__entrada" required value={convite.nome} onChange={(e) => setConvite({ ...convite, nome: e.target.value })} />
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
              <button type="submit" className="tr-btn tr-btn--primario">
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
  const db = useDb();
  const sessao = useSessao()!;
  const [so, setSo] = useState<'todos' | 'atrasados' | 'semana'>('todos');

  if (!tem(sessao, 'relatorio')) {
    return (
      <>
        <h1 className="titulo-1">Relatório de prazos e pendências</h1>
        <Bloqueio recurso="relatorio" />
      </>
    );
  }

  const abertos = balcoesAtivos(db, sessao.conta.id).sort((a, b) => a.prazo.localeCompare(b.prazo));
  const atrasados = abertos.filter((b) => diasAte(b.prazo) < 0);
  const semana = abertos.filter((b) => diasAte(b.prazo) >= 0 && diasAte(b.prazo) <= 7);
  const pendentes = abertos.reduce((s, b) => s + contagem(b).pendente + contagem(b).recusado, 0);
  const analise = abertos.reduce((s, b) => s + contagem(b).analise, 0);
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
              const c = contagem(b);
              const d = diasAte(b.prazo);
              return (
                <tr key={b.id}>
                  <td>
                    <Link to={`/app/balcao/${b.id}`} style={{ fontWeight: 500 }}>
                      {b.cliente.nome}
                    </Link>
                    <div className="tr-protocolo texto-suave">{b.protocolo}</div>
                  </td>
                  <td>
                    <span className="tr-etiqueta">{b.tipo}</span>
                  </td>
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
  const db = useDb();
  const sessao = useSessao()!;
  const { conta, plano } = sessao;
  const [f, setF] = useState({ nome: conta.nome, sigla: conta.sigla, cor: conta.cor });
  const [toast, avisar] = useToast();
  const marca = tem(sessao, 'marca');
  const ativos = balcoesAtivos(db, conta.id).length;
  const pessoas = pessoasDaConta(db, conta.id).length;

  function salvar(e: FormEvent) {
    e.preventDefault();
    acoes.atualizarConta(conta.id, marca ? { ...f, sigla: f.sigla.toUpperCase().slice(0, 2) } : { nome: f.nome });
    avisar('Alterações salvas.');
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Conta e marca</h1>
          <p className="subtitulo">O que o seu cliente vê ao abrir o balcão, e o seu plano.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <form className="cartao" style={{ flex: '2 1 420px', gap: 20 }} onSubmit={salvar}>
          <h2 className="titulo-2">Escritório</h2>
          <label className="tr-campo tr-campo--largo">
            <span className="tr-campo__rotulo">Nome do escritório ou da clínica</span>
            <input className="tr-campo__entrada" required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
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
                <SeloConta conta={{ ...conta, ...f }} />
                <span>Assim aparece no topo do balcão do cliente.</span>
              </div>
            </>
          ) : (
            <Bloqueio recurso="marca" compacto />
          )}
          <button type="submit" className="tr-btn tr-btn--primario" style={{ alignSelf: 'flex-start' }}>
            Salvar
          </button>
        </form>

        <section className="cartao" style={{ flex: '1 1 300px', gap: 14 }}>
          <span className="miudo texto-suave" style={{ fontWeight: 500 }}>
            Seu plano
          </span>
          <div className="linha linha--entre">
            <h2 style={{ fontSize: 28, lineHeight: '32px' }}>{plano.nome}</h2>
            <span className="pequeno texto-suave">{plano.preco ? `R$ ${plano.preco} por mês` : 'R$ 0'}</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }}>
            <li>{plano.limiteBalcoes === null ? `${ativos} balcões ativos (sem limite)` : `${ativos} de ${plano.limiteBalcoes} balcões ativos`}</li>
            <li>{plano.limitePessoas === null ? `${pessoas} pessoas (sem limite)` : `${pessoas} de ${plano.limitePessoas} ${plano.limitePessoas === 1 ? 'pessoa' : 'pessoas'}`}</li>
          </ul>
          <Link to="/planos" className="tr-btn tr-btn--secundario tr-btn--bloco">
            {plano.id === 'ultra' ? 'Ver planos' : `Conhecer o ${PLANOS[plano.id === 'gratis' ? 'pro' : 'ultra'].nome}`}
          </Link>
        </section>
      </div>
      {toast}
    </>
  );
}
