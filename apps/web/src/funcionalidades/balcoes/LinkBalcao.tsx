import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { type LinkGerado } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves as chavesConsulta, useAcao, useBalcao, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { dataLonga, primeiroNome } from '../../util/formatos';

export function LinkBalcao() {
  const { id = '' } = useParams();
  const local = useLocation();
  const navegar = useNavigate();
  const sessao = useSessao();
  const consulta = useBalcao(id);
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
      <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', background: 'var(--areia-elevada)', border: '1px solid var(--linha)', borderRadius: 14, padding: 'clamp(20px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 22, boxShadow: 'var(--shadow-lg)' }}>
        <div className="coluna" style={{ gap: 14 }}>
          <span style={{ width: 52, height: 52, borderRadius: 9999, background: 'var(--mangue-suave)', color: 'var(--mangue)', display: 'grid', placeItems: 'center' }}>
            <Icone nome="check" tamanho={26} />
          </span>
          <h1 style={{ fontSize: 32, lineHeight: '38px', letterSpacing: '-.02em' }}>{estado?.criado ? 'Balcão criado' : `Link do balcão de ${nome}`}</h1>
          <p className="subtitulo">
            Agora é só mandar o link para {nome}. Quando abrir, vamos pedir um código que chega {ondeCodigo}. Depois disso, o celular dele fica conectado por 30 dias.
          </p>
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
