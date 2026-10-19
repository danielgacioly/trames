import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { LinkGerado } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useBalcao, useSessao } from '../../dados/consultas';
import { AreaTexto, AvisoErro, Botao, BotaoLink, Carregando, Linha, Nota, Pagina, Secao, useNotificar } from '../../ui';
import { dataLonga, primeiroNome } from '../../util/formatos';

/**
 * Enviar o link do balcão. O banco guarda só o hash de cada link, então um link
 * só aparece na hora em que é gerado; para mandar de novo, gera-se outro.
 */
export function EnviarLink() {
  const { id = '' } = useParams();
  const local = useLocation();
  const s = useSessao();
  const notificar = useNotificar();
  const consulta = useBalcao(id);
  const [link, setLink] = useState<LinkGerado | null>((local.state as { link?: LinkGerado } | null)?.link ?? null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const emitir = useAcao(() => api<LinkGerado>('POST', `/balcoes/${id}/links`), [chaves.balcao(id), chaves.historico(id)]);
  const porEmail = useAcao((m: string) => api('POST', `/balcoes/${id}/enviar-link`, { mensagem: m, url: link!.url }), [chaves.historico(id)]);

  if (consulta.isPending) return <Carregando />;
  if (consulta.error)
    return (
      <Pagina titulo="Enviar link">
        <AvisoErro erro={consulta.error} />
      </Pagina>
    );
  const b = consulta.data;
  const nome = primeiroNome(b.cliente.nome);
  const encerrado = !!b.concluidoEm;
  const texto =
    mensagem ??
    `Olá, ${nome}. Aqui é ${primeiroNome(s.usuario.nome)}, do ${s.organizacao.nome}. Abrimos um balcão para reunir os documentos${b.tipo ? ` de ${b.tipo.toLowerCase()}` : ''} (protocolo ${b.protocolo}). Por este link você vê a lista e envia tudo pelo celular:`;
  const ondeCodigo = b.canalCodigo === 'whatsapp' ? `no WhatsApp terminado em ${b.cliente.whatsappFinal}` : `em ${b.cliente.email}`;

  function copiar() {
    navigator.clipboard?.writeText(link!.url).catch(() => {});
    api('POST', `/balcoes/${id}/registrar-envio`, { canal: 'copiado' }).catch(() => {});
    notificar({ titulo: 'Link copiado' });
  }

  /** Abre o WhatsApp do escritório com a mensagem pronta. A janela abre antes da resposta para o navegador não bloquear. */
  async function whatsapp() {
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

  async function email() {
    setErro(null);
    try {
      await porEmail.mutateAsync(texto);
      notificar({ titulo: 'Link enviado', texto: `Mandamos para ${b.cliente.email}.` });
    } catch (e) {
      setErro(e);
    }
  }

  return (
    <Pagina
      estreita
      voltar={{ para: `/app/balcao/${b.id}`, rotulo: b.cliente.nome }}
      titulo="Enviar link"
      subtitulo={`Ao abrir, ${nome} recebe um código ${ondeCodigo}. Depois, o celular fica conectado por 30 dias.`}
      ferramentas={<BotaoLink to={`/app/balcao/${b.id}`}>Ir para o balcão</BotaoLink>}
    >
      {encerrado && <Nota>Este balcão está encerrado. Reabra o balcão para enviar um link novo.</Nota>}
      <AvisoErro erro={erro ?? emitir.error} />

      {link ? (
        <>
          <Secao titulo="Link" nota={`Vale até ${dataLonga(link.expiraEm.slice(0, 10))}. Por segurança, a Trames guarda só a impressão digital do link: ele aparece só agora.`}>
            <div className="linha">
              <span className="linha__corpo mono corta">{link.url.replace(/^https?:\/\//, '')}</span>
              <Botao icone="copiar" onClick={copiar}>
                Copiar
              </Botao>
            </div>
          </Secao>

          <Secao titulo="Mensagem" nota="O link entra no fim da mensagem.">
            <div className="linha" style={{ padding: 6 }}>
              <AreaTexto aria-label="Mensagem" rows={4} value={texto} onChange={(e) => setMensagem(e.target.value)} style={{ border: 0, boxShadow: 'none', resize: 'none' }} />
            </div>
          </Secao>

          <div className="pilha">
            <div className="fila">
              <Botao variante="primario" grande disabled={encerrado} onClick={whatsapp}>
                Abrir no WhatsApp
              </Botao>
              <Botao grande disabled={encerrado || porEmail.isPending} onClick={email}>
                {porEmail.isPending ? 'Enviando…' : 'Enviar por e-mail'}
              </Botao>
              <a href={link.url} target="_blank" rel="noreferrer" className="pequeno" style={{ marginLeft: 'auto' }}>
                Ver como o cliente
              </a>
            </div>
            <p className="pequeno secundario">“Abrir no WhatsApp” abre o seu WhatsApp com a mensagem pronta; quem envia é você. Pelo e-mail, a Trames envia para {b.cliente.email}.</p>
          </div>
        </>
      ) : (
        <Secao nota={`Os links que você já mandou continuam valendo e ${nome} continua conectado. Para mandar de novo, gere um link.`}>
          <Linha tom="acao" titulo={emitir.isPending ? 'Gerando…' : 'Gerar link para enviar'} onClick={encerrado || emitir.isPending ? undefined : async () => setLink(await emitir.mutateAsync())} />
        </Secao>
      )}
    </Pagina>
  );
}
