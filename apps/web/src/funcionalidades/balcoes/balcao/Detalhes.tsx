import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { diasRetencao, type BalcaoDetalhe, type CanalCodigo } from '@trames/shared';
import { useSessao } from '../../../dados/consultas';
import { Botao, Entrada, Interruptor, Linha, LinhaCampo, Secao, Selecao, useDialogos } from '../../../ui';
import { dataLonga, diasAte, plural, primeiroNome } from '../../../util/formatos';
import { baixarZip, type AcoesBalcao } from './acoes';

const CANAL: Record<CanalCodigo, string> = { email: 'E-mail', whatsapp: 'WhatsApp' };

/** Prazo, lembretes e canal do código. As mudanças só valem depois de "Salvar". */
function PrazoELembretes({ b, acoes: a, editavel }: { b: BalcaoDetalhe; acoes: AcoesBalcao; editavel: boolean }) {
  const s = useSessao();
  const comWhatsapp = s.tem('whatsapp');
  const inicial = { prazo: b.prazo, lembrete: b.lembrete, canalLembrete: b.canalLembrete, canalCodigo: b.canalCodigo };
  const [f, setF] = useState(inicial);
  const mudou = (Object.keys(inicial) as (keyof typeof inicial)[]).some((k) => f[k] !== inicial[k]);

  const canal = (k: 'canalCodigo' | 'canalLembrete') =>
    editavel ? (
      <Selecao id={k} value={comWhatsapp ? f[k] : 'email'} disabled={!comWhatsapp} onChange={(e) => setF({ ...f, [k]: e.target.value as CanalCodigo })} style={{ width: 160 }}>
        <option value="email">E-mail</option>
        <option value="whatsapp">WhatsApp</option>
      </Selecao>
    ) : (
      CANAL[b[k]]
    );

  return (
    <Secao
      titulo="Prazo e lembretes"
      acao={
        mudou && (
          <span className="fila">
            <Botao variante="simples" onClick={() => setF(inicial)}>
              Desfazer
            </Botao>
            <Botao variante="primario" disabled={a.configurar.isPending} onClick={() => a.executar(() => a.configurar.mutateAsync(f), 'Alterações salvas')}>
              Salvar
            </Botao>
          </span>
        )
      }
      nota="Os lembretes saem 3 dias antes do prazo, no dia e 2 dias depois, só se ainda faltar documento obrigatório."
    >
      <LinhaCampo rotulo="Prazo" id="prazo">
        {editavel ? <Entrada id="prazo" type="date" required value={f.prazo} onChange={(e) => e.target.value && setF({ ...f, prazo: e.target.value })} style={{ width: 160 }} /> : dataLonga(b.prazo, true)}
      </LinhaCampo>
      <LinhaCampo rotulo="Código de acesso por" id="canalCodigo">
        {canal('canalCodigo')}
      </LinhaCampo>
      <div className="linha">
        <span className="linha__corpo">Lembretes automáticos</span>
        {editavel ? <Interruptor rotulo="Lembretes automáticos" ligado={f.lembrete} mudar={(v) => setF({ ...f, lembrete: v })} /> : <span className="secundario">{b.lembrete ? 'Ligados' : 'Desligados'}</span>}
      </div>
      {f.lembrete && (
        <LinhaCampo rotulo="Lembretes por" id="canalLembrete">
          {canal('canalLembrete')}
        </LinhaCampo>
      )}
    </Secao>
  );
}

export function Detalhes({ b, acoes: a, podeMontar, arquivar }: { b: BalcaoDetalhe; acoes: AcoesBalcao; podeMontar: boolean; arquivar: () => void }) {
  const s = useSessao();
  const navegar = useNavigate();
  const { confirmar } = useDialogos();
  const nome = primeiroNome(b.cliente.nome);
  const aberto = !b.concluidoEm;
  const dias = diasRetencao(s.plano.id, s.organizacao.diasRetencao);
  const zip = b.exportacao;
  // Aberto e esquecido: o worker arquiva 30 dias depois do prazo (com aviso uma semana antes).
  const arquivaEm = new Date(new Date(`${b.prazo}T00:00:00`).getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  async function encerrarAcesso() {
    const ok = await confirmar({ titulo: `Encerrar o acesso de ${nome}?`, texto: 'O link continua valendo, mas será preciso um código novo para entrar, em todos os aparelhos.', confirmar: 'Encerrar acesso', perigo: true });
    if (ok) await a.executar(() => a.encerrarAcesso.mutateAsync(), 'Acesso encerrado em todos os aparelhos');
  }

  async function trocarLinks() {
    const ok = await confirmar({
      titulo: 'Cancelar os links e gerar um novo?',
      texto: `Todos os links já enviados param de valer e ${nome} é desconectado. Para só mandar o link de novo, use “Enviar link”.`,
      confirmar: 'Cancelar links',
      perigo: true,
    });
    if (!ok) return;
    const r = await a.executar(() => a.trocarLinks.mutateAsync(), 'Links anteriores cancelados');
    if (r.ok) navegar(`/app/balcao/${b.id}/link`, { state: { link: r.valor } });
  }

  return (
    <div className="pilha" style={{ gap: 22, maxWidth: 760 }}>
      <Secao titulo="Cliente">
        <LinhaCampo rotulo="Nome">{b.cliente.nome}</LinhaCampo>
        <LinhaCampo rotulo="E-mail">{b.cliente.email}</LinhaCampo>
        <LinhaCampo rotulo="WhatsApp">final {b.cliente.whatsappFinal}</LinhaCampo>
      </Secao>

      <PrazoELembretes key={`${b.prazo}${b.lembrete}${b.canalLembrete}${b.canalCodigo}`} b={b} acoes={a} editavel={aberto && podeMontar} />

      {aberto && (
        <Secao titulo="Acesso do cliente" nota="Cada link vale até o fim do balcão. Ao entrar com o código, o aparelho fica conectado por 30 dias.">
          <LinhaCampo rotulo="Aparelhos conectados">{b.sessoesCliente ? plural(b.sessoesCliente, 'aparelho', 'aparelhos') : 'Nenhum'}</LinhaCampo>
          <LinhaCampo rotulo="Último link">{b.link ? `Gerado em ${dataLonga(b.link.criadoEm.slice(0, 10))}` : 'Nenhum link ativo'}</LinhaCampo>
          {podeMontar && b.sessoesCliente > 0 && <Linha tom="perigo" titulo="Encerrar acesso em todos os aparelhos" onClick={encerrarAcesso} />}
          {podeMontar && <Linha tom="perigo" titulo="Cancelar links e gerar novo" onClick={trocarLinks} />}
        </Secao>
      )}

      <Secao
        titulo="Arquivos"
        nota={b.arquivosApagadosEm ? undefined : 'Os arquivos saem do storage na data marcada; fica só o registro de que existiram. Uma semana antes, chega um e-mail.'}
      >
        <LinhaCampo rotulo="Retenção">
          {b.arquivosApagadosEm
            ? `Apagados em ${dataLonga(b.arquivosApagadosEm.slice(0, 10), true)}`
            : b.apagarArquivosEm
              ? `Serão apagados em ${dataLonga(b.apagarArquivosEm.slice(0, 10), true)}`
              : `Apagados ${dias} dias depois de encerrar o balcão`}
        </LinhaCampo>
        {!b.arquivosApagadosEm && podeMontar && (
          <div className="linha">
            <span className="linha__corpo">
              <span>Todos os originais (ZIP)</span>
              {zip && (
                <span className="linha__sub">
                  {zip.status === 'pendente' ? 'Montando…' : zip.status === 'falhou' ? 'Não deu para montar. Tente de novo.' : zip.expiraEm ? `Pronto · disponível até ${dataLonga(zip.expiraEm.slice(0, 10))}` : 'Pronto'}
                </span>
              )}
            </span>
            {zip?.status === 'pronta' ? (
              <Botao icone="baixar" onClick={() => a.executar(() => baixarZip(b.id))}>
                Baixar
              </Botao>
            ) : (
              <Botao disabled={zip?.status === 'pendente' || a.exportar.isPending} onClick={() => a.executar(() => a.exportar.mutateAsync(), 'Montando o ZIP. Avisamos quando ficar pronto.')}>
                {zip?.status === 'falhou' ? 'Tentar de novo' : 'Gerar ZIP'}
              </Botao>
            )}
          </div>
        )}
      </Secao>

      {aberto && podeMontar && (
        <Secao
          titulo="Arquivamento"
          nota={
            diasAte(b.prazo) < 0
              ? `O prazo passou. Se continuar aberto, o balcão é arquivado a partir de ${dataLonga(arquivaEm, true)}, com aviso por e-mail uma semana antes. Mude o prazo acima para evitar.`
              : 'Um balcão aberto é arquivado sozinho 30 dias depois do prazo, sempre com aviso por e-mail uma semana antes.'
          }
        >
          <Linha tom="perigo" titulo="Arquivar balcão…" onClick={arquivar} />
        </Secao>
      )}
    </div>
  );
}
