import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { PLANOS } from '../dados/planos';
import { CODIGO_ACESSO } from '../dados/seed';
import { acoes, contagem, useDb } from '../dados/store';
import type { Balcao, Conta } from '../dados/tipos';
import { Logo, Progresso, SeloConta, Status } from '../componentes/comuns';
import { Icone } from '../componentes/Icone';
import { dataLonga, plural, primeiroNome, soDigitos } from '../util';

/** O cliente entra uma vez por aba com o código do WhatsApp. */
const chaveAcesso = (codigo: string) => `trames:acesso:${codigo}`;
function temAcesso(codigo: string) {
  try {
    return sessionStorage.getItem(chaveAcesso(codigo)) === '1';
  } catch {
    return false;
  }
}

function useBalcao() {
  const { codigo = '' } = useParams();
  const db = useDb();
  const balcao = db.balcoes.find((b) => b.codigo === codigo);
  const conta = balcao && db.contas.find((c) => c.id === balcao.contaId);
  return { codigo, balcao, conta };
}

function Marca({ conta, grande = false }: { conta: Conta; grande?: boolean }) {
  const comMarca = PLANOS[conta.plano].recursos.marca;
  return (
    <div className="cliente__marca" style={grande ? { fontSize: 15 } : undefined}>
      {comMarca ? <SeloConta conta={conta} tamanho={grande ? 40 : 32} /> : <img src="/marca/trames-app-icon.svg" alt="" style={{ width: grande ? 40 : 32, height: grande ? 40 : 32 }} />}
      {conta.nome}
    </div>
  );
}

function Tela({ children }: { children: ReactNode }) {
  return (
    <div className="cliente">
      <div className="cliente__tela">
        {children}
        <div className="cliente__rodape">
          Enviado com <Logo altura={16} />
        </div>
      </div>
    </div>
  );
}

function NaoEncontrado() {
  return (
    <Tela>
      <h1 style={{ fontSize: 28, lineHeight: '32px' }}>Link não encontrado</h1>
      <p className="texto-suave">Confira se o endereço está completo ou peça um novo link ao escritório.</p>
    </Tela>
  );
}

export function ClienteAcesso() {
  const { codigo, balcao, conta } = useBalcao();
  const navegar = useNavigate();
  const [digitos, setDigitos] = useState<string[]>(Array(6).fill(''));
  const [erro, setErro] = useState('');
  const campos = useRef<(HTMLInputElement | null)[]>([]);

  if (!balcao || !conta) return <NaoEncontrado />;
  if (temAcesso(codigo)) return <Navigate to={`/b/${codigo}/lista`} replace />;

  const nome = primeiroNome(balcao.cliente.nome);

  function digitar(k: number, valor: string) {
    const so = soDigitos(valor);
    if (so.length > 1) {
      // colou o código inteiro
      const novos = so.slice(0, 6).split('');
      setDigitos([...novos, ...Array(6 - novos.length).fill('')]);
      campos.current[Math.min(novos.length, 5)]?.focus();
      return;
    }
    const novos = [...digitos];
    novos[k] = so;
    setDigitos(novos);
    if (so && k < 5) campos.current[k + 1]?.focus();
  }

  function entrar(e: FormEvent) {
    e.preventDefault();
    if (digitos.join('') !== CODIGO_ACESSO) return setErro('Código errado. Confira a mensagem no WhatsApp.');
    try {
      sessionStorage.setItem(chaveAcesso(codigo), '1');
    } catch {
      // segue sem lembrar o acesso
    }
    navegar(`/b/${codigo}/lista`);
  }

  return (
    <Tela>
      <Marca conta={conta} grande />
      <div className="coluna" style={{ gap: 10 }}>
        <h1 style={{ fontSize: 34, lineHeight: '38px', letterSpacing: '-.02em' }}>Olá, {nome}</h1>
        <p className="texto-suave">
          {conta.nome} está reunindo os documentos{balcao.tipo ? ` de ${balcao.tipo.toLowerCase()}` : ''} e pediu {plural(balcao.docs.length, 'item', 'itens')}. Você pode enviar tudo por aqui, pelo celular.
        </p>
      </div>
      <div className="aviso">
        <Icone nome="cadeado" />
        <p>Seus documentos ficam guardados com segurança e só o escritório consegue ver. Eles servem apenas para este processo.</p>
      </div>
      <form onSubmit={entrar} className="coluna" style={{ gap: 12 }}>
        <p style={{ fontSize: 15, lineHeight: '22px' }}>Enviamos um código de 6 números para o seu WhatsApp terminado em {soDigitos(balcao.cliente.whatsapp).slice(-4)}.</p>
        <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Código de acesso">
          {digitos.map((d, k) => (
            <input
              key={k}
              ref={(el) => (campos.current[k] = el)}
              aria-label={`Número ${k + 1}`}
              value={d}
              inputMode="numeric"
              autoComplete={k === 0 ? 'one-time-code' : 'off'}
              onChange={(e) => digitar(k, e.target.value)}
              onKeyDown={(e) => e.key === 'Backspace' && !d && k > 0 && campos.current[k - 1]?.focus()}
              style={{ width: 0, flex: 1, height: 52, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--tinta)', background: 'var(--areia-elevada)', border: `1px solid ${erro ? 'var(--recusado)' : 'var(--linha-forte)'}`, borderRadius: 10 }}
            />
          ))}
        </div>
        {erro && <p className="pequeno" style={{ color: 'var(--recusado)' }}>{erro}</p>}
        <div className="aviso aviso--plano">
          <Icone nome="info" />
          <span>
            Protótipo: o WhatsApp é simulado. Use o código <strong className="tr-protocolo">{CODIGO_ACESSO}</strong>.
          </span>
        </div>
        <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} disabled={digitos.join('').length < 6}>
          Entrar
        </button>
      </form>
    </Tela>
  );
}

function Protegida({ children }: { children: (b: Balcao, conta: Conta) => ReactNode }) {
  const { codigo, balcao, conta } = useBalcao();
  if (!balcao || !conta) return <NaoEncontrado />;
  if (!temAcesso(codigo)) return <Navigate to={`/b/${codigo}`} replace />;
  return <>{children(balcao, conta)}</>;
}

export function ClienteLista() {
  return (
    <Protegida>
      {(b, conta) => {
        const c = contagem(b);
        const faltam = b.docs.filter((d) => d.status === 'pendente' || d.status === 'recusado');
        const feitos = b.docs.filter((d) => d.status === 'aprovado' || d.status === 'analise');
        const titulo = faltam.length ? `Falta${faltam.length > 1 ? 'm' : ''} ${plural(faltam.length, 'documento', 'documentos')}` : 'Tudo enviado';
        return (
          <Tela>
            <Marca conta={conta} />
            <div className="coluna" style={{ gap: 12, padding: '0 4px' }}>
              <h1 style={{ fontSize: 28, lineHeight: '32px', letterSpacing: '-.02em' }}>{titulo}</h1>
              <Progresso
                feitos={c.aprovado}
                total={c.total}
                rotulo={`${plural(c.aprovado, 'aprovado', 'aprovados')}${c.analise ? `, ${c.analise} em conferência` : ''}`}
                direita={b.concluidoEm ? 'concluído' : `até ${dataLonga(b.prazo)}`}
              />
            </div>
            {!faltam.length && (
              <Link to={`/b/${b.codigo}/pronto`} className="tr-btn tr-btn--secundario tr-btn--bloco">
                Ver resumo
              </Link>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {faltam.map((d) => (
                <li key={d.id}>
                  <Link to={`/b/${b.codigo}/enviar/${d.id}`} className="item-cliente">
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500 }}>
                        {d.nome}
                        {!d.obrigatorio && <span className="texto-suave" style={{ fontWeight: 400, fontSize: 13 }}> · se tiver</span>}
                      </span>
                      {d.status === 'recusado' ? <span className="miudo" style={{ color: 'var(--recusado)' }}>Precisa enviar de novo: {d.motivo}</span> : <span className="miudo texto-suave">{d.detalhe}</span>}
                    </span>
                    <span className="pequeno" style={{ fontWeight: 500, color: 'var(--mangue)' }}>
                      Enviar
                    </span>
                  </Link>
                </li>
              ))}
              {feitos.map((d) => (
                <li key={d.id} className="item-cliente item-cliente--feito">
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500 }}>{d.nome}</span>
                    {d.status === 'analise' && <span className="miudo texto-suave">Enviado. O escritório vai conferir.</span>}
                  </span>
                  <Status status={d.status} />
                </li>
              ))}
            </ul>
            <p className="pequeno texto-suave" style={{ padding: '0 4px' }}>
              Ficou com dúvida sobre algum documento? Fale com o escritório pelo WhatsApp que você já usa.
            </p>
          </Tela>
        );
      }}
    </Protegida>
  );
}

export function ClienteEnviar() {
  const { docId } = useParams();
  const navegar = useNavigate();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const foto = useRef<HTMLInputElement>(null);
  const qualquer = useRef<HTMLInputElement>(null);

  function escolher(f: File | undefined) {
    if (!f) return;
    setArquivo(f);
    setPrevia(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  }

  return (
    <Protegida>
      {(b) => {
        const doc = b.docs.find((d) => d.id === docId);
        if (!doc) return <Navigate to={`/b/${b.codigo}/lista`} replace />;
        const faltam = b.docs.filter((d) => (d.status === 'pendente' || d.status === 'recusado') && d.id !== doc.id).length;
        return (
          <Tela>
            <Link to={`/b/${b.codigo}/lista`} className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start', paddingLeft: 4 }}>
              <Icone nome="voltar" />
              Documentos
            </Link>
            <div className="coluna" style={{ padding: '0 4px' }}>
              <h1 style={{ fontSize: 28, lineHeight: '32px', letterSpacing: '-.02em' }}>{doc.nome}</h1>
              <p className="texto-suave" style={{ fontSize: 15, lineHeight: '22px' }}>
                {doc.detalhe}
              </p>
            </div>
            {doc.status === 'recusado' && !enviado && <div className="tr-item__motivo">O escritório pediu: {doc.motivo}</div>}

            <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => escolher(e.target.files?.[0])} />
            <input ref={qualquer} type="file" accept="image/*,application/pdf" hidden onChange={(e) => escolher(e.target.files?.[0])} />

            {enviado ? (
              <div className="coluna" style={{ gap: 16, alignItems: 'center', textAlign: 'center', padding: '24px 8px 0' }}>
                <span style={{ width: 64, height: 64, borderRadius: 9999, background: 'var(--mangue-suave)', color: 'var(--mangue)', display: 'grid', placeItems: 'center' }}>
                  <Icone nome="check" tamanho={30} />
                </span>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: '28px', fontWeight: 600 }}>Documento enviado</p>
                <p className="texto-suave" style={{ fontSize: 15 }}>
                  O escritório vai conferir e, se precisar de algo, você recebe um aviso. {faltam ? `Falta${faltam > 1 ? 'm' : ''} ${plural(faltam, 'documento', 'documentos')}.` : 'Era o último!'}
                </p>
                <button type="button" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} onClick={() => navegar(faltam ? `/b/${b.codigo}/lista` : `/b/${b.codigo}/pronto`)}>
                  {faltam ? 'Voltar para a lista' : 'Concluir'}
                </button>
              </div>
            ) : arquivo ? (
              <div className="coluna" style={{ gap: 14 }}>
                <div style={{ background: 'var(--areia-funda)', borderRadius: 16, padding: 18, display: 'flex', justifyContent: 'center' }}>
                  {previa ? (
                    <img src={previa} alt="Prévia do arquivo escolhido" style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 4, boxShadow: 'var(--shadow-sm)' }} />
                  ) : (
                    <div className="coluna" style={{ alignItems: 'center', padding: 24 }}>
                      <Icone nome="envio" tamanho={32} />
                      <span className="tr-protocolo">{arquivo.name}</span>
                    </div>
                  )}
                </div>
                <p className="pequeno texto-suave" style={{ textAlign: 'center' }}>
                  Dá para ler tudo direitinho? Se sim, é só enviar.
                </p>
                <button
                  type="button"
                  className="tr-btn tr-btn--primario tr-btn--bloco"
                  style={{ height: 52, fontSize: 16 }}
                  onClick={() => {
                    acoes.enviarDocumento(b.id, doc.id, arquivo.name);
                    setEnviado(true);
                  }}
                >
                  Enviar documento
                </button>
                <button type="button" className="tr-btn tr-btn--secundario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} onClick={() => setArquivo(null)}>
                  Escolher outro
                </button>
              </div>
            ) : (
              <div className="coluna" style={{ gap: 16 }}>
                <div className="tr-envio" style={{ maxWidth: 'none', padding: '28px 20px' }}>
                  <span className="tr-envio__icone">
                    <Icone nome="envio" />
                  </span>
                  <div>
                    <p className="tr-envio__titulo">Envie uma foto ou um PDF</p>
                    <p className="tr-envio__dica">Até 10 MB.</p>
                  </div>
                  <div className="coluna" style={{ gap: 10, width: '100%' }}>
                    <button type="button" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} onClick={() => foto.current?.click()}>
                      <Icone nome="camera" />
                      Tirar foto
                    </button>
                    <button type="button" className="tr-btn tr-btn--secundario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} onClick={() => qualquer.current?.click()}>
                      Escolher arquivo
                    </button>
                  </div>
                </div>
                <div className="aviso">
                  <Icone nome="info" />
                  <span>Coloque o documento em cima de uma mesa, perto de uma janela, e enquadre a folha inteira.</span>
                </div>
              </div>
            )}
          </Tela>
        );
      }}
    </Protegida>
  );
}

export function ClientePronto() {
  return (
    <Protegida>
      {(b, conta) => {
        const c = contagem(b);
        return (
          <Tela>
            <Marca conta={conta} />
            <div className="coluna" style={{ gap: 14, padding: '28px 4px 0' }}>
              <svg viewBox="0 0 96 64" style={{ width: 96, height: 64 }} aria-hidden="true">
                <path d="M8 62V40a40 40 0 0 1 80 0v22" fill="none" stroke="var(--mangue-suave)" strokeWidth="10" strokeLinecap="round" />
                <path d="M30 62V44a18 18 0 0 1 36 0v18" fill="none" stroke="var(--mangue)" strokeWidth="10" strokeLinecap="round" />
              </svg>
              <h1 style={{ fontSize: 34, lineHeight: '38px', letterSpacing: '-.02em' }}>Pronto, {primeiroNome(b.cliente.nome)}</h1>
              <p className="texto-suave">Recebemos {plural(c.total - c.pendente - c.recusado, 'documento', 'documentos')}. O escritório vai conferir e, se precisar de algo, você recebe um aviso pelo WhatsApp.</p>
            </div>
            <div className="cartao" style={{ padding: 16, gap: 12 }}>
              <Progresso feitos={c.aprovado} total={c.total} rotulo={`${plural(c.aprovado, 'aprovado', 'aprovados')}, ${c.analise} em conferência`} direita={`${c.total - c.pendente - c.recusado} de ${c.total}`} />
              <p className="pequeno texto-suave">Você pode voltar por este mesmo link quando quiser para ver como está cada documento.</p>
              <Link to={`/b/${b.codigo}/lista`} className="tr-btn tr-btn--secundario tr-btn--bloco" style={{ height: 48 }}>
                Ver meus documentos
              </Link>
            </div>
          </Tela>
        );
      }}
    </Protegida>
  );
}
