import { useEffect, useState } from 'react';
import type { BalcaoDetalhe, DocumentoDto, ItemDetalhe } from '@trames/shared';
import { api } from '../../../dados/api';
import { useSessao } from '../../../dados/consultas';
import { Botao, Icone, Menu, Nota, Status, useDialogos } from '../../../ui';
import { dataLonga, diasAte, primeiroNome, quandoEnviado, tamanhoLegivel } from '../../../util/formatos';
import { baixarOriginal, type AcoesBalcao } from './acoes';

/** Linha curta embaixo do nome do item, na lista. */
function resumo(d: ItemDetalhe) {
  if (d.documento?.status === 'quarentena') return 'Verificando o arquivo…';
  if (d.documento?.status === 'rejeitado') return 'Envio rejeitado na verificação';
  if (d.documento) return d.documento.nomeArquivo;
  if (d.historico.length) return 'Pedido de novo';
  return d.obrigatorio ? 'Não enviado' : 'Não enviado · se tiver';
}

function Miniatura({ d }: { d: DocumentoDto }) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    setUrl(null);
    if (!d.temMiniatura) return;
    api<{ url: string }>('GET', `/documentos/${d.id}/miniatura`).then((r) => setUrl(r.url), () => setFalhou(true));
  }, [d.id, d.temMiniatura]);
  if (url) return <img src={url} alt={`Miniatura de ${d.nomeArquivo}`} />;
  return (
    <div className="vazio" style={{ padding: 24 }}>
      <Icone nome="envio" />
      <span className="mono">{d.nomeArquivo}</span>
      <span className="pequeno">{!d.temMiniatura || falhou ? 'Sem miniatura. Baixe o original para conferir.' : 'Carregando a miniatura…'}</span>
    </div>
  );
}

/** O que aparece na "folha" da visualização, conforme a situação do arquivo. */
function Folha({ item, nome }: { item: ItemDetalhe; nome: string }) {
  const d = item.documento;
  if (!d) return <p className="vazio">{nome} ainda não enviou este documento.</p>;
  if (d.status === 'quarentena') return <p className="vazio">O arquivo chegou e está passando pelo antivírus. Em instantes ele aparece aqui.</p>;
  if (d.status === 'apagado') return <p className="vazio">Este arquivo foi apagado.</p>;
  if (d.status === 'rejeitado') return <p className="vazio">O último envio foi rejeitado na verificação (tipo não aceito ou ameaça encontrada). {nome} precisa enviar outro.</p>;
  return <Miniatura d={d} />;
}

export function Documentos({ b, acoes: a, irParaDetalhes }: { b: BalcaoDetalhe; acoes: AcoesBalcao; irParaDetalhes: () => void }) {
  const s = useSessao();
  const { confirmar, pedirTexto } = useDialogos();
  const [selId, setSelId] = useState<string | null>(null);
  const nome = primeiroNome(b.cliente.nome);
  const aberto = !b.concluidoEm;
  const admin = s.usuario.permissao === 'admin';
  const sel = b.itens.find((i) => i.id === selId) ?? b.itens.find((i) => i.status === 'analise') ?? b.itens[0];
  const doc = sel.documento?.status === 'disponivel' ? sel.documento : null;
  const prazoVencido = aberto && diasAte(b.prazo) < 0;

  /** Depois de aprovar ou recusar, vai para o próximo item que espera conferência. */
  function proximo() {
    const k = b.itens.indexOf(sel);
    const resto = [...b.itens.slice(k + 1), ...b.itens.slice(0, k)];
    const p = resto.find((i) => i.status === 'analise');
    if (p) setSelId(p.id);
  }

  async function aprovar() {
    if ((await a.executar(() => a.aprovar.mutateAsync(sel.id), `“${sel.nome}” aprovado`)).ok) proximo();
  }

  async function recusar() {
    const motivo = await pedirTexto({
      titulo: `Recusar “${sel.nome}”`,
      texto: `${nome} vê a mensagem e pode enviar outro arquivo pelo mesmo link.`,
      rotulo: `O que precisa mudar`,
      dica: 'Ex.: a foto ficou escura na parte de baixo. Pode tirar outra com mais luz?',
      minimo: 3,
      confirmar: 'Recusar',
      perigo: true,
    });
    if (!motivo) return;
    if ((await a.executar(() => a.recusar.mutateAsync({ itemId: sel.id, motivo }), `“${sel.nome}” recusado`)).ok) proximo();
  }

  async function apagar(d: DocumentoDto) {
    const ok = await confirmar({ titulo: `Apagar “${d.nomeArquivo}”?`, texto: 'O arquivo sai do storage e o item volta a ficar pendente. Não dá para desfazer.', confirmar: 'Apagar', perigo: true });
    if (ok) await a.executar(() => a.apagarArquivo.mutateAsync(d.id), 'Arquivo apagado');
  }

  return (
    <>
      {b.arquivosApagadosEm ? (
        <Nota>Os arquivos deste balcão foram apagados em {dataLonga(b.arquivosApagadosEm.slice(0, 10))}, pela retenção da conta.</Nota>
      ) : (
        prazoVencido && (
          <Nota>
            O prazo venceu. Sem mudança, o balcão é arquivado 30 dias depois do prazo, com aviso uma semana antes.{' '}
            <button type="button" className="botao botao--simples" style={{ height: 'auto', padding: 0 }} onClick={irParaDetalhes}>
              Mudar o prazo
            </button>
          </Nota>
        )
      )}

      <div className="conferir">
        <div className="grupo conferir__lista" role="listbox" aria-label="Documentos do balcão">
          {b.itens.map((d) => (
            <button key={d.id} type="button" role="option" aria-selected={d.id === sel.id} className={`linha${d.id === sel.id ? ' linha--ativa' : ''}`} onClick={() => setSelId(d.id)}>
              <span className="linha__corpo">
                <span className="corta" style={{ fontWeight: d.status === 'analise' ? 600 : 400 }}>
                  {d.nome}
                </span>
                <span className="linha__sub corta">{resumo(d)}</span>
              </span>
              <Status status={d.status} />
            </button>
          ))}
        </div>

        <section className="visualizacao" aria-label="Documento selecionado">
          <header className="visualizacao__cabeca">
            <div className="pilha" style={{ gap: 2, minWidth: 0 }}>
              <h2 className="titulo-secao" style={{ fontSize: 15 }}>
                {sel.nome}
                {!sel.obrigatorio && <span className="terciario" style={{ fontWeight: 400 }}> · se tiver</span>}
              </h2>
              {sel.detalhe && <p className="pequeno secundario">{sel.detalhe}</p>}
            </div>
            <div className="fila" style={{ flexWrap: 'nowrap' }}>
              <Status status={sel.status} />
              <Menu
                rotulo="Ações do arquivo"
                itens={[
                  doc && { rotulo: 'Baixar original', icone: 'baixar', acao: () => a.executar(() => baixarOriginal(doc.id)) },
                  ...sel.historico.map((h) => ({ rotulo: `Anterior: ${h.nomeArquivo}`, icone: 'relogio' as const, acao: () => a.executar(() => baixarOriginal(h.id)) })),
                  admin && doc && 'separador',
                  admin && doc && { rotulo: 'Apagar arquivo…', icone: 'lixo', perigo: true, acao: () => apagar(doc) },
                ]}
              />
            </div>
          </header>

          {sel.status === 'recusado' && sel.motivo && (
            <div style={{ padding: '10px 16px 0' }}>
              <p className="motivo">Recusado: “{sel.motivo}”</p>
            </div>
          )}

          <div className="visualizacao__folha">
            <Folha item={sel} nome={nome} />
          </div>

          <footer className="visualizacao__rodape">
            <span className="pequeno secundario corta" style={{ minWidth: 0 }}>
              {sel.documento ? `${quandoEnviado(sel.documento.enviadoEm)} · ${tamanhoLegivel(sel.documento.tamanho)}` : 'Sem arquivo'}
              {sel.historico.length > 0 && ` · ${sel.historico.length} ${sel.historico.length === 1 ? 'anterior' : 'anteriores'} no menu “…”`}
            </span>
            {aberto && sel.status === 'analise' ? (
              <div className="fila">
                <Botao onClick={recusar} disabled={a.recusar.isPending}>
                  Recusar…
                </Botao>
                <Botao variante="primario" icone="check" onClick={aprovar} disabled={a.aprovar.isPending}>
                  Aprovar
                </Botao>
              </div>
            ) : (
              doc && (
                <Botao icone="baixar" onClick={() => a.executar(() => baixarOriginal(doc.id))}>
                  Baixar original
                </Botao>
              )
            )}
          </footer>
        </section>
      </div>
    </>
  );
}
