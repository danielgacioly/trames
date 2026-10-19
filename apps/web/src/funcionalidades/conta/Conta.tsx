import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { diasRetencao, PLANOS } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useCobranca, useSessao } from '../../dados/consultas';
import { AvisoErro, Bloqueio, SeloConta, useToast } from '../../ui/comuns';
import { plural } from '../../util/formatos';

const CORES = ['#13594b', '#8a5330', '#1c5d84', '#a9361b', '#865600', '#2e241b'];

export function Conta() {
  const s = useSessao();
  const cobranca = useCobranca().data;
  const { organizacao: o, plano } = s;
  const [f, setF] = useState({ nome: o.nome, sigla: o.sigla, cor: o.cor, diasRetencao: o.diasRetencao });
  const [toast, avisar] = useToast();
  const salvar = useAcao((corpo: typeof f) => api('PUT', '/organizacao', corpo), [chaves.eu]);
  const marca = s.tem('marca');
  const admin = s.usuario.permissao === 'admin';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await salvar.mutateAsync({ ...f, sigla: f.sigla.toUpperCase().slice(0, 2), diasRetencao: diasRetencao(plano.id, f.diasRetencao) });
    avisar('Alterações salvas.');
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Minha conta</h1>
          <p className="subtitulo">Seu plano e o uso do mês, a marca que o cliente vê no balcão e por quanto tempo os arquivos ficam guardados.</p>
        </div>
      </div>
      <AvisoErro erro={salvar.error} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <form className="cartao" style={{ flex: '2 1 420px', gap: 20 }} onSubmit={enviar}>
          <h2 className="titulo-2">Escritório</h2>
          <fieldset disabled={!admin} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <label className="tr-campo tr-campo--largo">
              <span className="tr-campo__rotulo">Nome do escritório ou da clínica</span>
              <input className="tr-campo__entrada" required minLength={2} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </label>
            {marca ? (
              <>
                <label className="tr-campo" style={{ maxWidth: 140 }}>
                  <span className="tr-campo__rotulo">Sigla</span>
                  <input className="tr-campo__entrada" maxLength={2} value={f.sigla} onChange={(e) => setF({ ...f, sigla: e.target.value.toUpperCase() })} />
                </label>
                <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <legend className="tr-campo__rotulo" style={{ marginBottom: 8 }}>
                    Cor
                  </legend>
                  <div className="linha">
                    {CORES.map((cor) => (
                      <button key={cor} type="button" aria-label={`Cor ${cor}`} aria-pressed={f.cor === cor} onClick={() => setF({ ...f, cor })} style={{ width: 36, height: 36, borderRadius: 10, background: cor, cursor: 'pointer', border: f.cor === cor ? '3px solid var(--areia)' : '0', boxShadow: f.cor === cor ? '0 0 0 2px var(--tinta)' : 'none' }} />
                    ))}
                  </div>
                </fieldset>
                <div className="aviso" style={{ alignItems: 'center' }}>
                  <SeloConta conta={f} />
                  <span>Assim aparece no topo do balcão do cliente.</span>
                </div>
              </>
            ) : (
              <Bloqueio recurso="marca" compacto />
            )}
            {plano.retencao.opcoes.length > 1 ? (
              <label className="tr-campo" style={{ maxWidth: 300 }}>
                <span className="tr-campo__rotulo">Apagar os arquivos depois de concluído o balcão</span>
                <select className="tr-campo__entrada" value={diasRetencao(plano.id, f.diasRetencao)} onChange={(e) => setF({ ...f, diasRetencao: Number(e.target.value) })}>
                  {plano.retencao.opcoes.map((d) => (
                    <option key={d} value={d}>
                      {d < 365 ? `${d} dias` : '12 meses'}
                    </option>
                  ))}
                </select>
                <span className="tr-campo__dica">Vale para os balcões concluídos daqui em diante. Os arquivos saem do storage; fica só o registro de que existiram. Uma semana antes, você recebe um e-mail.</span>
              </label>
            ) : (
              <div className="coluna" style={{ gap: 4 }}>
                <span className="tr-campo__rotulo">Retenção dos arquivos</span>
                <span className="pequeno texto-suave">
                  No plano {plano.nome}, os arquivos são apagados {plano.retencao.padrao} dias depois de concluído o balcão (com aviso por e-mail uma semana antes). No Ultra dá para escolher de 30 dias a 12 meses.
                </span>
              </div>
            )}
          </fieldset>
          {admin && (
            <button type="submit" className="tr-btn tr-btn--primario" style={{ alignSelf: 'flex-start' }} disabled={salvar.isPending}>
              Salvar
            </button>
          )}
        </form>

        <section className="cartao" style={{ flex: '1 1 300px', gap: 14 }}>
          <span className="miudo texto-suave" style={{ fontWeight: 500 }}>
            Seu plano e o uso do mês
          </span>
          <div className="linha linha--entre">
            <h2 style={{ fontSize: 28, lineHeight: '32px' }}>{plano.nome}</h2>
            <span className="pequeno texto-suave">{!plano.preco ? 'R$ 0' : s.periodicidade === 'anual' ? `R$ ${plano.precoAnual?.toLocaleString('pt-BR')} por ano` : `R$ ${plano.preco} por mês`}</span>
          </div>
          {cobranca && (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }}>
              {plano.balcoesNoMes !== null ? (
                <>
                  <li>
                    {cobranca.balcoesNoMes} de {plano.balcoesNoMes} balcões novos neste mês
                  </li>
                  <li>
                    {cobranca.excedentes
                      ? `${plural(cobranca.excedentes, 'excedente', 'excedentes')} (${(cobranca.valorExcedentesCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) na próxima fatura${s.periodicidade === 'anual' ? ', à parte do plano anual' : ''}`
                      : 'Nenhum excedente neste mês'}
                  </li>
                </>
              ) : (
                <li>{plano.limiteBalcoes === null ? `${cobranca.balcoesAtivos} balcões ativos (sem limite)` : `${cobranca.balcoesAtivos} de ${plano.limiteBalcoes} balcões ativos`}</li>
              )}
              {plano.cotaWhatsapp > 0 && (
                <li>
                  {cobranca.whatsappEnviados.toLocaleString('pt-BR')} de {plano.cotaWhatsapp.toLocaleString('pt-BR')} mensagens de WhatsApp neste mês
                </li>
              )}
              <li>{plano.limitePessoas === null ? `${cobranca.pessoas} pessoas (sem limite)` : `${cobranca.pessoas} de ${plano.limitePessoas} ${plano.limitePessoas === 1 ? 'pessoa' : 'pessoas'}`}</li>
            </ul>
          )}
          <Link to="/planos" className="tr-btn tr-btn--secundario tr-btn--bloco">
            {plano.id === 'ultra' ? 'Ver planos' : `Conhecer o ${PLANOS[plano.id === 'gratis' ? 'pro' : 'ultra'].nome}`}
          </Link>
        </section>
      </div>
      {toast}
    </>
  );
}
