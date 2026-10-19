import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NOMES_AREA, type BalcaoResumo } from '@trames/shared';
import { useBalcoes, useModelos, useSessao } from '../../dados/consultas';
import { AvisoErro, Barra, BotaoLink, Busca, Carregando, Icone, Linha, Pagina, Prazo, Secao, Segmentado, StatusBalcao } from '../../ui';
import { plural } from '../../util/formatos';

type Filtro = 'abertos' | 'conferir' | 'cliente' | 'encerrados';

const FILTROS: Record<Filtro, { rotulo: string; teste: (b: BalcaoResumo) => boolean }> = {
  abertos: { rotulo: 'Abertos', teste: (b) => !b.concluidoEm },
  conferir: { rotulo: 'Para conferir', teste: (b) => !b.concluidoEm && b.contagem.analise > 0 },
  cliente: { rotulo: 'Com o cliente', teste: (b) => !b.concluidoEm && b.contagem.analise === 0 && b.contagem.aprovado < b.contagem.total },
  encerrados: { rotulo: 'Encerrados', teste: (b) => !!b.concluidoEm },
};

function LinhaBalcao({ b }: { b: BalcaoResumo }) {
  const c = b.contagem;
  return (
    <Link to={`/app/balcao/${b.id}`} className="linha linha-balcao">
      <span className="linha__corpo">
        <span className="linha__titulo corta">{b.clienteNome}</span>
        <span className="linha__sub corta">
          <span className="mono">{b.protocolo}</span>
          {b.tipo && ` · ${b.tipo}`}
        </span>
      </span>
      <span className="linha-balcao__progresso">
        <Barra parte={c.aprovado} total={c.total} />
        <span className="numero">
          {c.aprovado} de {c.total} aprovados
        </span>
      </span>
      <StatusBalcao b={b} />
      <span className="linha-balcao__prazo">
        <Prazo data={b.prazo} encerrado={!!b.concluidoEm} />
      </span>
      <Icone nome="avancar" className="icone linha__seta" />
    </Link>
  );
}

/** Conta nova, sem balcão: começa por um modelo da área ou do zero. */
function Primeiro() {
  const s = useSessao();
  const modelos = (useModelos().data ?? []).filter((m) => !m.proprio && m.area === s.organizacao.area).slice(0, 4);
  return (
    <Pagina titulo="Balcões" subtitulo="Cada balcão reúne os documentos de um cliente para um caso.">
      <Secao titulo={`Começar por um modelo de ${NOMES_AREA[s.organizacao.area].toLowerCase()}`} nota="Dá para mudar qualquer item antes de criar e depois, com o balcão aberto.">
        {modelos.map((m) => (
          <Linha key={m.id} para={`/app/novo?modelo=${m.id}`} titulo={m.nome} sub={`${plural(m.itens.length, 'documento', 'documentos')} · ${m.quando}`} />
        ))}
        <Linha para="/app/novo" tom="acao" titulo="Balcão em branco" antes={<Icone nome="mais" />} />
      </Secao>
    </Pagina>
  );
}

export function ListaBalcoes() {
  const consulta = useBalcoes();
  const s = useSessao();
  const [filtro, setFiltro] = useState<Filtro>('abertos');
  const [busca, setBusca] = useState('');
  const podeMontar = !(s.tem('permissoes') && s.usuario.permissao === 'confere');

  if (consulta.isPending) return <Carregando />;
  if (consulta.error)
    return (
      <Pagina titulo="Balcões">
        <AvisoErro erro={consulta.error} />
      </Pagina>
    );
  const todos = consulta.data;
  if (todos.length === 0 && podeMontar) return <Primeiro />;

  const termo = busca.trim().toLowerCase();
  const doFiltro = todos.filter(FILTROS[filtro].teste);
  const visiveis = doFiltro.filter((b) => !termo || b.clienteNome.toLowerCase().includes(termo) || b.protocolo.toLowerCase().includes(termo) || b.tipo.toLowerCase().includes(termo));
  // Para conferir primeiro; depois, o prazo mais perto.
  const ordenados = filtro === 'encerrados' ? visiveis : [...visiveis].sort((a, b) => Number(b.contagem.analise > 0) - Number(a.contagem.analise > 0) || a.prazo.localeCompare(b.prazo));

  return (
    <Pagina
      titulo="Balcões"
      ferramentas={
        <>
          <Busca valor={busca} mudar={setBusca} rotulo="Buscar cliente ou protocolo" />
          {podeMontar && (
            <BotaoLink to="/app/novo" variante="primario" icone="mais">
              Novo balcão
            </BotaoLink>
          )}
        </>
      }
    >
      <div className="barra-filtros">
        <Segmentado
          rotulo="Filtrar balcões"
          valor={filtro}
          mudar={setFiltro}
          opcoes={(Object.keys(FILTROS) as Filtro[]).map((id) => ({ id, rotulo: FILTROS[id].rotulo, contagem: todos.filter(FILTROS[id].teste).length }))}
        />
      </div>
      {ordenados.length ? (
        <div className="grupo">
          {ordenados.map((b) => (
            <LinhaBalcao key={b.id} b={b} />
          ))}
        </div>
      ) : (
        <div className="grupo grupo--vazio">{termo ? `Nada encontrado para “${busca.trim()}”.` : filtro === 'conferir' ? 'Nenhum documento esperando conferência.' : 'Nenhum balcão por aqui.'}</div>
      )}
    </Pagina>
  );
}
