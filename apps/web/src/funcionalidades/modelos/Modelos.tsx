import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NOMES_AREA, type ModeloDto } from '@trames/shared';
import { useModelos, useSessao } from '../../dados/consultas';
import { Bloqueado, BotaoLink, Busca, Carregando, Menu, Pagina, Segmentado } from '../../ui';
import { plural } from '../../util/formatos';

type Aba = 'area' | 'meus' | 'outras';

function LinhaModelo({ m, podeEditar }: { m: ModeloDto; podeEditar: boolean }) {
  const navegar = useNavigate();
  return (
    <div className="linha">
      <span className="linha__corpo">
        <span className="linha__titulo">{m.nome}</span>
        <span className="linha__sub corta">
          {plural(m.itens.length, 'documento', 'documentos')}
          {m.quando && ` · ${m.quando}`}
        </span>
      </span>
      <BotaoLink to={`/app/novo?modelo=${m.id}`}>Usar</BotaoLink>
      {podeEditar && (
        <Menu
          rotulo={`Ações do modelo ${m.nome}`}
          itens={[
            m.proprio && { rotulo: 'Editar', icone: 'modelos', acao: () => navegar(`/app/modelos/${m.id}`) },
            { rotulo: 'Duplicar e editar', icone: 'copiar', acao: () => navegar(`/app/modelos/novo?base=${m.id}`) },
          ]}
        />
      )}
    </div>
  );
}

export function Modelos() {
  const s = useSessao();
  const consulta = useModelos();
  const [aba, setAba] = useState<Aba>('area');
  const [busca, setBusca] = useState('');
  const proprios = s.tem('modelosProprios');
  const podeMontar = !(s.tem('permissoes') && s.usuario.permissao === 'confere');
  const area = s.organizacao.area;
  if (consulta.isPending) return <Carregando />;
  const todos = consulta.data ?? [];

  const listas: Record<Aba, ModeloDto[]> = {
    area: todos.filter((m) => !m.proprio && m.area === area),
    meus: todos.filter((m) => m.proprio),
    outras: todos.filter((m) => !m.proprio && m.area !== area),
  };
  const termo = busca.trim().toLowerCase();
  const lista = listas[aba].filter((m) => !termo || m.nome.toLowerCase().includes(termo) || m.itens.some((i) => i.nome.toLowerCase().includes(termo)));

  return (
    <Pagina
      titulo="Modelos"
      subtitulo="Listas de documentos prontas para abrir um balcão. Dá para ajustar cada item depois."
      ferramentas={
        <>
          <Busca valor={busca} mudar={setBusca} rotulo="Buscar modelo ou documento" />
          {proprios && podeMontar && (
            <BotaoLink to="/app/modelos/novo" variante="primario" icone="mais">
              Novo modelo
            </BotaoLink>
          )}
        </>
      }
    >
      <div className="barra-filtros">
        <Segmentado
          rotulo="Grupos de modelos"
          valor={aba}
          mudar={setAba}
          opcoes={[
            { id: 'area', rotulo: NOMES_AREA[area], contagem: listas.area.length },
            { id: 'meus', rotulo: 'Meus modelos', contagem: proprios ? listas.meus.length : undefined },
            { id: 'outras', rotulo: 'Outras áreas', contagem: listas.outras.length },
          ]}
        />
      </div>
      {aba === 'meus' && !proprios ? (
        <Bloqueado recurso="modelosProprios" />
      ) : lista.length ? (
        <div className="grupo">
          {lista.map((m) => (
            <LinhaModelo key={m.id} m={m} podeEditar={proprios && podeMontar} />
          ))}
        </div>
      ) : (
        <div className="grupo grupo--vazio">{termo ? 'Nenhum modelo encontrado.' : aba === 'meus' ? 'Você ainda não criou nenhum modelo. Duplique um pronto ou comece do zero.' : 'Nenhum modelo aqui.'}</div>
      )}
    </Pagina>
  );
}
