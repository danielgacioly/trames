import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { diasRetencao, type BalcaoDetalhe, type CanalCodigo, type DocumentoDto, type ItemDetalhe, type LinkGerado } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useBalcao, useCobranca, useHistorico, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando, Progresso, Status, useToast } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { dataLonga, primeiroNome, quandoEnviado, tamanhoLegivel } from '../../util/formatos';

const ACOES: Record<string, string> = {
  'balcao.criado': 'criou o balcão',
  'balcao.concluido': 'concluiu o balcão',
  'balcao.reaberto': 'reabriu o balcão',
  'balcao.arquivado': 'arquivou o balcão',
  'balcao.alterado': 'mudou o prazo ou os lembretes',
  'link.criado': 'gerou um link',
  'link.revogado': 'revogou o link',
  'link.enviado': 'enviou o link por e-mail',
  'link.copiado': 'copiou o link',
  'link.aberto_whatsapp': 'abriu o WhatsApp para mandar o link',
  'link.visto': 'viu o link de novo',
  'lembrete.enviado': 'mandou um lembrete',
  'cliente.entrou': 'entrou com o código',
  'cliente.codigo_errado': 'errou o código',
  'cliente.acesso_encerrado': 'encerrou o acesso do cliente',
  'item.adicionado': 'incluiu um documento na lista',
  'item.editado': 'editou um documento da lista',
  'item.pedido_de_novo': 'pediu um documento de novo',
  'item.removido': 'tirou um documento da lista',
  'itens.reordenados': 'mudou a ordem da lista',
  'documento.enviado': 'enviou um arquivo',
  'documento.verificado': 'liberou o arquivo (antivírus e tipo conferidos)',
  'documento.rejeitado': 'rejeitou o arquivo na verificação',
  'documento.viu': 'viu a miniatura de um arquivo',
  'documento.baixou': 'baixou um original',
  'documento.aprovou': 'aprovou um documento',
  'documento.recusou': 'recusou um documento',
  'documento.apagou': 'apagou um arquivo',
  'exportacao.pedida': 'pediu o ZIP com todos os arquivos',
  'exportacao.baixou': 'baixou o ZIP',
  'cobranca.excedente': 'gerou um balcão excedente',
  'retencao.apagou_documento': 'apagou um arquivo (retenção)',
  'retencao.apagou': 'apagou os arquivos (retenção)',
};

/** Abre uma URL assinada (~60 segundos). A janela abre antes da resposta para o navegador não bloquear. */
async function abrirUrl(buscar: () => Promise<{ url: string }>) {
  const janela = window.open('', '_blank');
  try {
    const { url } = await buscar();
    if (janela) janela.location.href = url;
    else window.location.href = url;
  } catch (e) {
    janela?.close();
    throw e;
  }
}

/** "Baixar original": o único caminho para o arquivo original. Cada download fica na auditoria. */
const baixarOriginal = (documentoId: string) => abrirUrl(() => api<{ url: string }>('GET', `/documentos/${documentoId}/url`));

function Miniatura({ d }: { d: DocumentoDto }) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (!d.temMiniatura) return;
    api<{ url: string }>('GET', `/documentos/${d.id}/miniatura`).then((r) => setUrl(r.url), () => setFalhou(true));
  }, [d.id, d.temMiniatura]);
  if (url) return <img src={url} alt={`Miniatura de ${d.nomeArquivo}`} style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 4, boxShadow: 'var(--shadow-sm)', background: '#fff' }} />;
  return (
    <>
      <Icone nome="envio" tamanho={32} />
      <span className="tr-protocolo">{d.nomeArquivo}</span>
      <span className="miudo texto-suave">
        {d.tipo === 'application/pdf' ? 'PDF' : 'Imagem'} · {tamanhoLegivel(d.tamanho)}
        {(!d.temMiniatura || falhou) && ' · sem miniatura: baixe o original para conferir'}
      </span>
    </>
  );
}

function Arquivo({ item }: { item: ItemDetalhe }) {
  const d = item.documento!;
  const [erro, setErro] = useState<unknown>(null);
  if (d.status === 'quarentena') {
    return (
      <div className="aviso">
        <Icone nome="relogio" />
        <span>O arquivo chegou e está passando pelo antivírus. Em instantes ele aparece aqui.</span>
      </div>
    );
  }
  if (d.status !== 'disponivel') {
    return (
      <div className="aviso aviso--erro">
        <Icone nome="info" />
        <span>{d.status === 'apagado' ? 'Este arquivo já foi apagado.' : 'O último arquivo enviado foi rejeitado na verificação (tipo não aceito ou ameaça encontrada). O cliente precisa enviar outro.'}</span>
      </div>
    );
  }
  return (
    <div className="coluna" style={{ gap: 16 }}>
      <div style={{ background: 'var(--areia-funda)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Miniatura d={d} />
      </div>
      <AvisoErro erro={erro} />
      <div className="linha linha--entre pequeno texto-suave">
        <span className="tr-protocolo">
          {d.nomeArquivo} · {tamanhoLegivel(d.tamanho)}
        </span>
        <span className="linha" style={{ gap: 12 }}>
          {quandoEnviado(d.enviadoEm)}
          <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" onClick={() => baixarOriginal(d.id).catch(setErro)}>
            <Icone nome="baixar" />
            Baixar original
          </button>
        </span>
      </div>
    </div>
  );
}

function HistoricoItem({ item }: { item: ItemDetalhe }) {
  const [erro, setErro] = useState<unknown>(null);
  if (!item.historico.length) return null;
  return (
    <details>
      <summary className="pequeno" style={{ cursor: 'pointer', fontWeight: 500 }}>
        Arquivos anteriores deste item ({item.historico.length})
      </summary>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {item.historico.map((h) => (
          <li key={h.id} className="linha linha--entre pequeno" style={{ gap: 8 }}>
            <span className="tr-protocolo texto-suave">
              {h.nomeArquivo} · {quandoEnviado(h.enviadoEm)}
            </span>
            <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => baixarOriginal(h.id).catch(setErro)}>
              Baixar original
            </button>
          </li>
        ))}
      </ul>
      <AvisoErro erro={erro} />
    </details>
  );
}

/** Prazo, lembretes e canal do código, para mudar depois de criado o balcão. */
function Configuracoes({ b, fechar }: { b: BalcaoDetalhe; fechar: (aviso: string) => void }) {
  const s = useSessao();
  const comWhatsapp = s.tem('whatsapp');
  const [f, setF] = useState({ prazo: b.prazo, lembrete: b.lembrete, canalLembrete: b.canalLembrete, canalCodigo: b.canalCodigo });
  const salvar = useAcao((corpo: typeof f) => api('PATCH', `/balcoes/${b.id}`, corpo), [chaves.balcao(b.id), chaves.balcoes, chaves.historico(b.id)]);
  const canal = (k: 'canalLembrete' | 'canalCodigo', rotulo: string) => (
    <label className="tr-campo">
      <span className="tr-campo__rotulo">{rotulo}</span>
      <select className="tr-campo__entrada" value={comWhatsapp ? f[k] : 'email'} disabled={!comWhatsapp} onChange={(e) => setF({ ...f, [k]: e.target.value as CanalCodigo })}>
        <option value="email">E-mail</option>
        <option value="whatsapp">WhatsApp</option>
      </select>
    </label>
  );
  return (
    <form
      className="cartao"
      style={{ gap: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        await salvar.mutateAsync(f);
        fechar('Configurações do balcão salvas.');
      }}
    >
      <h2 className="titulo-2">Prazo e lembretes</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16, alignItems: 'end' }}>
        <label className="tr-campo">
          <span className="tr-campo__rotulo">Prazo</span>
          <input className="tr-campo__entrada" type="date" required value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} />
        </label>
        {canal('canalCodigo', 'Código de acesso por')}
        {f.lembrete && canal('canalLembrete', 'Lembretes por')}
      </div>
      <label className="linha" style={{ fontSize: 15, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.lembrete} onChange={(e) => setF({ ...f, lembrete: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#13594b' }} />
        Lembretes automáticos (3 dias antes do prazo, no dia e 2 dias depois)
      </label>
      {!b.cliente.email && (f.canalCodigo === 'email' || (f.lembrete && f.canalLembrete === 'email')) && <p className="miudo" style={{ color: 'var(--recusado)' }}>Este cliente não tem e-mail cadastrado: escolha o WhatsApp.</p>}
      <AvisoErro erro={salvar.error} />
      <div className="linha">
        <button type="submit" className="tr-btn tr-btn--primario tr-btn--sm" disabled={salvar.isPending}>
          Salvar
        </button>
        <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => fechar('')}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** ZIP com os originais. O worker monta; a tela atualiza sozinha até ficar pronto. */
function Exportar({ b }: { b: BalcaoDetalhe }) {
  const pedir = useAcao(() => api('POST', `/balcoes/${b.id}/exportar`), [chaves.balcao(b.id), chaves.historico(b.id)]);
  const [erro, setErro] = useState<unknown>(null);
  const e = b.exportacao;
  if (b.arquivosApagadosEm) return null;
  return (
    <span className="linha" style={{ gap: 8 }}>
      {e?.status === 'pronta' ? (
        <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" onClick={() => abrirUrl(() => api<{ url: string }>('GET', `/balcoes/${b.id}/exportacao/url`)).catch(setErro)}>
          <Icone nome="baixar" />
          Baixar ZIP
        </button>
      ) : (
        <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" disabled={pedir.isPending || e?.status === 'pendente'} onClick={() => pedir.mutate()}>
          <Icone nome="baixar" />
          {e?.status === 'pendente' ? 'Montando o ZIP…' : e?.status === 'falhou' ? 'Tentar o ZIP de novo' : 'Baixar tudo (ZIP)'}
        </button>
      )}
      <AvisoErro erro={erro ?? pedir.error} />
    </span>
  );
}

export function Conferir() {
  const { id = '' } = useParams();
  const s = useSessao();
  const local = useLocation();
  const navegar = useNavigate();
  const consulta = useBalcao(id);
  const uso = useCobranca().data;
  const [selId, setSelId] = useState<string | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [config, setConfig] = useState(false);
  const [aba, setAba] = useState<'docs' | 'historico'>('docs');
  const historico = useHistorico(id, aba === 'historico');
  const [toast, avisar] = useToast();
  const recarregar = [chaves.balcao(id), chaves.balcoes, chaves.cobranca, chaves.historico(id)];
  const aprovar = useAcao((itemId: string) => api('POST', `/itens/${itemId}/aprovar`), recarregar);
  const recusar = useAcao((x: { itemId: string; motivo: string }) => api('POST', `/itens/${x.itemId}/recusar`, { motivo: x.motivo }), recarregar);
  const concluir = useAcao(() => api('POST', `/balcoes/${id}/concluir`), recarregar);
  const reabrir = useAcao(() => api('POST', `/balcoes/${id}/reabrir`), recarregar);
  const lembrar = useAcao(() => api<{ canal: CanalCodigo }>('POST', `/balcoes/${id}/lembrar`), recarregar);
  const novoLink = useAcao(() => api<LinkGerado>('POST', `/balcoes/${id}/link`), recarregar);
  const encerrar = useAcao(() => api('DELETE', `/balcoes/${id}/sessoes`), recarregar);
  const arquivar = useAcao(() => api('POST', `/balcoes/${id}/arquivar`), recarregar);
  const apagarArquivo = useAcao((docId: string) => api('DELETE', `/documentos/${docId}`), recarregar);

  // Aviso vindo de outra tela (por exemplo, "Lista salva").
  const avisoDaNavegacao = (local.state as { aviso?: string } | null)?.aviso;
  useEffect(() => {
    if (avisoDaNavegacao) {
      avisar(avisoDaNavegacao);
      navegar(local.pathname, { replace: true, state: null });
    }
  }, [avisoDaNavegacao, avisar, navegar, local.pathname]);

  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  const b = consulta.data;
  const nome = primeiroNome(b.cliente.nome);
  const sel = b.itens.find((i) => i.id === selId) ?? b.itens.find((i) => i.status === 'analise') ?? b.itens[0];
  const aberto = !b.concluidoEm;
  const soConfere = s.tem('permissoes') && s.usuario.permissao === 'confere';
  const podeConcluir = b.itens.every((i) => !i.obrigatorio || i.status === 'aprovado');
  const noLimite = s.plano.limiteBalcoes !== null && (uso?.balcoesAtivos ?? 0) >= s.plano.limiteBalcoes;
  const dias = diasRetencao(s.plano.id, s.organizacao.diasRetencao);
  const erro = aprovar.error ?? recusar.error ?? concluir.error ?? reabrir.error ?? lembrar.error ?? novoLink.error ?? encerrar.error ?? arquivar.error ?? apagarArquivo.error;
  // Aberto e esquecido: o worker arquiva 30 dias depois do prazo.
  const arquivaEm = new Date(new Date(`${b.prazo}T00:00:00Z`).getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const prazoPassou = aberto && new Date(`${b.prazo}T00:00:00Z`).getTime() < Date.now();
  const canalLembrete = b.canalLembrete === 'whatsapp' && s.tem('whatsapp') ? 'WhatsApp' : 'e-mail';

  return (
    <>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Link to="/app" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start' }}>
          <Icone nome="voltar" />
          Balcões
        </Link>
        <div className="linha linha--entre" style={{ alignItems: 'flex-end', gap: 20 }}>
          <div className="coluna" style={{ gap: 6 }}>
            <div className="linha" style={{ gap: 12 }}>
              <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>{b.cliente.nome}</h1>
              {b.tipo && <span className="tr-etiqueta">{b.tipo}</span>}
              {!aberto && (b.arquivadoEm ? <Status status="pendente" texto="Arquivado" /> : <Status status="aprovado" texto="Concluído" />)}
            </div>
            <span className="tr-protocolo texto-suave">
              {b.protocolo} · WhatsApp final {b.cliente.whatsappFinal} · prazo {dataLonga(b.prazo)}
              {aberto && (b.lembrete ? ` · lembretes por ${canalLembrete}` : ' · sem lembretes')}
            </span>
          </div>
          <div className="linha">
            {aberto && !soConfere ? (
              <>
                <Link to={`/app/balcao/${b.id}/lista`} className="tr-btn tr-btn--secundario tr-btn--sm">
                  Editar lista
                </Link>
                <Link to={`/app/balcao/${b.id}/link`} className="tr-btn tr-btn--secundario tr-btn--sm">
                  Link do cliente
                </Link>
                <button
                  type="button"
                  className="tr-btn tr-btn--secundario tr-btn--sm"
                  disabled={lembrar.isPending}
                  onClick={async () => {
                    const r = await lembrar.mutateAsync();
                    avisar(`Lembrete enviado para ${nome} por ${r.canal === 'whatsapp' ? 'WhatsApp' : 'e-mail'}. Os links anteriores continuam valendo.`);
                  }}
                >
                  Lembrar {nome}
                </button>
                <button
                  type="button"
                  className="tr-btn tr-btn--primario tr-btn--sm"
                  disabled={!podeConcluir || concluir.isPending}
                  title={podeConcluir ? undefined : 'Disponível quando todos os documentos obrigatórios forem aprovados'}
                  onClick={async () => {
                    await concluir.mutateAsync();
                    avisar(`Balcão concluído. O acesso de ${nome} foi encerrado e os arquivos serão apagados em ${dias} dias.`);
                  }}
                >
                  Concluir balcão
                </button>
                <button
                  type="button"
                  className="tr-btn tr-btn--discreto tr-btn--sm"
                  disabled={arquivar.isPending}
                  onClick={async () => {
                    if (!window.confirm(`Arquivar o balcão de ${nome}? Ele deixa de contar como ativo, o acesso de ${nome} é encerrado e os arquivos serão apagados em ${dias} dias. Dá para reabrir antes disso.`)) return;
                    await arquivar.mutateAsync();
                    avisar(`Balcão arquivado. Os arquivos serão apagados em ${dias} dias.`);
                  }}
                >
                  Arquivar
                </button>
              </>
            ) : (
              !aberto &&
              !soConfere && (
                <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" disabled={noLimite || !!b.arquivosApagadosEm || reabrir.isPending} onClick={() => reabrir.mutate()}>
                  Reabrir balcão
                </button>
              )
            )}
          </div>
        </div>
        <div className="linha linha--entre" style={{ gap: 16, alignItems: 'center' }}>
          <div style={{ flex: '1 1 320px', maxWidth: 520 }}>
            <Progresso feitos={b.contagem.aprovado} total={b.contagem.total} />
          </div>
          <span className="linha" style={{ gap: 4 }}>
            {!soConfere && <Exportar b={b} />}
            {aberto && !soConfere && (
              <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => setConfig(!config)}>
                <Icone nome="ajustes" />
                Prazo e lembretes
              </button>
            )}
          </span>
        </div>
        {b.arquivosApagadosEm ? (
          <div className="aviso">
            <Icone nome="info" />
            <span>Os arquivos deste balcão foram apagados em {dataLonga(b.arquivosApagadosEm.slice(0, 10))}, pela política de retenção da conta.</span>
          </div>
        ) : (
          b.apagarArquivosEm && (
            <div className="aviso">
              <Icone nome="relogio" />
              <span>Os arquivos deste balcão serão apagados em {dataLonga(b.apagarArquivosEm.slice(0, 10), true)}, pela retenção do plano. Se precisar guardar, baixe o ZIP antes.</span>
            </div>
          )
        )}
        {prazoPassou && (
          <div className="aviso aviso--plano">
            <Icone nome="relogio" />
            <span>O prazo passou. Se o balcão continuar aberto, ele será arquivado sozinho a partir de {dataLonga(arquivaEm, true)} (30 dias depois do prazo), sempre com aviso por e-mail uma semana antes. Para evitar, mude o prazo em "Prazo e lembretes".</span>
          </div>
        )}
        {aberto && !soConfere && (
          <div className="aviso" style={{ alignItems: 'center' }}>
            <Icone nome="cadeado" />
            <span style={{ flex: 1 }}>
              {b.sessoesCliente > 0
                ? `${nome} está conectado em ${b.sessoesCliente === 1 ? '1 aparelho' : `${b.sessoesCliente} aparelhos`} (o acesso vale 30 dias).`
                : b.link
                  ? `${nome} ainda não entrou com o código, ou o acesso foi encerrado.`
                  : 'Este balcão está sem link ativo.'}
            </span>
            {b.sessoesCliente > 0 && (
            <button
              type="button"
              className="tr-btn tr-btn--discreto tr-btn--sm"
              disabled={encerrar.isPending}
              onClick={async () => {
                if (!window.confirm(`Encerrar o acesso de ${nome}? O link continua valendo, mas ele vai precisar de um código novo para entrar.`)) return;
                await encerrar.mutateAsync();
                avisar('Acesso encerrado em todos os aparelhos.');
              }}
            >
              Encerrar acesso
            </button>
            )}
            <button
              type="button"
              className="tr-btn tr-btn--discreto tr-btn--sm"
              disabled={novoLink.isPending}
              onClick={async () => {
                if (!window.confirm('Gerar um link novo e cancelar todos os anteriores? Os links já enviados param de valer e o acesso de todos os aparelhos é encerrado. (Para só mandar o link de novo, use "Link do cliente".)')) return;
                navegar(`/app/balcao/${b.id}/link`, { state: { link: await novoLink.mutateAsync() } });
              }}
            >
              Cancelar links e gerar novo
            </button>
          </div>
        )}
        {config && <Configuracoes key={b.id} b={b} fechar={(t) => (setConfig(false), t && avisar(t))} />}
        <AvisoErro erro={erro} />
      </header>

      <div role="tablist" className="abas">
        <button type="button" role="tab" className="aba" aria-selected={aba === 'docs'} onClick={() => setAba('docs')}>
          Documentos
        </button>
        <button type="button" role="tab" className="aba" aria-selected={aba === 'historico'} onClick={() => setAba('historico')}>
          Histórico
        </button>
      </div>

      {aba === 'historico' ? (
        historico.isPending ? (
          <Carregando />
        ) : (
          <div className="tabela-caixa">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>O que fez</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {(historico.data ?? []).map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{e.ator}</td>
                    <td>{ACOES[e.acao] ?? e.acao}</td>
                    <td className="tr-protocolo texto-suave">{e.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <ul style={{ flex: '1 1 340px', minWidth: 0, listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {b.itens.map((d) => {
              const ativo = d.id === sel.id;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelId(d.id);
                      setRecusando(false);
                    }}
                    aria-current={ativo}
                    style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: ativo ? '13px 15px' : '14px 16px', borderRadius: 12, border: ativo ? '2px solid var(--mangue)' : '1px solid var(--linha)', background: 'var(--areia-elevada)', color: 'var(--tinta)' }}
                  >
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500 }}>{d.nome}</span>
                      <span className="miudo texto-suave">
                        {d.documento?.status === 'quarentena'
                          ? 'Verificando o arquivo…'
                          : d.documento?.status === 'rejeitado'
                            ? 'Último envio rejeitado na verificação'
                            : (d.documento?.nomeArquivo ?? (d.historico.length ? 'Pedido de novo' : d.obrigatorio ? 'Ainda não enviado' : 'Se tiver'))}
                      </span>
                    </span>
                    <Status status={d.status} />
                  </button>
                </li>
              );
            })}
          </ul>

          <section className="cartao" style={{ flex: '999 1 520px', minWidth: 0, gap: 20 }} aria-label="Documento selecionado">
            <div className="linha linha--entre" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div className="coluna" style={{ gap: 4 }}>
                <h2 className="titulo-2">{sel.nome}</h2>
                <span className="pequeno texto-suave">{sel.detalhe}</span>
              </div>
              <Status status={sel.status} />
            </div>

            {sel.documento ? (
              <Arquivo key={sel.documento.id} item={sel} />
            ) : (
              <div style={{ background: 'var(--areia-funda)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
                <p className="texto-suave">{nome} ainda não enviou este documento.</p>
              </div>
            )}

            {aberto && sel.status === 'analise' && !recusando && (
              <div className="linha" style={{ gap: 10 }}>
                <button type="button" className="tr-btn tr-btn--primario" style={{ flex: '1 1 180px' }} disabled={aprovar.isPending} onClick={() => aprovar.mutate(sel.id)}>
                  <Icone nome="check" />
                  Aprovar
                </button>
                <button
                  type="button"
                  className="tr-btn tr-btn--secundario"
                  style={{ flex: '1 1 180px' }}
                  onClick={() => {
                    setMotivo('');
                    setRecusando(true);
                  }}
                >
                  Recusar
                </button>
              </div>
            )}

            {recusando && (
              <form
                style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 12, background: 'var(--recusado-suave)' }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  await recusar.mutateAsync({ itemId: sel.id, motivo: motivo.trim() });
                  setRecusando(false);
                  avisar(`${nome} vai ver a sua mensagem e pode enviar outro arquivo pelo mesmo link.`);
                }}
              >
                <label className="coluna">
                  <span className="miudo" style={{ fontWeight: 500 }}>
                    Diga a {nome} o que precisa mudar
                  </span>
                  <textarea className="entrada-texto" rows={3} required minLength={3} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: a foto ficou escura na parte de baixo. Pode tirar outra com mais luz?" />
                </label>
                <div className="linha">
                  <button type="submit" className="tr-btn tr-btn--primario tr-btn--sm" disabled={recusar.isPending}>
                    Recusar e avisar {nome}
                  </button>
                  <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => setRecusando(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {sel.status === 'aprovado' && <p className="pequeno texto-suave">Documento aprovado. {nome} já vê o item como aprovado.</p>}
            {sel.status === 'recusado' && sel.motivo && (
              <div className="tr-item__motivo" style={{ marginTop: 0 }}>
                Recusado: “{sel.motivo}”
              </div>
            )}
            <HistoricoItem item={sel} />
            {s.usuario.permissao === 'admin' && sel.documento && sel.documento.status === 'disponivel' && (
              <button
                type="button"
                className="tr-btn tr-btn--discreto tr-btn--sm"
                style={{ alignSelf: 'flex-start', color: 'var(--recusado)', paddingLeft: 0 }}
                onClick={() => window.confirm(`Apagar o arquivo "${sel.documento!.nomeArquivo}"? O item volta a ficar pendente.`) && apagarArquivo.mutate(sel.documento!.id)}
              >
                <Icone nome="lixo" />
                Apagar arquivo
              </button>
            )}
          </section>
        </div>
      )}
      {toast}
    </>
  );
}
