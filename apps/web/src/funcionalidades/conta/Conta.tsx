import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { diasRetencao, PLANOS, type Permissao } from '@trames/shared';
import { api, mensagemDe } from '../../dados/api';
import { chaves, useAcao, useCobranca, useEquipe, useSessao } from '../../dados/consultas';
import { Avatar, Barra, Bloqueado, Botao, BotaoLink, Carregando, Entrada, LinhaCampo, Menu, Nota, Pagina, Secao, SegmentadoRotas, Selecao, SeloConta, useDialogos, useNotificar } from '../../ui';
import { moeda, plural } from '../../util/formatos';

/** Minha conta: plano e uso, escritório e equipe, cada um numa seção. */
export function Conta() {
  return (
    <Pagina titulo="Minha conta" estreita>
      <SegmentadoRotas
        rotulo="Seções de Minha conta"
        opcoes={[
          { para: '/app/conta/plano', rotulo: 'Plano e uso' },
          { para: '/app/conta/escritorio', rotulo: 'Escritório' },
          { para: '/app/conta/equipe', rotulo: 'Equipe' },
        ]}
      />
      <Outlet />
    </Pagina>
  );
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeDoMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1];
const textoDias = (d: number) => (d < 365 ? `${d} dias` : '12 meses');

/** Uma linha de uso: rótulo, "x de y" e a barra, que fica laranja perto do fim e vermelha no fim. */
function Medidor({ rotulo, usado, limite, sub }: { rotulo: string; usado: number; limite: number | null; sub?: string }) {
  const tom = limite === null ? undefined : usado >= limite ? 'cheia' : usado >= limite * 0.9 ? 'alerta' : undefined;
  return (
    <div className="linha">
      <div className="medidor">
        <div className="medidor__topo">
          <span>{rotulo}</span>
          <span className="secundario numero">{limite === null ? `${usado.toLocaleString('pt-BR')} · sem limite` : `${usado.toLocaleString('pt-BR')} de ${limite.toLocaleString('pt-BR')}`}</span>
        </div>
        {limite !== null && <Barra parte={usado} total={limite} tom={tom} />}
        {sub && <span className="linha__sub">{sub}</span>}
      </div>
    </div>
  );
}

export function ContaPlano() {
  const s = useSessao();
  const consulta = useCobranca();
  const notificar = useNotificar();
  const { confirmar } = useDialogos();
  const { plano: p, organizacao: o } = s;
  const admin = s.usuario.permissao === 'admin';
  const retencao = diasRetencao(p.id, o.diasRetencao);
  const salvar = useAcao((dias: number) => api('PUT', '/organizacao', { nome: o.nome, diasRetencao: dias }), [chaves.eu, chaves.balcoes]);
  const uso = consulta.data;
  if (!uso) return <Carregando />;

  const preco = !p.preco ? 'Grátis' : s.periodicidade === 'anual' && p.precoAnual ? `R$ ${p.precoAnual.toLocaleString('pt-BR')} por ano` : `R$ ${p.preco} por mês`;
  const proximo = p.id === 'gratis' ? PLANOS.pro : p.id === 'pro' ? PLANOS.ultra : null;

  async function mudarRetencao(dias: number) {
    if (dias < retencao) {
      const ok = await confirmar({
        titulo: `Guardar os arquivos por ${textoDias(dias)}?`,
        texto: 'Vale também para os balcões já encerrados: as datas de exclusão ficam mais perto, nunca a menos de 7 dias de hoje. Quem administra a conta recebe o aviso por e-mail antes.',
        confirmar: 'Mudar retenção',
      });
      if (!ok) return;
    }
    try {
      await salvar.mutateAsync(dias);
      notificar({ titulo: 'Retenção atualizada', texto: `Arquivos guardados por ${textoDias(dias)} depois de encerrar o balcão.` });
    } catch (e) {
      notificar({ tom: 'erro', titulo: 'Não deu para salvar', texto: mensagemDe(e) });
    }
  }

  return (
    <>
      <Secao titulo="Plano">
        <div className="linha">
          <span className="linha__corpo">
            <span className="linha__titulo">Trames {p.nome}</span>
            <span className="linha__sub">
              {preco}
              {p.preco > 0 && ` · ${s.periodicidade === 'anual' ? 'anual' : 'mensal'}`}
            </span>
          </span>
          {admin && <BotaoLink to="/planos">{proximo ? `Conhecer o ${proximo.nome}` : 'Ver planos'}</BotaoLink>}
        </div>
      </Secao>

      <Secao titulo={`Uso em ${nomeDoMes(uso.mes)}`} nota="As contagens do mês recomeçam no dia 1º, no horário de Brasília.">
        {p.balcoesNoMes !== null ? (
          <Medidor
            rotulo="Balcões novos no mês"
            usado={uso.balcoesNoMes}
            limite={p.balcoesNoMes}
            sub={uso.excedentes ? `${plural(uso.excedentes, 'excedente', 'excedentes')} · ${moeda(uso.valorExcedentesCentavos)} na próxima fatura${s.periodicidade === 'anual' ? ', à parte do plano anual' : ''}` : 'Depois do limite, cada balcão novo custa R$ 1,00, sem bloqueio.'}
          />
        ) : (
          <Medidor rotulo="Balcões ativos" usado={uso.balcoesAtivos} limite={p.limiteBalcoes} sub="Balcões concluídos ou arquivados não contam." />
        )}
        {p.cotaWhatsapp > 0 ? (
          <Medidor rotulo="Mensagens de WhatsApp" usado={uso.whatsappEnviados} limite={p.cotaWhatsapp} sub="Código de acesso e lembretes. Quando a cota acaba, vão por e-mail." />
        ) : (
          <div className="linha">
            <span className="linha__corpo">Mensagens de WhatsApp</span>
            <span className="secundario">Não incluso</span>
          </div>
        )}
        <Medidor rotulo="Pessoas na conta" usado={uso.pessoas} limite={p.limitePessoas} />
      </Secao>

      <Secao
        titulo="Arquivos"
        nota={p.retencao.opcoes.length > 1 ? 'Os arquivos saem do storage na data marcada; fica só o registro de que existiram.' : `No plano ${p.nome}, a retenção é fixa. No Ultra dá para escolher de 30 dias a 12 meses.`}
      >
        <LinhaCampo rotulo="Guardar depois de encerrar" id="retencao">
          {p.retencao.opcoes.length > 1 && admin ? (
            <Selecao id="retencao" value={retencao} disabled={salvar.isPending} onChange={(e) => mudarRetencao(Number(e.target.value))} style={{ width: 160 }}>
              {p.retencao.opcoes.map((d) => (
                <option key={d} value={d}>
                  {textoDias(d)}
                </option>
              ))}
            </Selecao>
          ) : (
            textoDias(retencao)
          )}
        </LinhaCampo>
      </Secao>
    </>
  );
}

const CORES = ['#13594b', '#8a5330', '#1c5d84', '#a9361b', '#865600', '#2e241b'];
const PERMISSOES: Record<Permissao, { nome: string; texto: string }> = {
  admin: { nome: 'Administra', texto: 'tudo, inclusive plano e equipe' },
  monta: { nome: 'Monta balcões', texto: 'cria balcões e confere documentos' },
  confere: { nome: 'Só confere', texto: 'aprova ou recusa documentos' },
};

export function ContaEscritorio() {
  const s = useSessao();
  const notificar = useNotificar();
  const { organizacao: o, plano } = s;
  const admin = s.usuario.permissao === 'admin';
  const marca = s.tem('marca');
  const inicial = { nome: o.nome, sigla: o.sigla, cor: o.cor };
  const [f, setF] = useState(inicial);
  const mudou = f.nome !== inicial.nome || f.sigla !== inicial.sigla || f.cor !== inicial.cor;
  const salvar = useAcao(() => api('PUT', '/organizacao', { ...f, nome: f.nome.trim(), sigla: f.sigla.toUpperCase().slice(0, 2), diasRetencao: diasRetencao(plano.id, o.diasRetencao) }), [chaves.eu]);

  async function enviar() {
    try {
      await salvar.mutateAsync();
      notificar({ titulo: 'Alterações salvas' });
    } catch (e) {
      notificar({ tom: 'erro', titulo: 'Não deu para salvar', texto: mensagemDe(e) });
    }
  }

  return (
    <>
      <Secao titulo="Você">
        <LinhaCampo rotulo="Nome">{s.usuario.nome}</LinhaCampo>
        <LinhaCampo rotulo="E-mail">{s.usuario.email}</LinhaCampo>
        <LinhaCampo rotulo="Permissão">{s.tem('permissoes') ? PERMISSOES[s.usuario.permissao].nome : 'Acesso completo'}</LinhaCampo>
      </Secao>

      <Secao
        titulo="Escritório"
        acao={
          admin &&
          mudou && (
            <span className="fila">
              <Botao variante="simples" onClick={() => setF(inicial)}>
                Desfazer
              </Botao>
              <Botao variante="primario" disabled={salvar.isPending || f.nome.trim().length < 2} onClick={enviar}>
                Salvar
              </Botao>
            </span>
          )
        }
        nota={marca ? 'A sigla e a cor aparecem no topo do balcão que o cliente abre.' : <Bloqueado recurso="marca" />}
      >
        <LinhaCampo rotulo="Nome do escritório" id="org-nome">
          {admin ? <Entrada id="org-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /> : o.nome}
        </LinhaCampo>
        {marca && (
          <>
            <LinhaCampo rotulo="Sigla" id="org-sigla">
              {admin ? <Entrada id="org-sigla" maxLength={2} value={f.sigla} onChange={(e) => setF({ ...f, sigla: e.target.value.toUpperCase() })} style={{ width: 70, textAlign: 'center' }} /> : o.sigla}
            </LinhaCampo>
            <LinhaCampo rotulo="Cor">
              <span className="fila" role="radiogroup" aria-label="Cor">
                {CORES.map((cor) => (
                  <button key={cor} type="button" role="radio" aria-checked={f.cor === cor} aria-label={`Cor ${cor}`} disabled={!admin} className="amostra-cor" style={{ background: cor }} onClick={() => setF({ ...f, cor })} />
                ))}
              </span>
            </LinhaCampo>
            <LinhaCampo rotulo="Prévia">
              <span className="fila">
                <SeloConta conta={f} tamanho={24} />
                <span className="secundario">{f.nome}</span>
              </span>
            </LinhaCampo>
          </>
        )}
      </Secao>
    </>
  );
}

export function ContaEquipe() {
  const s = useSessao();
  const consulta = useEquipe();
  const notificar = useNotificar();
  const { confirmar } = useDialogos();
  const limite = s.plano.limitePessoas;
  const comPermissoes = s.tem('permissoes');
  const admin = s.usuario.permissao === 'admin';
  const vazio = { nome: '', email: '', permissao: 'monta' as Permissao };
  const [convite, setConvite] = useState(vazio);
  const convidar = useAcao((c: typeof convite) => api('POST', '/organizacao/equipe', c), [chaves.equipe, chaves.cobranca]);
  const mudar = useAcao((x: { id: string; permissao: Permissao }) => api('PATCH', `/organizacao/equipe/${x.id}`, { permissao: x.permissao }), [chaves.equipe]);
  const remover = useAcao((id: string) => api('DELETE', `/organizacao/equipe/${id}`), [chaves.equipe, chaves.cobranca]);

  if (consulta.isPending) return <Carregando />;
  const pessoas = consulta.data ?? [];
  const cheio = limite !== null && pessoas.length >= limite;

  async function rodar(fazer: () => Promise<unknown>, titulo: string) {
    try {
      await fazer();
      notificar({ titulo });
    } catch (e) {
      notificar({ tom: 'erro', titulo: 'Não deu certo', texto: mensagemDe(e) });
    }
  }

  async function tirar(id: string, nome: string) {
    if (await confirmar({ titulo: `Tirar ${nome} da conta?`, texto: 'A pessoa perde o acesso na hora. Os balcões e o histórico continuam.', confirmar: 'Tirar da conta', perigo: true })) await rodar(() => remover.mutateAsync(id), `${nome} saiu da conta`);
  }

  return (
    <>
      <Secao
        titulo="Pessoas"
        acao={<span className="pequeno terciario">{limite === null ? plural(pessoas.length, 'pessoa', 'pessoas') : `${pessoas.length} de ${limite}`}</span>}
        nota={
          comPermissoes ? (
            (Object.keys(PERMISSOES) as Permissao[]).map((k) => `${PERMISSOES[k].nome}: ${PERMISSOES[k].texto}.`).join(' ')
          ) : (
            <Bloqueado recurso="permissoes" />
          )
        }
      >
        {pessoas.map((p) => {
          const eu = p.id === s.usuario.id;
          return (
            <div key={p.id} className="linha">
              <Avatar nome={p.nome} />
              <span className="linha__corpo">
                <span className="linha__titulo corta">
                  {p.nome}
                  {eu && <span className="terciario" style={{ fontWeight: 400 }}> (você)</span>}
                </span>
                <span className="linha__sub corta">
                  {p.email}
                  {p.convitePendente && ' · convite pendente'}
                </span>
              </span>
              {comPermissoes && admin && !eu ? (
                <Selecao aria-label={`Permissão de ${p.nome}`} value={p.permissao} style={{ width: 150 }} onChange={(e) => rodar(() => mudar.mutateAsync({ id: p.id, permissao: e.target.value as Permissao }), 'Permissão atualizada')}>
                  {(Object.keys(PERMISSOES) as Permissao[]).map((k) => (
                    <option key={k} value={k}>
                      {PERMISSOES[k].nome}
                    </option>
                  ))}
                </Selecao>
              ) : (
                <span className="pequeno secundario">{comPermissoes ? PERMISSOES[p.permissao].nome : 'Acesso completo'}</span>
              )}
              {admin && !eu ? <Menu rotulo={`Ações de ${p.nome}`} itens={[{ rotulo: 'Tirar da conta…', icone: 'lixo', perigo: true, acao: () => tirar(p.id, p.nome) }]} /> : <span style={{ width: 30 }} />}
            </div>
          );
        })}
      </Secao>

      {admin &&
        (cheio ? (
          <Nota>
            {limite === 1 ? 'O plano Grátis é para 1 pessoa.' : `O plano ${s.plano.nome} permite até ${limite} pessoas.`} Para chamar mais gente, mude de plano em Plano e uso.
          </Nota>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await rodar(() => convidar.mutateAsync(convite), `Convite enviado para ${convite.email}`);
              setConvite(vazio);
            }}
          >
            <Secao titulo="Convidar pessoa" nota="A pessoa recebe um e-mail para criar a senha; o convite vale 7 dias. Para entrar, ela confirma um código enviado ao e-mail dela.">
              <LinhaCampo rotulo="Nome" id="convite-nome">
                <Entrada id="convite-nome" required minLength={2} value={convite.nome} onChange={(e) => setConvite({ ...convite, nome: e.target.value })} />
              </LinhaCampo>
              <LinhaCampo rotulo="E-mail" id="convite-email">
                <Entrada id="convite-email" type="email" required value={convite.email} onChange={(e) => setConvite({ ...convite, email: e.target.value })} />
              </LinhaCampo>
              {comPermissoes && (
                <LinhaCampo rotulo="Permissão" id="convite-permissao">
                  <Selecao id="convite-permissao" value={convite.permissao} onChange={(e) => setConvite({ ...convite, permissao: e.target.value as Permissao })} style={{ width: 160 }}>
                    {(Object.keys(PERMISSOES) as Permissao[]).map((k) => (
                      <option key={k} value={k}>
                        {PERMISSOES[k].nome}
                      </option>
                    ))}
                  </Selecao>
                </LinhaCampo>
              )}
              <div className="linha" style={{ justifyContent: 'flex-end' }}>
                <Botao type="submit" variante="primario" disabled={convidar.isPending}>
                  Enviar convite
                </Botao>
              </div>
            </Secao>
          </form>
        ))}
    </>
  );
}
