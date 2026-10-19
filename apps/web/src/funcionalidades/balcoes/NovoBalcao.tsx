import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PRECO_EXCEDENTE_CENTAVOS, type CanalCodigo, type ItemEntrada, type LinkGerado } from '@trames/shared';
import { api } from '../../dados/api';
import { chaves, useAcao, useCobranca, useModelos, useSessao } from '../../dados/consultas';
import { AvisoErro, Bloqueado, Botao, BotaoLink, Carregando, Entrada, Interruptor, LinhaCampo, Nota, Pagina, Secao, Selecao, useDialogos, useNotificar } from '../../ui';
import { diaDaqui, moeda, plural, soDigitos } from '../../util/formatos';
import { comChave, juntar, ListaDocumentos, PuxarModelo, type Item } from './ListaDocumentos';

/** Carrega o modelo (se veio ?modelo=) antes de montar o formulário. */
export function NovoBalcao() {
  const [params] = useSearchParams();
  const local = useLocation();
  const modelos = useModelos();
  const idModelo = params.get('modelo');
  if (idModelo && modelos.isPending) return <Carregando />;
  const modelo = modelos.data?.find((m) => m.id === idModelo);
  const doTuru = local.state as { itens?: ItemEntrada[]; tipo?: string } | null;
  return <Formulario key={idModelo ?? 'novo'} modelo={modelo} doTuru={doTuru} />;
}

function Canal({ id, valor, mudar, pode }: { id: string; valor: CanalCodigo; mudar: (c: CanalCodigo) => void; pode: boolean }) {
  return (
    <Selecao id={id} value={pode ? valor : 'email'} disabled={!pode} onChange={(e) => mudar(e.target.value as CanalCodigo)} style={{ width: 160 }}>
      <option value="email">E-mail</option>
      <option value="whatsapp">WhatsApp</option>
    </Selecao>
  );
}

function Formulario({ modelo, doTuru }: { modelo?: { nome: string; itens: ItemEntrada[] }; doTuru: { itens?: ItemEntrada[]; tipo?: string } | null }) {
  const s = useSessao();
  const navegar = useNavigate();
  const { confirmar } = useDialogos();
  const notificar = useNotificar();
  const uso = useCobranca().data;
  const [cliente, setCliente] = useState({ nome: '', email: '', whatsapp: '', cpf: '' });
  const [tipo, setTipo] = useState(doTuru?.tipo ?? modelo?.nome ?? '');
  const [prazo, setPrazo] = useState(diaDaqui(21));
  const [itens, setItens] = useState<Item[]>(() => comChave(doTuru?.itens ?? modelo?.itens ?? []));
  const [canalCodigo, setCanalCodigo] = useState<CanalCodigo>('email');
  const [lembrete, setLembrete] = useState(true);
  const [canalLembrete, setCanalLembrete] = useState<CanalCodigo>('email');
  const [erro, setErro] = useState<unknown>(null);
  const criar = useAcao((corpo: unknown) => api<{ id: string; link: LinkGerado; excedente: boolean }>('POST', '/balcoes', corpo), [chaves.balcoes, chaves.cobranca, chaves.clientes]);

  const p = s.plano;
  const soConfere = s.tem('permissoes') && s.usuario.permissao === 'confere';
  const noLimite = p.limiteBalcoes !== null && (uso?.balcoesAtivos ?? 0) >= p.limiteBalcoes;
  const vaiExceder = p.balcoesNoMes !== null && (uso?.balcoesNoMes ?? 0) >= p.balcoesNoMes;
  const comWhatsapp = s.tem('whatsapp');
  const usaWhatsapp = comWhatsapp && (canalCodigo === 'whatsapp' || (lembrete && canalLembrete === 'whatsapp'));
  const campo = (k: keyof typeof cliente) => ({ id: `cliente-${k}`, value: cliente[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCliente({ ...cliente, [k]: e.target.value }) });

  function falhar(mensagem: string) {
    setErro(new Error(mensagem));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const lista = itens.filter((i) => i.nome.trim());
    if (!lista.length) return falhar('Inclua pelo menos um documento.');
    if (soDigitos(cliente.whatsapp).length < 10) return falhar('Confira o WhatsApp do cliente, com DDD.');
    if (vaiExceder) {
      const ok = await confirmar({
        titulo: 'Criar balcão excedente?',
        texto: `A conta já criou ${uso?.balcoesNoMes} balcões neste mês e o plano ${p.nome} inclui ${p.balcoesNoMes}. Este balcão custa ${moeda(PRECO_EXCEDENTE_CENTAVOS)}, somado à próxima fatura.`,
        confirmar: 'Criar balcão',
      });
      if (!ok) return;
    }
    try {
      const b = await criar.mutateAsync({
        tipo: tipo.trim(),
        cliente: { ...cliente, nome: cliente.nome.trim(), email: cliente.email.trim() },
        prazo,
        canalCodigo: comWhatsapp ? canalCodigo : 'email',
        lembrete,
        canalLembrete: comWhatsapp ? canalLembrete : 'email',
        itens: lista.map(({ nome, detalhe, obrigatorio }) => ({ nome: nome.trim(), detalhe: detalhe.trim(), obrigatorio })),
      });
      notificar({ titulo: 'Balcão criado', texto: b.excedente ? `Cobrado como excedente (${moeda(PRECO_EXCEDENTE_CENTAVOS)}).` : undefined });
      navegar(`/app/balcao/${b.id}/link`, { state: { link: b.link }, replace: true });
    } catch (e) {
      setErro(e);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const bloqueio = soConfere
    ? 'Sua permissão nesta conta é só de conferir documentos. Quem administra a conta pode mudar em Minha conta › Equipe.'
    : noLimite
      ? `Você está usando os ${p.limiteBalcoes} balcões ativos do plano ${p.nome}. Conclua um balcão que já terminou ou mude de plano para abrir outro.`
      : null;

  return (
    <form onSubmit={enviar}>
      <Pagina
        estreita
        voltar={{ para: '/app', rotulo: 'Balcões' }}
        titulo="Novo balcão"
        subtitulo={modelo ? `A partir do modelo ${modelo.nome}` : doTuru ? 'Com a lista montada pelo Turu' : 'O cliente não cria conta: recebe um link e um código de acesso.'}
        ferramentas={
          <>
            <BotaoLink to="/app">Cancelar</BotaoLink>
            <Botao type="submit" variante="primario" disabled={!!bloqueio || criar.isPending}>
              {criar.isPending ? 'Criando…' : 'Criar balcão'}
            </Botao>
          </>
        }
      >
        {bloqueio && <Nota>{bloqueio}</Nota>}
        <AvisoErro erro={erro} />

        <fieldset disabled={!!bloqueio} className="pilha" style={{ border: 0, margin: 0, padding: 0, gap: 22 }}>
          <Secao titulo="Cliente" nota="O e-mail é obrigatório: por ele vão o código de acesso, os lembretes e os avisos, e é para onde as mensagens vão se o WhatsApp falhar.">
            <LinhaCampo rotulo="Nome completo" id="cliente-nome">
              <Entrada required minLength={2} autoComplete="off" {...campo('nome')} />
            </LinhaCampo>
            <LinhaCampo rotulo="E-mail" id="cliente-email">
              <Entrada type="email" required autoComplete="off" {...campo('email')} />
            </LinhaCampo>
            <LinhaCampo rotulo="WhatsApp" id="cliente-whatsapp">
              <Entrada inputMode="tel" required placeholder="(81) 90000-0000" {...campo('whatsapp')} />
            </LinhaCampo>
            <LinhaCampo rotulo="CPF (opcional)" id="cliente-cpf">
              <Entrada inputMode="numeric" placeholder="000.000.000-00" {...campo('cpf')} />
            </LinhaCampo>
          </Secao>

          <Secao titulo="Caso">
            <LinhaCampo rotulo="Tipo" id="tipo">
              <Entrada id="tipo" placeholder="Ex.: Inventário" value={tipo} onChange={(e) => setTipo(e.target.value)} />
            </LinhaCampo>
            <LinhaCampo rotulo="Prazo para o cliente" id="prazo">
              <Entrada id="prazo" type="date" required value={prazo} min={diaDaqui(0)} onChange={(e) => setPrazo(e.target.value)} style={{ width: 160 }} />
            </LinhaCampo>
          </Secao>

          <section className="secao">
            <div className="secao__cabeca">
              <h2 className="titulo-secao">Documentos</h2>
              <span className="pequeno terciario">{plural(itens.length, 'item', 'itens')}</span>
            </div>
            <ListaDocumentos itens={itens} mudar={setItens} rodape={<PuxarModelo adicionar={(novos) => setItens(juntar(itens, novos))} />} />
            <p className="secao__nota">O cliente vê a lista nesta ordem. Escreva o que serve em cada item como você explicaria a ele.</p>
          </section>

          <Secao
            titulo="Acesso e lembretes"
            nota={
              !comWhatsapp ? (
                <Bloqueado recurso="whatsapp" />
              ) : usaWhatsapp ? (
                `Mensagens pelo WhatsApp contam na cota do plano (${p.cotaWhatsapp.toLocaleString('pt-BR')} por mês${uso ? `, ${uso.whatsappEnviados.toLocaleString('pt-BR')} usadas` : ''}). Se a cota acabar, vão por e-mail.`
              ) : undefined
            }
          >
            <LinhaCampo rotulo="Código de acesso por" id="canal-codigo">
              <Canal id="canal-codigo" valor={canalCodigo} mudar={setCanalCodigo} pode={comWhatsapp} />
            </LinhaCampo>
            <div className="linha">
              <span className="linha__corpo">
                <span>Lembrar o cliente</span>
                <span className="linha__sub">3 dias antes do prazo, no dia e 2 dias depois, se ainda faltar documento obrigatório.</span>
              </span>
              <Interruptor rotulo="Lembrar o cliente" ligado={lembrete} mudar={setLembrete} />
            </div>
            {lembrete && (
              <LinhaCampo rotulo="Lembretes por" id="canal-lembrete">
                <Canal id="canal-lembrete" valor={canalLembrete} mudar={setCanalLembrete} pode={comWhatsapp} />
              </LinhaCampo>
            )}
          </Secao>
        </fieldset>
      </Pagina>
    </form>
  );
}
