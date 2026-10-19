import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ModeloDto as Modelo } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useModelos, useSessao } from '../../dados/consultas';
import { AvisoErro, Bloqueio, Carregando } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { comChave, ListaDocumentos, type Item } from '../balcoes/ListaDocumentos';

export function EditorModelo() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const sessao = useSessao();
  const consulta = useModelos();
  if (!sessao.tem('modelosProprios')) return <Bloqueio recurso="modelosProprios" />;
  if (consulta.isPending) return <Carregando />;
  // Um modelo do escritório ou um pronto da área: os dois se editam aqui (o pronto vira a versão do escritório).
  const existente = consulta.data?.find((m) => m.id === id);
  const base = existente ?? consulta.data?.find((m) => m.id === params.get('base'));
  return <FormularioModelo key={id ?? 'novo'} existente={existente} base={base} />;
}

function FormularioModelo({ existente, base }: { existente?: Modelo; base?: Modelo }) {
  const navegar = useNavigate();
  const [nome, setNome] = useState(existente?.nome ?? (base ? `${base.nome} (cópia)` : ''));
  const [quando, setQuando] = useState(base?.quando ?? '');
  const [itens, setItens] = useState<Item[]>(() => comChave(base?.itens ?? []));
  const salvar = useAcao(
    (corpo: unknown) => (existente ? api('PUT', `/modelos/${existente.id}`, corpo) : api('POST', '/modelos', corpo)),
    [chaves.modelos],
  );
  const excluir = useAcao(() => api('DELETE', `/modelos/${existente!.id}`), [chaves.modelos]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await salvar.mutateAsync({ nome: nome.trim(), quando: quando.trim(), itens: itens.map(({ chave: _, ...it }) => it) });
    navegar('/app/modelos');
  }

  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const obrigatorios = itens.filter((i) => i.obrigatorio).length;
  const tamanho = (v: string, minimo: number) => ({ size: Math.max(v.length, minimo) + 1 });

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header className="linha" style={{ gap: 12 }}>
        <Link to="/app/modelos" className="tr-btn tr-btn--discreto tr-btn--sm">
          <Icone nome="voltar" />
          Modelos
        </Link>
        {base && !existente && <span className="tr-etiqueta">Cópia de {base.nome}</span>}
      </header>
      <AvisoErro erro={salvar.error ?? excluir.error} />

      <div className="folha-pedido">
        <div className="folha">
          <div className="folha__frase">
            <span className="rotulo">{existente ? 'Editar modelo' : 'Novo modelo'}</span>
            <p className="frase">
              Modelo{' '}
              <input aria-label="Nome do modelo" placeholder="nome do modelo" required minLength={2} autoFocus={!existente} value={nome} onChange={(e) => setNome(e.target.value)} {...tamanho(nome, 14)} />
            </p>
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Quando usar</span>
              <input className="tr-campo__entrada" value={quando} onChange={(e) => setQuando(e.target.value)} placeholder="Uma frase para a equipe escolher o modelo certo" />
              <span className="tr-campo__dica">O nome do modelo vira o tipo de caso dos balcões abertos a partir dele.</span>
            </label>
          </div>
          <section className={`etapa${itens.length ? ' etapa--feita' : ''}`}>
            <span className="etapa__marca">{itens.length ? <Icone nome="check" tamanho={16} /> : 1}</span>
            <div className="etapa__corpo">
              <div className="etapa__cabeca">
                <h2>Documentos que o cliente vai mandar</h2>
                <p className="pequeno texto-suave">Ao abrir um balcão a partir deste modelo, ainda dá para tirar ou acrescentar itens.</p>
              </div>
              <ListaDocumentos itens={itens} mudar={setItens} />
            </div>
          </section>
        </div>

        <aside className="painel-pedido" aria-label="Resumo do modelo">
          <div className="cartao" style={{ gap: 14 }}>
            <div className="coluna" style={{ gap: 2 }}>
              <strong style={{ fontSize: 18, fontWeight: 500 }}>{nome.trim() || 'Modelo sem nome'}</strong>
              <span className="pequeno texto-suave">
                {itens.length} {itens.length === 1 ? 'documento' : 'documentos'}
                {itens.length > 0 && ` · ${obrigatorios} ${obrigatorios === 1 ? 'obrigatório' : 'obrigatórios'}`}
              </span>
            </div>
            <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" disabled={!itens.length || salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : existente ? 'Salvar alterações' : 'Criar modelo'}
            </button>
            {existente && !existente.proprio && <span className="miudo texto-suave">É um modelo pronto da Trames. A edição vale só para o escritório, e dá para voltar ao original quando quiser.</span>}
            {existente?.proprio &&
              (confirmarExclusao ? (
                <div className="aviso aviso--erro" style={{ flexDirection: 'column', gap: 10 }}>
                  <span>{existente.baseId ? `Voltar ao modelo original? As suas mudanças em ${existente.nome} se perdem.` : `Excluir ${existente.nome}?`} Os balcões já abertos com ele não mudam.</span>
                  <div className="linha" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="tr-btn tr-btn--sm"
                      style={{ background: 'var(--recusado)', color: '#fff' }}
                      disabled={excluir.isPending}
                      onClick={async () => {
                        await excluir.mutateAsync();
                        navegar('/app/modelos');
                      }}
                    >
                      {existente.baseId ? 'Voltar ao original' : 'Excluir'}
                    </button>
                    <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => setConfirmarExclusao(false)}>
                      Manter
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ color: 'var(--recusado)', alignSelf: 'center' }} onClick={() => setConfirmarExclusao(true)}>
                  <Icone nome="lixo" />
                  {existente.baseId ? 'Voltar ao original' : 'Excluir modelo'}
                </button>
              ))}
          </div>
        </aside>
      </div>
    </form>
  );
}
