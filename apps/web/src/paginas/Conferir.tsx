import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ItemDetalhe, LinkGerado } from '@trames/shared';
import { api } from '../dados/api';
import { chaves, useAcao, useBalcao, useCobranca, useHistorico, useSessao } from '../dados/consultas';
import { AvisoErro, Carregando, Progresso, Status, useToast } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { dataLonga, primeiroNome, quandoEnviado, tamanhoLegivel } from '../util';

const ACOES: Record<string, string> = {
  'balcao.criado': 'criou o balcão',
  'balcao.concluido': 'concluiu o balcão',
  'balcao.reaberto': 'reabriu o balcão',
  'link.criado': 'gerou um link',
  'link.revogado': 'revogou o link',
  'link.enviado': 'enviou o link',
  'lembrete.enviado': 'mandou um lembrete',
  'cliente.entrou': 'entrou com o código',
  'cliente.codigo_errado': 'errou o código',
  'documento.enviado': 'enviou um arquivo',
  'documento.verificado': 'liberou o arquivo (antivírus e tipo conferidos)',
  'documento.rejeitado': 'rejeitou o arquivo na verificação',
  'documento.viu': 'abriu um arquivo',
  'documento.baixou': 'baixou um arquivo',
  'documento.aprovou': 'aprovou um documento',
  'documento.recusou': 'recusou um documento',
  'documento.apagou': 'apagou um arquivo',
  'retencao.apagou': 'apagou os arquivos (retenção)',
};

/** Abre o arquivo por uma URL assinada que vale ~60 segundos. Cada abertura fica na auditoria. */
async function abrirArquivo(documentoId: string, modo: 'ver' | 'baixar') {
  const janela = window.open('', '_blank');
  const { url } = await api<{ url: string }>('GET', `/documentos/${documentoId}/url?modo=${modo}`);
  if (janela) janela.location.href = url;
  else window.location.href = url;
}

function Arquivo({ item }: { item: ItemDetalhe }) {
  const d = item.documento!;
  const [miniatura, setMiniatura] = useState<string | null>(null);
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
        {miniatura ? (
          <img src={miniatura} alt={`Miniatura de ${d.nomeArquivo}`} style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 4, boxShadow: 'var(--shadow-sm)' }} />
        ) : (
          <>
            <Icone nome="envio" tamanho={32} />
            <span className="tr-protocolo">{d.nomeArquivo}</span>
            <span className="miudo texto-suave">
              {d.tipo === 'application/pdf' ? 'PDF' : 'Imagem'} · {tamanhoLegivel(d.tamanho)}
            </span>
          </>
        )}
        <div className="linha">
          <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" onClick={() => abrirArquivo(d.id, 'ver').catch(setErro)}>
            Abrir arquivo
          </button>
          <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => abrirArquivo(d.id, 'baixar').catch(setErro)}>
            Baixar
          </button>
          {d.temMiniatura && !miniatura && (
            <button
              type="button"
              className="tr-btn tr-btn--discreto tr-btn--sm"
              onClick={() =>
                api<{ url: string }>('GET', `/documentos/${d.id}/miniatura`)
                  .then((r) => setMiniatura(r.url))
                  .catch(setErro)
              }
            >
              Ver miniatura
            </button>
          )}
        </div>
      </div>
      <AvisoErro erro={erro} />
      <div className="linha linha--entre pequeno texto-suave">
        <span className="tr-protocolo">{d.nomeArquivo}</span>
        <span>{quandoEnviado(d.enviadoEm)}</span>
      </div>
    </div>
  );
}

export function Conferir() {
  const { id = '' } = useParams();
  const s = useSessao();
  const navegar = useNavigate();
  const consulta = useBalcao(id);
  const ativos = useCobranca().data?.balcoesAtivos ?? 0;
  const [selId, setSelId] = useState<string | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [aba, setAba] = useState<'docs' | 'historico'>('docs');
  const historico = useHistorico(id, aba === 'historico');
  const [toast, avisar] = useToast();
  const recarregar = [chaves.balcao(id), chaves.balcoes, chaves.cobranca, chaves.historico(id)];
  const aprovar = useAcao((itemId: string) => api('POST', `/itens/${itemId}/aprovar`), recarregar);
  const recusar = useAcao((x: { itemId: string; motivo: string }) => api('POST', `/itens/${x.itemId}/recusar`, { motivo: x.motivo }), recarregar);
  const concluir = useAcao(() => api('POST', `/balcoes/${id}/concluir`), recarregar);
  const reabrir = useAcao(() => api('POST', `/balcoes/${id}/reabrir`), recarregar);
  const lembrar = useAcao(() => api('POST', `/balcoes/${id}/lembrar`), recarregar);
  const novoLink = useAcao(() => api<LinkGerado>('POST', `/balcoes/${id}/link`), recarregar);
  const apagarArquivo = useAcao((docId: string) => api('DELETE', `/documentos/${docId}`), recarregar);

  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  const b = consulta.data;
  const nome = primeiroNome(b.cliente.nome);
  const sel = b.itens.find((i) => i.id === selId) ?? b.itens.find((i) => i.status === 'analise') ?? b.itens[0];
  const aberto = !b.concluidoEm;
  const soConfere = s.tem('permissoes') && s.usuario.permissao === 'confere';
  const podeConcluir = b.itens.every((i) => !i.obrigatorio || i.status === 'aprovado');
  const noLimite = s.plano.limiteBalcoes !== null && ativos >= s.plano.limiteBalcoes;
  const erro = aprovar.error ?? recusar.error ?? concluir.error ?? reabrir.error ?? lembrar.error ?? novoLink.error ?? apagarArquivo.error;

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
              {!aberto && <Status status="aprovado" texto="Concluído" />}
            </div>
            <span className="tr-protocolo texto-suave">
              {b.protocolo} · WhatsApp final {b.cliente.whatsappFinal} · prazo {dataLonga(b.prazo)}
              {b.lembrete && aberto && ' · lembrete automático a cada 3 dias'}
            </span>
          </div>
          <div className="linha">
            {aberto && !soConfere ? (
              <>
                <button
                  type="button"
                  className="tr-btn tr-btn--secundario tr-btn--sm"
                  disabled={novoLink.isPending}
                  onClick={async () => navegar(`/app/balcao/${b.id}/link`, { state: { link: await novoLink.mutateAsync() } })}
                >
                  Gerar link novo
                </button>
                <button
                  type="button"
                  className="tr-btn tr-btn--secundario tr-btn--sm"
                  disabled={lembrar.isPending}
                  onClick={async () => {
                    await lembrar.mutateAsync();
                    avisar(`Lembrete com um link novo enviado para ${nome}. O link anterior deixa de valer.`);
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
                    avisar('Balcão concluído. Ele não conta mais no limite do plano e o link do cliente foi desativado.');
                  }}
                >
                  Concluir balcão
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
        <div style={{ maxWidth: 520 }}>
          <Progresso feitos={b.contagem.aprovado} total={b.contagem.total} />
        </div>
        {b.arquivosApagadosEm && (
          <div className="aviso">
            <Icone nome="info" />
            <span>Os arquivos deste balcão foram apagados em {dataLonga(b.arquivosApagadosEm.slice(0, 10))}, pela política de retenção da conta.</span>
          </div>
        )}
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
                      <span className="miudo texto-suave">{d.documento?.status === 'quarentena' ? 'Verificando o arquivo…' : d.documento?.status === 'rejeitado' ? 'Último envio rejeitado na verificação' : (d.documento?.nomeArquivo ?? (d.obrigatorio ? 'Ainda não enviado' : 'Se tiver'))}</span>
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
