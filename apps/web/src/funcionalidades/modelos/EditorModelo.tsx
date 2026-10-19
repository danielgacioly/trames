import { useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ModeloDto } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useModelos, useSessao } from '../../dados/consultas';
import { AvisoErro, Bloqueado, Botao, BotaoLink, Carregando, Entrada, Linha, LinhaCampo, Pagina, Secao, useDialogos, useNotificar } from '../../ui';
import { plural } from '../../util/formatos';
import { comChave, ListaDocumentos, type Item } from '../balcoes/ListaDocumentos';

export function EditorModelo() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const s = useSessao();
  const consulta = useModelos();
  if (!s.tem('modelosProprios'))
    return (
      <Pagina estreita voltar={{ para: '/app/modelos', rotulo: 'Modelos' }} titulo="Novo modelo">
        <Bloqueado recurso="modelosProprios" />
      </Pagina>
    );
  if (consulta.isPending) return <Carregando />;
  const existente = consulta.data?.find((m) => m.id === id && m.proprio);
  const base = existente ?? consulta.data?.find((m) => m.id === params.get('base'));
  return <Formulario key={id ?? params.get('base') ?? 'novo'} existente={existente} base={base} />;
}

function Formulario({ existente, base }: { existente?: ModeloDto; base?: ModeloDto }) {
  const navegar = useNavigate();
  const { confirmar } = useDialogos();
  const notificar = useNotificar();
  const [nome, setNome] = useState(existente?.nome ?? (base ? `${base.nome} (cópia)` : ''));
  const [quando, setQuando] = useState(base?.quando ?? '');
  const [itens, setItens] = useState<Item[]>(() => comChave(base?.itens ?? []));
  const salvar = useAcao((corpo: unknown) => (existente ? api('PUT', `/modelos/${existente.id}`, corpo) : api('POST', '/modelos', corpo)), [chaves.modelos]);
  const excluir = useAcao(() => api('DELETE', `/modelos/${existente!.id}`), [chaves.modelos]);
  const lista = itens.filter((i) => i.nome.trim());

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await salvar.mutateAsync({ nome: nome.trim(), quando: quando.trim(), itens: lista.map(({ nome, detalhe, obrigatorio }) => ({ nome: nome.trim(), detalhe: detalhe.trim(), obrigatorio })) });
    notificar({ titulo: existente ? 'Modelo salvo' : 'Modelo criado' });
    navegar('/app/modelos');
  }

  async function apagar() {
    if (!(await confirmar({ titulo: `Apagar o modelo “${existente!.nome}”?`, texto: 'Os balcões já abertos com ele não mudam.', confirmar: 'Apagar', perigo: true }))) return;
    await excluir.mutateAsync();
    notificar({ titulo: 'Modelo apagado' });
    navegar('/app/modelos');
  }

  return (
    <form onSubmit={enviar}>
      <Pagina
        estreita
        voltar={{ para: '/app/modelos', rotulo: 'Modelos' }}
        titulo={existente ? 'Editar modelo' : 'Novo modelo'}
        ferramentas={
          <>
            <BotaoLink to="/app/modelos">Cancelar</BotaoLink>
            <Botao type="submit" variante="primario" disabled={!lista.length || salvar.isPending}>
              Salvar
            </Botao>
          </>
        }
      >
        <AvisoErro erro={salvar.error ?? excluir.error} />
        <Secao>
          <LinhaCampo rotulo="Nome" id="nome">
            <Entrada id="nome" required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Inventário com imóvel rural" />
          </LinhaCampo>
          <LinhaCampo rotulo="Quando usar" id="quando">
            <Entrada id="quando" value={quando} onChange={(e) => setQuando(e.target.value)} placeholder="Uma frase para lembrar a equipe" />
          </LinhaCampo>
        </Secao>
        <section className="secao">
          <div className="secao__cabeca">
            <h2 className="titulo-secao">Documentos</h2>
            <span className="pequeno terciario">{plural(itens.length, 'item', 'itens')}</span>
          </div>
          <ListaDocumentos itens={itens} mudar={setItens} />
        </section>
        {existente && (
          <Secao>
            <Linha tom="perigo" titulo="Apagar modelo…" onClick={apagar} />
          </Secao>
        )}
      </Pagina>
    </form>
  );
}
