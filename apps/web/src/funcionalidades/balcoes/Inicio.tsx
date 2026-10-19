import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NOMES_AREA, type BalcaoResumo } from '@trames/shared';
import { useBalcoes, useModelos, usePastas, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando } from '../../ui/comuns';
import { Icone, type NomeIcone } from '../../ui/Icone';
import { diasAte, plural, primeiroNome, saudacao } from '../../util/formatos';
import { ListaBalcoes } from './ListaBalcoes';
import { busca, minhasPastas, ordenar, pastasDePessoa, pastasDeTipo, SITUACOES, type Pasta } from './pastas';
import { CartaoPasta, FormularioPasta } from './PastasUi';

/** Primeira vez na conta: ainda não há nenhum balcão. */
function PrimeiroAcesso() {
  const s = useSessao();
  const modelos = (useModelos().data ?? []).filter((m) => !m.proprio && m.area === s.organizacao.area).slice(0, 3);
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <div style={{ width: '100%', maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div className="coluna" style={{ gap: 10, textAlign: 'center', alignItems: 'center' }}>
          <h1 className="titulo-1">Seu espaço está pronto, {primeiroNome(s.usuario.nome)}</h1>
          <p className="texto-suave" style={{ fontSize: 18, lineHeight: '26px', maxWidth: 520 }}>
            Comece por um modelo de {NOMES_AREA[s.organizacao.area].toLowerCase()} ou monte um balcão do zero. Você pode mudar qualquer coisa depois.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          {modelos.map((m) => (
            <Link key={m.id} to={`/app/novo?modelo=${m.id}`} className="cartao" style={{ textDecoration: 'none', color: 'var(--tinta)', padding: 20, gap: 10, minHeight: 160, borderColor: 'var(--linha-forte)' }}>
              <span className="tr-etiqueta" style={{ alignSelf: 'flex-start' }}>
                Modelo
              </span>
              <span style={{ fontSize: 18, lineHeight: '24px', fontWeight: 500 }}>{m.nome}</span>
              <span className="pequeno texto-suave">
                {plural(m.itens.length, 'documento', 'documentos')}. {m.quando}
              </span>
            </Link>
          ))}
          <Link to="/app/novo" style={{ textDecoration: 'none', color: 'var(--mangue)', border: '1px dashed var(--mangue)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 160, textAlign: 'center' }}>
            <Icone nome="mais" tamanho={28} />
            <span style={{ fontWeight: 500 }}>Balcão em branco</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function AcaoRapida({ icone, titulo, texto, para, bloqueada }: { icone: NomeIcone; titulo: string; texto: string; para: string; bloqueada?: boolean }) {
  return (
    <Link to={para} className="acao-rapida">
      <span className="acao-rapida__icone">
        <Icone nome={bloqueada ? 'cadeado' : icone} tamanho={20} />
      </span>
      <span className="pasta__corpo">
        <span className="pasta__nome">{titulo}</span>
        <span className="miudo texto-suave">{texto}</span>
      </span>
    </Link>
  );
}

function GrupoDePastas({ titulo, texto, tres, children }: { titulo: string; texto?: string; tres?: boolean; children: ReactNode }) {
  return (
    <section className="grupo-pastas">
      <div className="grupo-pastas__cabeca">
        <h2>{titulo}</h2>
        {texto && <p className="pequeno texto-suave">{texto}</p>}
      </div>
      <div className={`pastas${tres ? ' pastas--tres' : ''}`}>{children}</div>
    </section>
  );
}

/** Conta de uma pasta: abertos (ou todos, nas encerradas) e quantos têm documento para conferir. */
const contar = (p: Pasta, balcoes: BalcaoResumo[]) => {
  const dela = balcoes.filter(p.teste);
  const base = p.porSituacao ? dela : dela.filter((b) => !b.concluidoEm);
  return { abertos: base.length, paraConferir: base.filter((b) => !b.concluidoEm && b.contagem.analise > 0).length };
};

/**
 * Início: ações rápidas, os balcões que pedem atenção agora e as pastas (por
 * situação, as do escritório, por tipo de caso e por pessoa). Buscar mostra os
 * balcões direto. A grade com todos fica em Balcões.
 */
export function Inicio() {
  const s = useSessao();
  const navegar = useNavigate();
  const consulta = useBalcoes();
  const pastas = usePastas().data ?? [];
  const [termo, setTermo] = useState('');
  const [criandoPasta, setCriandoPasta] = useState(false);
  const podeMontar = !(s.tem('permissoes') && s.usuario.permissao === 'confere');

  if (consulta.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  const todos = consulta.data;
  if (todos.length === 0 && podeMontar) return <PrimeiroAcesso />;

  const abertos = todos.filter((b) => !b.concluidoEm);
  const emAnalise = abertos.reduce((n, b) => n + b.contagem.analise, 0);
  const t = termo.trim().toLowerCase();
  const tipos = pastasDeTipo(todos);
  const pessoas = pastasDePessoa(todos);
  const minhas = minhasPastas(pastas);

  const atencao = ordenar(abertos.filter((b) => b.contagem.analise > 0 || diasAte(b.prazo) < 0));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">
            {saudacao()}, {primeiroNome(s.usuario.nome)}
          </h1>
          <p className="subtitulo">
            {plural(abertos.length, 'balcão aberto', 'balcões abertos')}
            {emAnalise > 0 ? `, ${plural(emAnalise, 'documento esperando', 'documentos esperando')} a sua conferência.` : '. Nada esperando a sua conferência.'}
          </p>
        </div>
        <label className="busca">
          <Icone nome="lupa" tamanho={18} />
          <input placeholder="Buscar cliente, protocolo ou tipo" aria-label="Buscar balcões" value={termo} onChange={(e) => setTermo(e.target.value)} />
        </label>
      </div>

      {t ? (
        <section className="grupo-pastas">
          <div className="grupo-pastas__cabeca grupo-pastas__cabeca--linha">
            <h2>Resultados</h2>
            <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => setTermo('')}>
              Limpar busca
            </button>
          </div>
          {(() => {
            const achados = ordenar(todos.filter((b) => busca(b, t)));
            return achados.length ? (
              <ListaBalcoes balcoes={achados} />
            ) : (
              <p className="texto-suave">Nenhum balcão encontrado.</p>
            );
          })()}
        </section>
      ) : (
        <>
          {podeMontar && (
            <section className="acoes-rapidas" aria-label="Ações rápidas">
              <AcaoRapida icone="mais" titulo="Novo balcão" texto="Do zero ou a partir de um modelo" para="/app/novo" />
              <AcaoRapida
                icone="modelos"
                titulo="Novo modelo"
                texto={s.tem('modelosProprios') ? 'A lista que você mais pede' : 'Faz parte do Pro e do Ultra'}
                para={s.tem('modelosProprios') ? '/app/modelos/novo' : '/app/modelos'}
                bloqueada={!s.tem('modelosProprios')}
              />
              <AcaoRapida icone="balcoes" titulo="Todos os balcões" texto="A grade completa, com filtros" para="/app/balcoes" />
            </section>
          )}

          {atencao.length > 0 && (
            <section className="grupo-pastas">
              <div className="grupo-pastas__cabeca grupo-pastas__cabeca--linha">
                <h2>Pedem a sua atenção</h2>
                <Link to="/app/balcoes" className="pequeno" style={{ fontWeight: 500 }}>
                  Ver todos os balcões
                </Link>
              </div>
              <ListaBalcoes balcoes={atencao.slice(0, 5)} />
            </section>
          )}

          <GrupoDePastas titulo="Situação" tres>
            {SITUACOES.map((p) => (
              <CartaoPasta key={p.valor} p={p} {...contar(p, todos)} />
            ))}
          </GrupoDePastas>

          <div id="minhas-pastas">
            <GrupoDePastas titulo="Minhas pastas" texto={minhas.length || criandoPasta ? undefined : 'Crie pastas para separar os balcões do seu jeito: por cliente, por urgência, por etapa.'}>
              {minhas.map((p) => (
                <CartaoPasta key={p.valor} p={p} {...contar(p, todos)} />
              ))}
              {criandoPasta ? (
                <FormularioPasta
                  fechar={(criada) => {
                    setCriandoPasta(false);
                    if (criada) navegar(`/app/pastas/minhas/${criada.id}`);
                  }}
                />
              ) : (
                podeMontar && (
                  <button type="button" className="pasta pasta--nova" onClick={() => setCriandoPasta(true)}>
                    <Icone nome="mais" tamanho={20} />
                    Nova pasta
                  </button>
                )
              )}
            </GrupoDePastas>
          </div>

          {tipos.length > 0 && (
            <GrupoDePastas titulo="Por tipo de caso">
              {tipos.map((p) => (
                <CartaoPasta key={p.valor} p={p} {...contar(p, todos)} />
              ))}
            </GrupoDePastas>
          )}

          {pessoas.length > 1 && (
            <GrupoDePastas titulo="Por pessoa" texto="Quem abriu o balcão">
              {pessoas.map((p) => (
                <CartaoPasta key={p.valor} p={p} {...contar(p, todos)} />
              ))}
            </GrupoDePastas>
          )}
        </>
      )}
    </>
  );
}
