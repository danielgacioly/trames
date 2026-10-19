import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { type LinkGerado } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves as chavesConsulta, useAcao, useBalcao, usePastas, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { useTermo } from '../../ui/termo';
import { dataLonga, diasAte, plural, prazoRelativo, primeiroNome } from '../../util/formatos';

export function LinkBalcao() {
  const { id = '' } = useParams();
  const local = useLocation();
  const navegar = useNavigate();
  const sessao = useSessao();
  const consulta = useBalcao(id);
  const t = useTermo();
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
    t(`Olá, ${nome}. Aqui é ${primeiroNome(sessao.usuario.nome)}, do ${sessao.organizacao.nome}. Abrimos um balcão para reunir os documentos${b.tipo ? ` de ${b.tipo.toLowerCase()}` : ''} (protocolo ${b.protocolo}). Por este link você vê a lista e envia tudo pelo celular:`);
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

  const dias = diasAte(b.prazo);
  const relativo = dias < 0 ? `venceu ${prazoRelativo(b.prazo)}` : dias === 0 ? 'hoje' : `daqui a ${plural(dias, 'dia', 'dias')}`;
  const canalLembrete = b.canalLembrete === 'whatsapp' && sessao.tem('whatsapp') ? 'WhatsApp' : 'e-mail';

  return (
    <>
      <header className="criado-topo">
        <div className="criado-topo__titulo">
          <Link to="/app" className="tr-btn tr-btn--discreto tr-btn--sm" aria-label="Voltar para o Início" style={{ padding: '0 8px' }}>
            <Icone nome="voltar" />
          </Link>
          <span className="selo-ok" aria-hidden="true">
            <Icone nome={estado?.criado ? 'check' : 'envio'} tamanho={20} />
          </span>
          <div className="coluna" style={{ gap: 0, minWidth: 0 }}>
            <h1 className="titulo-2">{estado?.criado ? 'Balcão criado' : 'Enviar o link'}</h1>
            <span className="miudo texto-suave">
              {b.cliente.nome} · <span className="tr-protocolo">{b.protocolo}</span>
              {b.tipo && ` · ${b.tipo}`}
            </span>
          </div>
        </div>
        <div className="linha" style={{ gap: 8 }}>
          {link && (
            <a href={link.url} target="_blank" rel="noreferrer" className="tr-btn tr-btn--discreto tr-btn--sm">
              Ver como o cliente
            </a>
          )}
          <button type="button" className="tr-btn tr-btn--secundario tr-btn--sm" onClick={() => navegar(`/app/balcao/${b.id}`)}>
            Abrir o balcão
          </button>
        </div>
      </header>

      <div className="criado-grade">
        <section className="cartao criado-envio" aria-label="Enviar o link">
          <div className="coluna" style={{ gap: 2 }}>
            <h2 className="titulo-cartao">Mande o link para {nome}</h2>
            <p className="miudo texto-suave">Ao abrir, {nome} recebe um código {ondeCodigo}. Cada vez que abrir o link, chega um código novo.</p>
          </div>

          {link ? (
            <>
              <div className="coluna" style={{ gap: 6 }}>
                <div className="campo-link campo-link--destaque">
                  <span className="tr-protocolo">{link.url.replace(/^https?:\/\//, '')}</span>
                  <button
                    type="button"
                    className={`tr-btn tr-btn--sm ${copiado ? 'tr-btn--secundario' : 'tr-btn--primario'}`}
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
              <div className="criado-envio__botoes">
                <button type="button" className="tr-btn tr-btn--primario" disabled={b.concluidoEm !== null} onClick={abrirWhatsapp}>
                  Enviar pelo WhatsApp
                </button>
                <button
                  type="button"
                  className="tr-btn tr-btn--secundario"
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
              <AvisoErro erro={erro ?? porEmail.error} />
              {aviso && (
                <div className="aviso" role="status">
                  <Icone nome="check" />
                  {aviso}
                </div>
              )}
              <label className="coluna" style={{ gap: 6 }}>
                <span className="tr-campo__rotulo">Mensagem (o link entra no fim)</span>
                <textarea className="entrada-texto criado-envio__mensagem" rows={2} value={texto} onChange={(e) => setMensagem(e.target.value)} />
                <span className="miudo texto-suave">“Enviar pelo WhatsApp” abre o seu WhatsApp com a mensagem pronta; quem envia é você. Pelo e-mail, a Trames envia para {b.cliente.email}.</span>
              </label>
            </>
          ) : (
            <>
              <p className="pequeno">
                A Trames não guarda os links, só uma impressão digital deles: um link já enviado não aparece de novo. Gere um para mandar agora. Os que você já mandou continuam valendo.
              </p>
              <AvisoErro erro={emitir.error} />
              <button type="button" className="tr-btn tr-btn--primario" style={{ alignSelf: 'flex-start' }} disabled={emitir.isPending || !!b.concluidoEm} onClick={async () => setLink(await emitir.mutateAsync())}>
                Gerar link para enviar
              </button>
            </>
          )}
        </section>

        <section className="criado-resumo" aria-label="Resumo do balcão">
          <div className="criado-resumo__grupo">
            <span className="rotulo">Cliente</span>
            <strong>{b.cliente.nome}</strong>
            <span className="miudo texto-suave">{b.cliente.email}</span>
            <span className="miudo texto-suave">
              WhatsApp final <span className="num">{b.cliente.whatsappFinal}</span>
            </span>
          </div>
          <div className="criado-resumo__grupo">
            <span className="rotulo">Prazo e lembretes</span>
            <span>
              {dataLonga(b.prazo, true)} <span className="texto-suave">({relativo})</span>
            </span>
            <span className="miudo texto-suave">
              {lembretes.length
                ? `Lembretes por ${canalLembrete} em ${lembretes.map((d) => dataLonga(d)).join(', ').replace(/, ([^,]*)$/, ' e $1')}`
                : b.lembrete
                  ? 'As datas dos lembretes já passaram'
                  : 'Sem lembretes automáticos'}
            </span>
          </div>
          <div className="criado-resumo__grupo">
            <span className="rotulo">Acesso</span>
            <span>Código por {b.canalCodigo === 'whatsapp' ? 'WhatsApp' : 'e-mail'}</span>
            <span className="miudo texto-suave">Um código novo a cada entrada; o acesso dura até 1 dia.</span>
          </div>
          {pasta && (
            <div className="criado-resumo__grupo">
              <span className="rotulo">Pasta</span>
              <span className="linha" style={{ gap: 6 }}>
                <span style={{ color: pasta.cor, display: 'inline-flex' }}>
                  <Icone nome="pasta" tamanho={16} />
                </span>
                {pasta.nome}
              </span>
            </div>
          )}
        </section>
      </div>

      <section className="criado-docs" aria-label="Documentos pedidos">
        <div className="linha linha--entre" style={{ gap: 12 }}>
          <div className="linha" style={{ gap: 10, alignItems: 'baseline' }}>
            <h2 className="titulo-cartao">Documentos pedidos</h2>
            <span className="miudo texto-suave">
              <span className="num">{b.itens.length}</span> no total · <span className="num">{obrigatorios}</span> {obrigatorios === 1 ? 'obrigatório' : 'obrigatórios'}
            </span>
          </div>
          {!b.concluidoEm && (
            <Link to={`/app/balcao/${b.id}/lista`} className="tr-btn tr-btn--secundario tr-btn--sm">
              Editar lista
            </Link>
          )}
        </div>
        <ol className="criado-docs__lista">
          {b.itens.map((i, k) => (
            <li key={i.id}>
              <span className="num texto-suave">{String(k + 1).padStart(2, '0')}</span>
              <span className="criado-docs__nome">
                {i.nome}
                {i.detalhe && <span className="miudo texto-suave">{i.detalhe}</span>}
              </span>
              {i.obrigatorio ? <span className="ponto ponto--aprovado">Obrigatório</span> : <span className="miudo texto-suave">Se tiver</span>}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

/** Data (AAAA-MM-DD) n dias depois de outra. */
function somarDias(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
