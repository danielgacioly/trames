import { NavLink, Navigate, useParams } from 'react-router-dom';
import { useSessao } from '../../dados/consultas';
import { Icone, type NomeIcone } from '../../ui/Icone';
import { Aparencia } from './Aparencia';
import { Escritorio } from './Escritorio';
import { Perfil } from './Perfil';
import { PlanoEUso } from './PlanoEUso';
import { Seguranca } from './Seguranca';

const SECOES = {
  perfil: { rotulo: 'Meu perfil', icone: 'clientes', tela: Perfil },
  seguranca: { rotulo: 'Senha e acesso', icone: 'cadeado', tela: Seguranca },
  aparencia: { rotulo: 'Aparência', icone: 'tema', tela: Aparencia },
  escritorio: { rotulo: 'Escritório e marca', icone: 'balcoes', tela: Escritorio },
  plano: { rotulo: 'Plano e uso', icone: 'relatorio', tela: PlanoEUso },
} satisfies Record<string, { rotulo: string; icone: NomeIcone; tela: () => JSX.Element }>;

type Secao = keyof typeof SECOES;
const GRUPOS: { titulo: string; secoes: Secao[] }[] = [
  { titulo: 'Você', secoes: ['perfil', 'seguranca', 'aparencia'] },
  { titulo: 'Escritório', secoes: ['escritorio', 'plano'] },
];

/**
 * Configurações em duas partes: o que é da pessoa (perfil, senha, aparência)
 * e o que é do escritório (marca, retenção, plano). Cada seção tem endereço próprio.
 */
export function Configuracoes() {
  const { secao } = useParams();
  const s = useSessao();
  if (!secao || !(secao in SECOES)) return <Navigate to="/app/configuracoes/perfil" replace />;
  const Tela = SECOES[secao as Secao].tela;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Configurações</h1>
          <p className="subtitulo">
            {s.usuario.nome} · {s.organizacao.nome}
          </p>
        </div>
      </div>
      <nav className="abas config-abas" aria-label="Configurações">
        {GRUPOS.map((g, k) => (
          <div key={g.titulo} className="config-abas__grupo">
            {k > 0 && <span className="config-abas__divisor" aria-hidden="true" />}
            {g.secoes.map((id) => (
              <NavLink key={id} to={`/app/configuracoes/${id}`} className={({ isActive }) => `aba${isActive ? ' aba--ativa' : ''}`}>
                <Icone nome={SECOES[id].icone} tamanho={16} />
                {SECOES[id].rotulo}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="config__conteudo">
        <Tela />
      </div>
    </>
  );
}
