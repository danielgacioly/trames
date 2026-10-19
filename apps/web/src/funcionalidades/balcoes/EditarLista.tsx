import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BalcaoDetalhe } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useBalcao } from '../../dados/consultas';
import { AvisoErro, Botao, BotaoLink, Carregando, Nota, Pagina, Status, useDialogos, useNotificar } from '../../ui';
import { primeiroNome } from '../../util/formatos';
import { juntar, ListaDocumentos, novaChave, PuxarModelo, type Item } from './ListaDocumentos';

const itensDoBalcao = (b: BalcaoDetalhe): Item[] =>
  b.itens.map((i) => ({ chave: novaChave(), id: i.id, nome: i.nome, detalhe: i.detalhe, obrigatorio: i.obrigatorio, status: i.status, temArquivo: !!i.documento || i.historico.length > 0 }));

export function EditarLista() {
  const { id = '' } = useParams();
  const consulta = useBalcao(id);
  if (consulta.isPending) return <Carregando />;
  if (consulta.error)
    return (
      <Pagina titulo="Editar lista">
        <AvisoErro erro={consulta.error} />
      </Pagina>
    );
  // Monta uma vez: as atualizações automáticas do balcão não apagam o que está sendo editado.
  return <Editor key={id} b={consulta.data} />;
}

function Editor({ b }: { b: BalcaoDetalhe }) {
  const navegar = useNavigate();
  const { confirmar } = useDialogos();
  const notificar = useNotificar();
  const [original] = useState(() => itensDoBalcao(b));
  const [itens, setItens] = useState<Item[]>(original);
  const [removidos, setRemovidos] = useState<Item[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const recarregar = useAcao(async () => undefined, [chaves.balcao(b.id), chaves.balcoes, chaves.historico(b.id)]);
  const nome = primeiroNome(b.cliente.nome);
  const voltar = `/app/balcao/${b.id}`;

  if (b.concluidoEm)
    return (
      <Pagina estreita voltar={{ para: voltar, rotulo: b.cliente.nome }} titulo="Editar lista">
        <Nota>Este balcão está encerrado. Para mudar a lista, reabra o balcão.</Nota>
      </Pagina>
    );

  async function remover(d: Item) {
    if (itens.length <= 1) return setErro(new Error('O balcão precisa de pelo menos um documento.'));
    if (d.id && d.temArquivo) {
      const ok = await confirmar({
        titulo: `Tirar “${d.nome}” da lista?`,
        texto: `Este item já tem arquivo enviado. Ele sai da lista de ${nome}, mas o arquivo fica guardado até a retenção do balcão.`,
        confirmar: 'Tirar da lista',
        perigo: true,
      });
      if (!ok) return;
    }
    setItens((atual) => atual.filter((x) => x.chave !== d.chave));
    if (d.id) setRemovidos((r) => [...r, d]);
  }

  async function salvar() {
    setErro(null);
    const lista = itens.filter((i) => i.id || i.nome.trim());
    if (lista.some((i) => !i.nome.trim())) return setErro(new Error('Todo documento precisa de um nome.'));
    if (!lista.length) return setErro(new Error('O balcão precisa de pelo menos um documento.'));
    setSalvando(true);
    try {
      for (const r of removidos) await api('DELETE', `/itens/${r.id}?confirmar=1`);
      for (const i of lista) {
        const antes = original.find((o) => o.id === i.id);
        if (!antes) continue;
        const mudou = antes.nome !== i.nome || antes.detalhe !== i.detalhe || antes.obrigatorio !== i.obrigatorio;
        if (mudou || i.pedirDeNovo) await api('PATCH', `/itens/${i.id}`, { nome: i.nome.trim(), detalhe: i.detalhe.trim(), obrigatorio: i.obrigatorio, pedirDeNovo: !!i.pedirDeNovo });
      }
      const novos = lista.filter((i) => !i.id);
      const ids = new Map<number, string>();
      if (novos.length) {
        const r = await api<{ ids: string[] }>('POST', `/balcoes/${b.id}/itens`, { itens: novos.map((n) => ({ nome: n.nome.trim(), detalhe: n.detalhe.trim(), obrigatorio: n.obrigatorio })) });
        novos.forEach((n, k) => ids.set(n.chave, r.ids[k]));
      }
      const ordem = lista.map((i) => i.id ?? ids.get(i.chave)!);
      const ordemServidor = [...original.filter((o) => !removidos.some((r) => r.id === o.id)).map((o) => o.id!), ...novos.map((n) => ids.get(n.chave)!)];
      if (ordem.join() !== ordemServidor.join()) await api('PUT', `/balcoes/${b.id}/ordem`, { ids: ordem });
      await recarregar.mutateAsync();
      const avisa = novos.length > 0 || lista.some((i) => i.pedirDeNovo);
      notificar({ titulo: 'Lista salva', texto: avisa ? `${nome} recebe um e-mail com o que mudou em até 10 minutos.` : undefined });
      navegar(voltar);
    } catch (e) {
      setErro(e);
      setSalvando(false);
    }
  }

  return (
    <Pagina
      estreita
      voltar={{ para: voltar, rotulo: b.cliente.nome }}
      titulo="Editar lista"
      subtitulo={`${nome} vê a lista nova na próxima vez que abrir o link.`}
      ferramentas={
        <>
          <BotaoLink to={voltar}>Cancelar</BotaoLink>
          <Botao variante="primario" disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <AvisoErro erro={erro} />
      <section className="secao">
        <ListaDocumentos
          itens={itens}
          mudar={setItens}
          remover={remover}
          rodape={<PuxarModelo adicionar={(novos) => setItens(juntar(itens, novos))} />}
          extra={(d) => (
            <div className="item-editor__extra">
              {d.id ? (
                <>
                  {d.status && <Status status={d.status} />}
                  {d.status && d.status !== 'pendente' && (
                    <label>
                      <input type="checkbox" className="caixa" checked={!!d.pedirDeNovo} onChange={(e) => setItens(itens.map((x) => (x.chave === d.chave ? { ...x, pedirDeNovo: e.target.checked } : x)))} />
                      Pedir de novo
                    </label>
                  )}
                </>
              ) : (
                <span className="status status--pendente">Novo</span>
              )}
            </div>
          )}
        />
        <p className="secao__nota">Se você incluir um documento ou pedir algum de novo, {nome} recebe um e-mail (as mudanças de 10 minutos vão juntas). “Pedir de novo” guarda o arquivo atual no histórico e volta o item para pendente.</p>
      </section>
    </Pagina>
  );
}
