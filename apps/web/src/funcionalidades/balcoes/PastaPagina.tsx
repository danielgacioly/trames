import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../dados/api';
import { chaves, useAcao, useBalcoes, usePastas, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando } from '../../ui/comuns';
import { Icone } from '../../ui/Icone';
import { useNotificar } from '../../ui/Notificacoes';
import { iniciais, plural } from '../../util/formatos';
import { ListaBalcoes } from './ListaBalcoes';
import { acharPasta, busca, ordenar } from './pastas';
import { FormularioPasta } from './PastasUi';
import { useConfirmar } from '../../ui/Confirmar';

const GRUPOS: Record<string, string> = { situacao: 'Situação', minhas: 'Minhas pastas', tipo: 'Tipo de caso', pessoa: 'Pessoa' };

/** Uma pasta: os balcões dela, com busca, e os encerrados à parte. */
export function PastaPagina() {
  const confirmar = useConfirmar();
  const { grupo = '', valor = '' } = useParams();
  const s = useSessao();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const consulta = useBalcoes();
  const consultaPastas = usePastas();
  const [termo, setTermo] = useState('');
  const [encerrados, setEncerrados] = useState(false);
  const [editando, setEditando] = useState(false);
  const apagar = useAcao((id: string) => api('DELETE', `/pastas/${id}`), [chaves.pastas, chaves.balcoes]);
  const podeMontar = !(s.tem('permissoes') && s.usuario.permissao === 'confere');

  if (consulta.isPending || consultaPastas.isPending) return <Carregando />;
  if (consulta.error) return <AvisoErro erro={consulta.error} />;
  const pasta = acharPasta(grupo, decodeURIComponent(valor), consulta.data, consultaPastas.data ?? []);
  if (!pasta)
    return (
      <div className="coluna" style={{ gap: 12 }}>
        <Link to="/app" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start' }}>
          <Icone nome="voltar" />
          Início
        </Link>
        <p className="texto-suave">Esta pasta não existe mais.</p>
      </div>
    );

  const dela = consulta.data.filter(pasta.teste);
  const abertos = pasta.porSituacao ? dela : dela.filter((b) => !b.concluidoEm);
  const fechados = pasta.porSituacao ? [] : dela.filter((b) => !!b.concluidoEm);
  const mostrar = encerrados ? fechados : abertos;
  const t = termo.trim().toLowerCase();
  const lista = encerrados ? mostrar.filter((b) => busca(b, t)) : ordenar(mostrar.filter((b) => busca(b, t)));
  const daConta = pasta.grupo === 'minhas' ? consultaPastas.data?.find((p) => p.id === pasta.valor) : undefined;
  const paraConferir = abertos.filter((b) => !b.concluidoEm && b.contagem.analise > 0).length;

  async function apagarPasta() {
    if (!daConta || !(await confirmar({ titulo: `Apagar a pasta "${daConta.nome}"?`, texto: 'Os balcões continuam existindo, só saem da pasta.', botao: 'Apagar pasta', perigo: true }))) return;
    await apagar.mutateAsync(daConta.id);
    notificar({ titulo: 'Pasta apagada', texto: 'Os balcões dela continuam em Início, nas outras pastas.' });
    navegar('/app');
  }

  return (
    <>
      <Link to="/app" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start', marginBottom: -12 }}>
        <Icone nome="voltar" />
        Início
      </Link>
      {editando && daConta ? (
        <div style={{ maxWidth: 420 }}>
          <FormularioPasta pasta={daConta} fechar={() => setEditando(false)} />
        </div>
      ) : (
        <div className="cabecalho-pagina">
          <div style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {pasta.grupo === 'pessoa' ? (
              <span className="pasta__avatar" style={{ width: 48, height: 48, fontSize: 16 }}>
                {iniciais(pasta.nome)}
              </span>
            ) : (
              <span className="pasta__icone pasta__icone--grande" style={{ color: pasta.cor }}>
                <Icone nome="pasta" tamanho={28} />
              </span>
            )}
            <div className="coluna" style={{ gap: 2 }}>
              <span className="miudo texto-suave">{GRUPOS[pasta.grupo]}</span>
              <h1 className="titulo-1">{pasta.nome}</h1>
              <span className="pequeno texto-suave">
                {pasta.valor === 'encerrados' ? plural(abertos.length, 'balcão', 'balcões') : plural(abertos.length, 'balcão aberto', 'balcões abertos')}
                {paraConferir > 0 && pasta.valor !== 'conferir' && ` · ${paraConferir} para conferir`}
              </span>
            </div>
          </div>
          <div className="linha acoes-cabecalho" style={{ gap: 8 }}>
            {daConta && podeMontar && (
              <>
                <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => setEditando(true)}>
                  Renomear
                </button>
                <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ color: 'var(--recusado)' }} onClick={apagarPasta} disabled={apagar.isPending}>
                  Apagar pasta
                </button>
              </>
            )}
            {podeMontar && pasta.valor !== 'encerrados' && (
              <Link to={daConta ? `/app/novo?pasta=${daConta.id}` : '/app/novo'} className="tr-btn tr-btn--primario tr-btn--sm">
                <Icone nome="mais" />
                {daConta ? 'Novo balcão nesta pasta' : 'Novo balcão'}
              </Link>
            )}
          </div>
        </div>
      )}
      <AvisoErro erro={apagar.error} />

      <div className="linha linha--entre" style={{ gap: 12 }}>
        {fechados.length > 0 ? (
          <div className="linha" style={{ gap: 6 }}>
            <button type="button" className="filtro" aria-pressed={!encerrados} onClick={() => setEncerrados(false)}>
              Abertos · {abertos.length}
            </button>
            <button type="button" className="filtro" aria-pressed={encerrados} onClick={() => setEncerrados(true)}>
              Encerrados · {fechados.length}
            </button>
          </div>
        ) : (
          <span />
        )}
        {dela.length > 6 && (
          <label className="busca">
            <Icone nome="lupa" tamanho={18} />
            <input placeholder="Buscar nesta pasta" aria-label="Buscar nesta pasta" value={termo} onChange={(e) => setTermo(e.target.value)} />
          </label>
        )}
      </div>

      {lista.length ? <ListaBalcoes balcoes={lista} /> : <p className="texto-suave">{t ? 'Nenhum balcão encontrado.' : encerrados ? 'Nenhum balcão encerrado.' : pasta.vazia}</p>}
    </>
  );
}
