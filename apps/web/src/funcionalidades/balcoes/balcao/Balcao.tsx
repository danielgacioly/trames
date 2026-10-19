import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { diasRetencao, type BalcaoDetalhe } from '@trames/shared';
import { useBalcao, useCobranca, useSessao } from '../../../dados/consultas';
import { AvisoErro, Barra, Botao, BotaoLink, Carregando, Menu, Pagina, Segmentado, StatusBalcao, useDialogos, useNotificar, type ItemMenu } from '../../../ui';
import { dataLonga, primeiroNome } from '../../../util/formatos';
import { baixarZip, useAcoesBalcao } from './acoes';
import { Detalhes } from './Detalhes';
import { Documentos } from './Documentos';
import { Historico } from './Historico';

type Aba = 'documentos' | 'detalhes' | 'historico';

export function Balcao() {
  const { id = '' } = useParams();
  const consulta = useBalcao(id);
  if (consulta.isPending) return <Carregando />;
  if (consulta.error)
    return (
      <Pagina voltar={{ para: '/app', rotulo: 'Balcões' }} titulo="Balcão">
        <AvisoErro erro={consulta.error} />
      </Pagina>
    );
  return <Tela b={consulta.data} />;
}

/** Avisa quando um ZIP pedido nesta tela fica pronto (o worker monta em segundo plano). */
function useAvisoZip(b: BalcaoDetalhe) {
  const notificar = useNotificar();
  const e = b.exportacao;
  const chave = e ? `${e.id}:${e.status}` : '';
  const antes = useRef(chave);
  useEffect(() => {
    if (chave === antes.current) return;
    antes.current = chave;
    if (e?.status === 'pronta') notificar({ titulo: 'O ZIP está pronto', texto: 'Baixe pelo menu “…” do balcão ou em Detalhes.', duracao: 8000 });
    if (e?.status === 'falhou') notificar({ tom: 'erro', titulo: 'Não deu para montar o ZIP', texto: 'Tente de novo pelo menu “…”.' });
  }, [chave, e?.status, notificar]);
}

function Tela({ b }: { b: BalcaoDetalhe }) {
  const s = useSessao();
  const navegar = useNavigate();
  const { confirmar } = useDialogos();
  const [params, setParams] = useSearchParams();
  const uso = useCobranca().data;
  const a = useAcoesBalcao(b.id);
  useAvisoZip(b);

  const aba = (['documentos', 'detalhes', 'historico'].includes(params.get('aba') ?? '') ? params.get('aba') : 'documentos') as Aba;
  const mudarAba = (nova: Aba) => setParams(nova === 'documentos' ? {} : { aba: nova }, { replace: true });

  const nome = primeiroNome(b.cliente.nome);
  const aberto = !b.concluidoEm;
  const podeMontar = !(s.tem('permissoes') && s.usuario.permissao === 'confere');
  const podeConcluir = b.itens.every((i) => !i.obrigatorio || i.status === 'aprovado');
  const noLimite = s.plano.limiteBalcoes !== null && (uso?.balcoesAtivos ?? 0) >= s.plano.limiteBalcoes;
  const dias = diasRetencao(s.plano.id, s.organizacao.diasRetencao);
  const zip = b.exportacao;

  async function concluir() {
    const ok = await confirmar({
      titulo: `Concluir o balcão de ${nome}?`,
      texto: `O acesso de ${nome} é encerrado e os arquivos são apagados em ${dias} dias. Até lá, dá para reabrir.`,
      confirmar: 'Concluir',
    });
    if (ok) await a.executar(() => a.concluir.mutateAsync(), 'Balcão concluído');
  }

  async function arquivar() {
    const ok = await confirmar({
      titulo: `Arquivar o balcão de ${nome}?`,
      texto: `Ele deixa de contar como ativo, o acesso de ${nome} é encerrado e os arquivos são apagados em ${dias} dias. Até lá, dá para reabrir.`,
      confirmar: 'Arquivar',
      perigo: true,
    });
    if (ok) await a.executar(() => a.arquivar.mutateAsync(), 'Balcão arquivado');
  }

  const itemZip: ItemMenu =
    !b.arquivosApagadosEm &&
    (zip?.status === 'pronta'
      ? { rotulo: 'Baixar ZIP', icone: 'baixar', acao: () => a.executar(() => baixarZip(b.id)) }
      : {
          rotulo: zip?.status === 'pendente' ? 'Montando o ZIP…' : 'Baixar tudo (ZIP)',
          icone: 'baixar',
          desativado: zip?.status === 'pendente',
          acao: () => a.executar(() => a.exportar.mutateAsync(), 'Montando o ZIP. Avisamos quando ficar pronto.'),
        });

  const menu: ItemMenu[] = aberto
    ? [
        { rotulo: `Lembrar ${nome} agora`, icone: 'sino', acao: () => a.executar(() => a.lembrar.mutateAsync(), (r) => `Lembrete enviado por ${r.canal === 'whatsapp' ? 'WhatsApp' : 'e-mail'}`) },
        { rotulo: 'Editar lista', icone: 'modelos', acao: () => navegar(`/app/balcao/${b.id}/lista`) },
        'separador',
        itemZip,
        'separador',
        { rotulo: 'Arquivar…', icone: 'lixo', perigo: true, acao: arquivar },
      ]
    : [itemZip];

  return (
    <Pagina
      voltar={{ para: '/app', rotulo: 'Balcões' }}
      titulo={b.cliente.nome}
      subtitulo={
        <>
          <span className="mono">{b.protocolo}</span>
          {b.tipo && ` · ${b.tipo}`} · prazo {dataLonga(b.prazo)}
        </>
      }
      ferramentas={
        podeMontar && (
          <>
            {aberto ? (
              <>
                <BotaoLink to={`/app/balcao/${b.id}/link`} icone="envio">
                  Enviar link
                </BotaoLink>
                <Botao variante="primario" disabled={!podeConcluir || a.concluir.isPending} title={podeConcluir ? undefined : 'Disponível quando todos os documentos obrigatórios estiverem aprovados'} onClick={concluir}>
                  Concluir
                </Botao>
              </>
            ) : (
              <Botao
                disabled={noLimite || !!b.arquivosApagadosEm || a.reabrir.isPending}
                title={b.arquivosApagadosEm ? 'Os arquivos já foram apagados' : noLimite ? 'Você está no limite de balcões ativos do plano' : undefined}
                onClick={() => a.executar(() => a.reabrir.mutateAsync(), 'Balcão reaberto')}
              >
                Reabrir
              </Botao>
            )}
            <Menu itens={menu} rotulo="Mais ações do balcão" />
          </>
        )
      }
    >
      <div className="barra-filtros">
        <Segmentado
          rotulo="Seções do balcão"
          valor={aba}
          mudar={mudarAba}
          opcoes={[
            { id: 'documentos', rotulo: 'Documentos' },
            { id: 'detalhes', rotulo: 'Detalhes' },
            { id: 'historico', rotulo: 'Histórico' },
          ]}
        />
        <div className="fila" style={{ gap: 12 }}>
          <StatusBalcao b={b} />
          <span className="fila pequeno secundario" style={{ gap: 8 }}>
            <span style={{ width: 90 }}>
              <Barra parte={b.contagem.aprovado} total={b.contagem.total} />
            </span>
            <span className="numero">
              {b.contagem.aprovado} de {b.contagem.total}
            </span>
          </span>
        </div>
      </div>

      {aba === 'documentos' && <Documentos b={b} acoes={a} irParaDetalhes={() => mudarAba('detalhes')} />}
      {aba === 'detalhes' && <Detalhes b={b} acoes={a} podeMontar={podeMontar} arquivar={arquivar} />}
      {aba === 'historico' && <Historico id={b.id} />}
    </Pagina>
  );
}
