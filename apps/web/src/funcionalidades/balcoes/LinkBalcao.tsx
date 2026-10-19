import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { type LinkGerado } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves as chavesConsulta, useAcao, useBalcao, usePastas, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { dataLonga, diasAte, plural, prazoRelativo, primeiroNome } from '../../util/formatos';

export function LinkBalcao() {
  const { id = '' } = useParams();
  const local = useLocation();
  const navegar = useNavigate();
  const sessao = useSessao();
  const consulta = useBalcao(id);
  const pastas = usePastas().data ?? [];
  const estado = local.state as { link?: LinkGerado; criado?: boolean } | null;
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
  const ondeCodigo = b.canalCodigo === 'whatsapp' ? `no WhatsApp terminado em ${b.cliente.whatsappFinal}` : `em ${b.cliente.email}`;

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

  const lembretes = b.lembrete
    ? [-3, 0, 2].map((n) => somarDias(b.prazo, n)).filter((d) => diasAte(d) >= 0)
    : [];
  const pasta = pastas.find((p) => p.id === b.pastaId);
  const obrigatorios = b.itens.filter((i) => i.obrigatorio).length;

  return (
    <>
      <Link to="/app" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start', marginBottom: -12 }}>
        <Icone nome="voltar" />
        Início
      </Link>
      <div className="cabecalho-pagina">
        <div style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <span className="selo-ok">
            <Icone nome={estado?.criado ? 'check' : 'envio'} tamanho={24} />
          </span>
          <div className="coluna" style={{ gap: 2 }}>
            <h1 className="titulo-1">{estado?.criado ? 'Balcão criado' : 'Enviar o link'}</h1>
            <span className="pequeno texto-suave">
              {b.cliente.nome} · <span className="tr-protocolo">{b.protocolo}</span>
              {b.tipo && ` · ${b.tipo}`}
            </span>
          </div>
        </div>
        <div className="linha acoes-cabecalho" style={{ gap: 8 }}>
          {link && (
            <a href={link.url} target="_blank" rel="noreferrer" className="tr-btn tr-btn--discreto tr-btn--sm">
              Ver como o cliente
            </a>
          )}
          <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" onClick={() => navegar(`/app/balcao/${b.id}`)}>
            Abrir o balcão
          </button>
        </div>
      </div>

      <div className="link-grade">
        <div className="coluna" style={{ gap: 16 }}>
          <section className="cartao">
            <div className="coluna" style={{ gap: 4 }}>
              <h2 className="titulo-2">Mande o link para {nome}</h2>
              <p className="pequeno texto-suave">Ao abrir, {nome} recebe um código {ondeCodigo}. Depois, o celular fica conectado por 30 dias.</p>
            </div>

            {link ? (
              <>
                <div className="coluna" style={{ gap: 6 }}>
                  <div className="campo-link">
                    <span className="tr-protocolo">{link.url.replace(/^https?:\/\//, '')}</span>
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
                      {copiado ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <span className="miudo texto-suave">Vale até {dataLonga(link.expiraEm.slice(0, 10))}. Por segurança, a Trames guarda só uma impressão digital do link: ele aparece só agora.</span>
                </div>
                <label className="coluna" style={{ gap: 6 }}>
                  <span className="miudo" style={{ fontWeight: 500 }}>
                    Mensagem (o link entra no fim)
                  </span>
                  <textarea className="entrada-texto" rows={4} value={texto} onChange={(e) => setMensagem(e.target.value)} style={{ background: 'var(--areia)' }} />
                </label>
                <AvisoErro erro={erro ?? porEmail.error} />
                {aviso && (
                  <div className="aviso" role="status">
                    <Icone nome="check" />
                    {aviso}
                  </div>
                )}
                <div className="linha" style={{ gap: 10 }}>
                  <button type="button" className="tr-btn tr-btn--primario" style={{ flex: '1 1 180px' }} disabled={b.concluidoEm !== null} onClick={abrirWhatsapp}>
                    Enviar pelo WhatsApp
                  </button>
                  <button
                    type="button"
                    className="tr-btn tr-btn--secundario"
                    style={{ flex: '1 1 180px' }}
                    disabled={porEmail.isPending || !b.cliente.email}
                    onClick={async () => {
                      setMensagem(texto);
                      await porEmail.mutateAsync(texto);
                      setAviso(`Mandamos o link para ${b.cliente.email}.`);
                    }}
                  >
                    Enviar por e-mail
                  </button>
                </div>
                <span className="miudo texto-suave">“Enviar pelo WhatsApp” abre o seu WhatsApp com a mensagem pronta; quem envia é você. Pelo e-mail, a Trames envia para {b.cliente.email}.</span>
              </>
            ) : (
              <>
                <p className="pequeno">
                  A Trames não guarda os links, só uma impressão digital deles: um link já enviado não aparece de novo. Gere um para mandar agora. Os que você já mandou continuam valendo, e {nome} continua conectado.
                </p>
                <AvisoErro erro={emitir.error} />
                <button type="button" className="tr-btn tr-btn--primario" style={{ alignSelf: 'flex-start' }} disabled={emitir.isPending || !!b.concluidoEm} onClick={async () => setLink(await emitir.mutateAsync())}>
                  Gerar link para enviar
                </button>
              </>
            )}
          </section>

          <section className="cartao cartao--fundo">
            <h2 className="titulo-cartao">O que acontece agora</h2>
            <ol className="passos">
              <li>
                <strong>{nome} abre o link</strong>
                <span>e entra com o código que chega {ondeCodigo}. Não precisa criar conta.</span>
              </li>
              <li>
                <strong>Envia os documentos pelo celular</strong>
                <span>Cada arquivo passa pelo antivírus antes de aparecer para você.</span>
              </li>
              <li>
                <strong>Você confere aqui</strong>
                <span>Aprove ou recuse cada documento; se recusar, {nome} vê o motivo e manda outro pelo mesmo link.</span>
              </li>
              <li>
                <strong>{lembretes.length ? 'Lembretes automáticos' : b.lembrete ? 'Lembretes' : 'Sem lembretes automáticos'}</strong>
                <span>
                  {lembretes.length
                    ? `Se ainda faltar documento obrigatório, ${nome} recebe um lembrete por ${b.canalLembrete === 'whatsapp' && sessao.tem('whatsapp') ? 'WhatsApp' : 'e-mail'} em ${lembretes.map((d) => dataLonga(d)).join(', ').replace(/, ([^,]*)$/, ' e $1')}.`
                    : b.lembrete
                      ? 'As datas dos lembretes já passaram. Mude o prazo no balcão para recomeçar.'
                      : 'Dá para ligar na tela do balcão, em Prazo e lembretes.'}
                </span>
              </li>
            </ol>
          </section>
        </div>

        <div className="coluna" style={{ gap: 16 }}>
          <section className="cartao">
            <h2 className="titulo-cartao">Resumo</h2>
            <dl className="resumo">
              <dt>Cliente</dt>
              <dd>{b.cliente.nome}</dd>
              <dt>E-mail</dt>
              <dd>{b.cliente.email}</dd>
              <dt>WhatsApp</dt>
              <dd>final {b.cliente.whatsappFinal}</dd>
              <dt>Prazo</dt>
              <dd>
                {dataLonga(b.prazo, true)} <span className="texto-suave">({diasAte(b.prazo) < 0 ? `venceu ${prazoRelativo(b.prazo)}` : diasAte(b.prazo) === 0 ? 'hoje' : `daqui a ${plural(diasAte(b.prazo), 'dia', 'dias')}`})</span>
              </dd>
              <dt>Código por</dt>
              <dd>{b.canalCodigo === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</dd>
              {pasta && (
                <>
                  <dt>Pasta</dt>
                  <dd>
                    <span className="linha" style={{ gap: 6 }}>
                      <span style={{ color: pasta.cor, display: 'inline-flex' }}>
                        <Icone nome="pasta" tamanho={16} />
                      </span>
                      {pasta.nome}
                    </span>
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className="cartao">
            <div className="linha linha--entre">
              <h2 className="titulo-cartao">Documentos pedidos</h2>
              <span className="miudo texto-suave">
                {b.itens.length} · {obrigatorios} {obrigatorios === 1 ? 'obrigatório' : 'obrigatórios'}
              </span>
            </div>
            <ul className="documentos-pedidos">
              {b.itens.map((i) => (
                <li key={i.id}>
                  <span>{i.nome}</span>
                  {!i.obrigatorio && <span className="miudo texto-suave">se tiver</span>}
                </li>
              ))}
            </ul>
            {!b.concluidoEm && (
              <Link to={`/app/balcao/${b.id}/lista`} className="pequeno" style={{ fontWeight: 500, alignSelf: 'flex-start' }}>
                Editar lista
              </Link>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/** Data (AAAA-MM-DD) n dias depois de outra. */
function somarDias(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
