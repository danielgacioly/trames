import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { BalcaoDetalhe } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves as chavesConsulta, useAcao, useBalcao } from '../../dados/consultas';
import { AvisoErro, Carregando, Status } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { primeiroNome } from '../../util/formatos';
import { comChave, ListaDocumentos, novaChave, novoItem, PuxarModelo, type Item } from './ListaDocumentos';

const itensDoBalcao = (b: BalcaoDetalhe): Item[] =>
  b.itens.map((i) => ({ chave: novaChave(), id: i.id, nome: i.nome, detalhe: i.detalhe, obrigatorio: i.obrigatorio, status: i.status, temArquivo: !!i.documento || i.historico.length > 0 }));

export function EditarLista() {
  const { id = '' } = useParams();
  const consulta = useBalcao(id);
  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  // Monta uma vez: as atualizações automáticas do balcão não apagam o que está sendo editado.
  return <EditorLista key={id} b={consulta.data} />;
}

function EditorLista({ b }: { b: BalcaoDetalhe }) {
  const navegar = useNavigate();
  const [original] = useState(() => itensDoBalcao(b));
  const [itens, setItens] = useState<Item[]>(original);
  const [removidos, setRemovidos] = useState<Item[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const recarregar = useAcao(async () => undefined, [chavesConsulta.balcao(b.id), chavesConsulta.balcoes, chavesConsulta.historico(b.id)]);
  const nome = primeiroNome(b.cliente.nome);

  if (b.concluidoEm) {
    return (
      <div className="coluna" style={{ gap: 16 }}>
        <Link to={`/app/balcao/${b.id}`} className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start' }}>
          <Icone nome="voltar" />
          Voltar
        </Link>
        <div className="aviso">
          <Icone nome="cadeado" />
          <span>Este balcão está concluído. Para mudar a lista, reabra o balcão.</span>
        </div>
      </div>
    );
  }

  function remover(d: Item) {
    if (itens.length <= 1) return setErro(new Error('O balcão precisa de pelo menos um documento.'));
    if (d.id && d.temArquivo && !window.confirm(`"${d.nome}" já tem arquivo enviado. Tirar da lista? O arquivo sai da lista de ${nome}, mas fica guardado até a retenção do balcão.`)) return;
    setItens(itens.filter((x) => x.chave !== d.chave));
    if (d.id) setRemovidos([...removidos, d]);
  }

  async function salvar() {
    setErro(null);
    if (itens.some((i) => !i.nome.trim())) return setErro(new Error('Todo documento precisa de um nome.'));
    setSalvando(true);
    try {
      for (const r of removidos) await api('DELETE', `/itens/${r.id}?confirmar=1`);
      for (const i of itens) {
        const antes = original.find((o) => o.id === i.id);
        if (!antes) continue;
        const mudou = antes.nome !== i.nome || antes.detalhe !== i.detalhe || antes.obrigatorio !== i.obrigatorio;
        if (mudou || i.pedirDeNovo) await api('PATCH', `/itens/${i.id}`, { nome: i.nome.trim(), detalhe: i.detalhe.trim(), obrigatorio: i.obrigatorio, pedirDeNovo: !!i.pedirDeNovo });
      }
      const novos = itens.filter((i) => !i.id);
      const ids = new Map<number, string>();
      if (novos.length) {
        const r = await api<{ ids: string[] }>('POST', `/balcoes/${b.id}/itens`, { itens: novos.map((n) => ({ nome: n.nome.trim(), detalhe: n.detalhe.trim(), obrigatorio: n.obrigatorio })) });
        novos.forEach((n, k) => ids.set(n.chave, r.ids[k]));
      }
      const ordem = itens.map((i) => i.id ?? ids.get(i.chave)!);
      const ordemServidor = [...original.filter((o) => !removidos.some((r) => r.id === o.id)).map((o) => o.id!), ...novos.map((n) => ids.get(n.chave)!)];
      if (ordem.join() !== ordemServidor.join()) await api('PUT', `/balcoes/${b.id}/ordem`, { ids: ordem });
      await recarregar.mutateAsync();
      navegar(`/app/balcao/${b.id}`, { state: { aviso: novos.length || itens.some((i) => i.pedirDeNovo) ? `Lista salva. ${nome} recebe um e-mail com o que mudou em até 10 minutos.` : 'Lista salva.' } });
    } catch (e) {
      setErro(e);
      setSalvando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header className="linha linha--entre" style={{ gap: 16 }}>
        <div className="linha" style={{ gap: 16, minWidth: 0 }}>
          <Link to={`/app/balcao/${b.id}`} className="tr-btn tr-btn--discreto tr-btn--sm">
            <Icone nome="voltar" />
            {b.cliente.nome}
          </Link>
          <span style={{ width: 1, height: 24, background: 'var(--linha)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>Editar lista</span>
        </div>
        <div className="linha">
          <Link to={`/app/balcao/${b.id}`} className="tr-btn tr-btn--discreto">
            Cancelar
          </Link>
          <button type="button" className="tr-btn tr-btn--primario" disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar lista'}
          </button>
        </div>
      </header>
      <AvisoErro erro={erro} />
      <section className="cartao">
        <div className="coluna" style={{ gap: 4 }}>
          <h2 className="titulo-2">Documentos de {nome}</h2>
          <p className="pequeno texto-suave">
            {nome} vê a lista nova na próxima vez que abrir o link. Se você incluir um documento ou pedir algum de novo, ele recebe um e-mail avisando (as mudanças de 10 minutos vão juntas).
          </p>
        </div>
        <ListaDocumentos
          itens={itens}
          mudar={setItens}
          remover={remover}
          extra={(d) =>
            d.id ? (
              <div className="linha miudo" style={{ gap: 10, padding: '2px 6px' }}>
                {d.status && <Status status={d.status} />}
                {d.status && d.status !== 'pendente' && (
                  <label className="linha" style={{ gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!d.pedirDeNovo} onChange={(e) => setItens(itens.map((x) => (x.chave === d.chave ? { ...x, pedirDeNovo: e.target.checked } : x)))} style={{ accentColor: '#13594b' }} />
                    Pedir de novo (o arquivo atual vai para o histórico)
                  </label>
                )}
              </div>
            ) : (
              <span className="miudo" style={{ padding: '2px 6px', color: 'var(--mangue)', fontWeight: 500 }}>
                Novo · entra como pendente
              </span>
            )
          }
        />
        <div className="linha">
          <button type="button" className="tr-btn tr-btn--secundario" onClick={() => setItens([...itens, novoItem()])}>
            <Icone nome="mais" />
            Adicionar documento
          </button>
          <PuxarModelo adicionar={(novos) => setItens([...itens, ...comChave(novos.filter((n) => !itens.some((i) => i.nome === n.nome)))])} />
        </div>
      </section>
    </div>
  );
}
