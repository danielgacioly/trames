import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ehTipoPermitido, TAMANHO_MAXIMO_ARQUIVO } from '@trames/shared/arquivos';
import type {
  AcessoInfo,
  BalcaoCliente,
  ItemCliente,
  MarcaDto,
  StatusItem,
  UploadIniciado,
} from '@trames/shared';
import { api, ErroDaApi, tokenDoLink } from './api';

/*
 * Tela do cliente no celular. App separado do painel: pacote pequeno para abrir
 * pelo 4G e nenhum código do painel exposto a quem só recebeu um link.
 */

const ICONES = {
  voltar: 'M15 6l-6 6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lupa: 'M11 4.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM16 16l4 4',
  relogio: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17zM12 7.5V12l3 2',
  xis: 'M7 7l10 10M17 7L7 17',
  envio: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.6-2h5.4l1.6 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 9a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7z',
  cadeado: 'M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3',
  info: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17zM12 11v5M12 8v.1',
};

function Icone({ nome, tamanho }: { nome: keyof typeof ICONES; tamanho?: number }) {
  return (
    <svg className="tr-icone" viewBox="0 0 24 24" aria-hidden="true" style={tamanho ? { width: tamanho, height: tamanho } : undefined}>
      <path d={ICONES[nome]} />
    </svg>
  );
}

const STATUS: Record<StatusItem, { texto: string; classe: string; icone: keyof typeof ICONES }> = {
  aprovado: { texto: 'Aprovado', classe: 'tr-status--aprovado', icone: 'check' },
  analise: { texto: 'Em análise', classe: 'tr-status--analise', icone: 'lupa' },
  pendente: { texto: 'Pendente', classe: 'tr-status--pendente', icone: 'relogio' },
  recusado: { texto: 'Recusado', classe: 'tr-status--recusado', icone: 'xis' },
};

function Status({ status }: { status: StatusItem }) {
  const s = STATUS[status];
  return (
    <span className={`tr-status ${s.classe}`}>
      <Icone nome={s.icone} />
      {s.texto}
    </span>
  );
}

function Logo({ altura }: { altura: number }) {
  return (
    <span className="tr-logo" style={{ '--logo-h': `${altura}px` } as React.CSSProperties} role="img" aria-label="trames">
      <svg viewBox="0 0 40 32" aria-hidden="true">
        <path d="M4.5 29.5V18a15.5 15.5 0 0 1 31 0v11.5" />
        <path d="M13.5 29.5V20.5a6.5 6.5 0 0 1 13 0v9" />
      </svg>
      <span>trames</span>
    </span>
  );
}

function Marca({ org, grande = false }: { org: MarcaDto; grande?: boolean }) {
  const t = grande ? 40 : 32;
  return (
    <div className="cliente__marca" style={grande ? { fontSize: 15 } : undefined}>
      {org.comMarca ? (
        <span className="selo" style={{ background: org.cor, width: t, height: t, fontSize: t * 0.36, borderRadius: t / 4 }}>
          {org.sigla}
        </span>
      ) : (
        <img src="/marca/trames-app-icon.svg" alt="" style={{ width: t, height: t }} />
      )}
      {org.nome}
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

function Erro({ texto }: { texto: string }) {
  return (
    <div className="aviso" role="alert" style={{ background: 'var(--recusado-suave)', color: 'var(--recusado)' }}>
      <Icone nome="info" />
      <span>{texto}</span>
    </div>
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataLonga = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;

/* ---------- Acesso: link + código ---------- */

function Acesso({ token, entrou }: { token: string; entrou: () => void }) {
  const [info, setInfo] = useState<AcessoInfo | null>(null);
  const [erro, setErro] = useState('');
  const [canal, setCanal] = useState<'whatsapp' | 'email' | null>(null);
  const [digitos, setDigitos] = useState<string[]>(Array(6).fill(''));
  const campos = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    api<AcessoInfo>('GET', '/acesso', undefined, token).then(setInfo, (e) => setErro(e.message));
  }, [token]);

  async function pedir(c: 'whatsapp' | 'email') {
    setErro('');
    try {
      await api('POST', '/acesso/codigo', { canal: c }, token);
      setCanal(c);
      setTimeout(() => campos.current[0]?.focus(), 50);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  function digitar(k: number, valor: string) {
    const so = valor.replace(/\D/g, '');
    if (so.length > 1) {
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

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await api('POST', '/acesso/entrar', { codigo: digitos.join('') }, token);
      entrou();
    } catch (x) {
      setErro((x as Error).message);
      if (x instanceof ErroDaApi && x.codigo === 'codigo_vencido') setCanal(null);
    }
  }

  if (!info) return <Tela>{erro ? <Erro texto={erro} /> : <p className="texto-suave">Abrindo…</p>}</Tela>;

  return (
    <Tela>
      <Marca org={info.organizacao} grande />
      <div className="coluna" style={{ gap: 10 }}>
        <h1 style={{ fontSize: 34, lineHeight: '38px', letterSpacing: '-.02em' }}>Olá, {info.clientePrimeiroNome}</h1>
        <p className="texto-suave">
          {info.organizacao.nome} está reunindo os documentos{info.tipo ? ` de ${info.tipo.toLowerCase()}` : ''} e pediu {plural(info.totalItens, 'item', 'itens')}. Você pode enviar tudo por aqui, pelo celular.
        </p>
      </div>
      <div className="aviso">
        <Icone nome="cadeado" />
        <p>Seus documentos ficam guardados com segurança e só o escritório consegue ver. Eles servem apenas para este processo.</p>
      </div>
      {erro && <Erro texto={erro} />}
      {canal ? (
        <form onSubmit={entrar} className="coluna" style={{ gap: 12 }}>
          <p style={{ fontSize: 15, lineHeight: '22px' }}>{canal === 'whatsapp' ? `Enviamos um código de 6 números para o seu WhatsApp terminado em ${info.whatsappFinal}.` : 'Enviamos um código de 6 números para o seu e-mail.'}</p>
          <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Código de acesso">
            {digitos.map((d, k) => (
              <input
                key={k}
                ref={(el) => {
                  campos.current[k] = el;
                }}
                aria-label={`Número ${k + 1}`}
                value={d}
                inputMode="numeric"
                autoComplete={k === 0 ? 'one-time-code' : 'off'}
                onChange={(e) => digitar(k, e.target.value)}
                onKeyDown={(e) => e.key === 'Backspace' && !d && k > 0 && campos.current[k - 1]?.focus()}
                style={{ width: 0, flex: 1, height: 52, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--tinta)', background: 'var(--areia-elevada)', border: '1px solid var(--linha-forte)', borderRadius: 10 }}
              />
            ))}
          </div>
          <p className="pequeno texto-suave">
            Não chegou?{' '}
            <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ padding: 0, height: 'auto' }} onClick={() => pedir(canal)}>
              Enviar de novo
            </button>
            {info.temEmail && canal === 'whatsapp' && (
              <>
                {' '}ou{' '}
                <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ padding: 0, height: 'auto' }} onClick={() => pedir('email')}>
                  receber por e-mail
                </button>
              </>
            )}
          </p>
          {import.meta.env.DEV && (
            <button
              type="button"
              className="tr-btn tr-btn--discreto tr-btn--sm"
              style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
              onClick={() => api<{ codigo: string | null }>('GET', '/acesso/dev-codigo', undefined, token).then((r) => r.codigo && setDigitos(r.codigo.split('')))}
            >
              Desenvolvimento: preencher o código da caixa de saída
            </button>
          )}
          <button type="submit" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} disabled={digitos.join('').length < 6}>
            Entrar
          </button>
        </form>
      ) : (
        <div className="coluna" style={{ gap: 10 }}>
          <button type="button" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} onClick={() => pedir('whatsapp')}>
            Receber código no WhatsApp
          </button>
          {info.temEmail && (
            <button type="button" className="tr-btn tr-btn--secundario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} onClick={() => pedir('email')}>
              Receber por e-mail
            </button>
          )}
        </div>
      )}
    </Tela>
  );
}

/* ---------- Lista ---------- */

function Lista({ b, abrir, verResumo }: { b: BalcaoCliente; abrir: (i: ItemCliente) => void; verResumo: () => void }) {
  const faltam = b.itens.filter((i) => (i.status === 'pendente' || i.status === 'recusado') && !i.verificando);
  const feitos = b.itens.filter((i) => !faltam.includes(i));
  const aprovados = b.itens.filter((i) => i.status === 'aprovado').length;
  const analise = b.itens.filter((i) => i.status === 'analise' || i.verificando).length;
  const p = Math.round((aprovados / b.itens.length) * 100);
  return (
    <Tela>
      <Marca org={b.organizacao} />
      <div className="coluna" style={{ gap: 12, padding: '0 4px' }}>
        <h1 style={{ fontSize: 28, lineHeight: '32px', letterSpacing: '-.02em' }}>{faltam.length ? `Falta${faltam.length > 1 ? 'm' : ''} ${plural(faltam.length, 'documento', 'documentos')}` : 'Tudo enviado'}</h1>
        <div className="tr-progresso" style={{ gap: 6 }}>
          <div className="tr-progresso__topo" style={{ fontSize: 13, lineHeight: '18px' }}>
            <span>
              {plural(aprovados, 'aprovado', 'aprovados')}
              {analise ? `, ${analise} em conferência` : ''}
            </span>
            <span>{b.concluido ? 'concluído' : `até ${dataLonga(b.prazo)}`}</span>
          </div>
          <div className="tr-progresso__trilho">
            <div className="tr-progresso__barra" style={{ '--p': `${p}%` } as React.CSSProperties} />
          </div>
        </div>
      </div>
      {!faltam.length && (
        <button type="button" className="tr-btn tr-btn--secundario tr-btn--bloco" onClick={verResumo}>
          Ver resumo
        </button>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!b.concluido &&
          faltam.map((d) => (
            <li key={d.id}>
              <button type="button" className="item-cliente" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => abrir(d)}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 500 }}>
                    {d.nome}
                    {!d.obrigatorio && (
                      <span className="texto-suave" style={{ fontWeight: 400, fontSize: 13 }}>
                        {' '}· se tiver
                      </span>
                    )}
                  </span>
                  {d.motivo ? (
                    <span className="miudo" style={{ color: 'var(--recusado)' }}>
                      Precisa enviar de novo: {d.motivo}
                    </span>
                  ) : (
                    <span className="miudo texto-suave">{d.detalhe}</span>
                  )}
                </span>
                <span className="pequeno" style={{ fontWeight: 500, color: 'var(--mangue)' }}>
                  Enviar
                </span>
              </button>
            </li>
          ))}
        {feitos.map((d) => (
          <li key={d.id} className="item-cliente item-cliente--feito">
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 500 }}>{d.nome}</span>
              {d.verificando && <span className="miudo texto-suave">Recebido. Estamos verificando o arquivo.</span>}
              {d.status === 'analise' && <span className="miudo texto-suave">Enviado. O escritório vai conferir.</span>}
            </span>
            {d.verificando ? <Status status="analise" /> : <Status status={d.status} />}
          </li>
        ))}
      </ul>
      <p className="pequeno texto-suave" style={{ padding: '0 4px' }}>
        Ficou com dúvida sobre algum documento? Fale com o escritório pelo WhatsApp que você já usa.
      </p>
    </Tela>
  );
}

/* ---------- Enviar um documento ---------- */

function Enviar({ item, voltar, enviado }: { item: ItemCliente; voltar: () => void; enviado: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const foto = useRef<HTMLInputElement>(null);
  const qualquer = useRef<HTMLInputElement>(null);
  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  function escolher(f: File | undefined) {
    setErro('');
    if (!f) return;
    if (!ehTipoPermitido(f.type)) return setErro('Envie uma foto (JPG, PNG, HEIC) ou um PDF.');
    if (f.size > TAMANHO_MAXIMO_ARQUIVO) return setErro('O arquivo passa de 10 MB. Tente uma foto com menos resolução.');
    setArquivo(f);
    setPrevia(f.type.startsWith('image/') && f.type !== 'image/heic' ? URL.createObjectURL(f) : null);
  }

  async function mandar() {
    if (!arquivo) return;
    setEnviando(true);
    setErro('');
    try {
      const u = await api<UploadIniciado>('POST', `/cliente/itens/${item.id}/upload`, { nomeArquivo: arquivo.name.slice(0, 200), tipo: arquivo.type, tamanho: arquivo.size });
      // O arquivo vai direto do celular para o storage, sem passar pela API.
      const corpo = new FormData();
      Object.entries(u.campos).forEach(([k, v]) => corpo.append(k, v));
      corpo.append('file', arquivo);
      const r = await fetch(u.url, { method: 'POST', body: corpo });
      if (!r.ok) throw new Error('O envio não terminou. Confira a internet e tente de novo.');
      await api('POST', `/cliente/documentos/${u.documentoId}/enviado`);
      enviado();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" style={{ alignSelf: 'flex-start', paddingLeft: 4 }} onClick={voltar}>
        <Icone nome="voltar" />
        Documentos
      </button>
      <div className="coluna" style={{ padding: '0 4px' }}>
        <h1 style={{ fontSize: 28, lineHeight: '32px', letterSpacing: '-.02em' }}>{item.nome}</h1>
        <p className="texto-suave" style={{ fontSize: 15, lineHeight: '22px' }}>
          {item.detalhe}
        </p>
      </div>
      {item.motivo && <div className="tr-item__motivo">O escritório pediu: {item.motivo}</div>}
      <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => escolher(e.target.files?.[0])} />
      <input ref={qualquer} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" hidden onChange={(e) => escolher(e.target.files?.[0])} />
      {erro && <Erro texto={erro} />}
      {arquivo ? (
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
          <button type="button" className="tr-btn tr-btn--primario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} disabled={enviando} onClick={mandar}>
            {enviando ? 'Enviando…' : 'Enviar documento'}
          </button>
          <button type="button" className="tr-btn tr-btn--secundario tr-btn--bloco" style={{ height: 52, fontSize: 16 }} disabled={enviando} onClick={() => setArquivo(null)}>
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
}

function Pronto({ b, voltar }: { b: BalcaoCliente; voltar: () => void }) {
  const enviados = b.itens.filter((i) => i.status !== 'pendente' || i.verificando).length;
  return (
    <Tela>
      <Marca org={b.organizacao} />
      <div className="coluna" style={{ gap: 14, padding: '28px 4px 0' }}>
        <svg viewBox="0 0 96 64" style={{ width: 96, height: 64 }} aria-hidden="true">
          <path d="M8 62V40a40 40 0 0 1 80 0v22" fill="none" stroke="var(--mangue-suave)" strokeWidth="10" strokeLinecap="round" />
          <path d="M30 62V44a18 18 0 0 1 36 0v18" fill="none" stroke="var(--mangue)" strokeWidth="10" strokeLinecap="round" />
        </svg>
        <h1 style={{ fontSize: 34, lineHeight: '38px', letterSpacing: '-.02em' }}>Pronto, {b.clientePrimeiroNome}</h1>
        <p className="texto-suave">Recebemos {plural(enviados, 'documento', 'documentos')}. O escritório vai conferir e, se precisar de algo, você recebe um aviso.</p>
      </div>
      <button type="button" className="tr-btn tr-btn--secundario tr-btn--bloco" style={{ height: 48 }} onClick={voltar}>
        Ver meus documentos
      </button>
    </Tela>
  );
}

/* ---------- Controle das telas ---------- */

type Etapa = { tela: 'carregando' } | { tela: 'acesso'; token: string } | { tela: 'lista' } | { tela: 'enviar'; item: ItemCliente } | { tela: 'pronto' } | { tela: 'erro'; texto: string };

export function App() {
  const [{ token, novo }] = useState(tokenDoLink);
  const [etapa, setEtapa] = useState<Etapa>({ tela: 'carregando' });
  const [balcao, setBalcao] = useState<BalcaoCliente | null>(null);

  const carregar = useCallback(async () => {
    try {
      const b = await api<BalcaoCliente>('GET', '/cliente/balcao');
      setBalcao(b);
      return b;
    } catch (e) {
      if (e instanceof ErroDaApi && e.status === 401) {
        setEtapa(token ? { tela: 'acesso', token } : { tela: 'erro', texto: 'Abra o link que o escritório mandou para você.' });
        return null;
      }
      setEtapa({ tela: 'erro', texto: (e as Error).message });
      return null;
    }
  }, [token]);

  useEffect(() => {
    // Link novo na URL: pede o código de novo, mesmo que haja uma sessão antiga nesta aba.
    if (novo && token) setEtapa({ tela: 'acesso', token });
    else carregar().then((b) => b && setEtapa({ tela: 'lista' }));
  }, [novo, token, carregar]);

  // Enquanto algum arquivo está no antivírus, atualiza a lista sozinho.
  useEffect(() => {
    if (etapa.tela !== 'lista' || !balcao?.itens.some((i) => i.verificando)) return;
    const t = setTimeout(carregar, 2500);
    return () => clearTimeout(t);
  }, [etapa, balcao, carregar]);

  if (etapa.tela === 'carregando') return <Tela>{<p className="texto-suave">Abrindo…</p>}</Tela>;
  if (etapa.tela === 'erro') return <Tela>{<Erro texto={etapa.texto} />}</Tela>;
  if (etapa.tela === 'acesso') return <Acesso token={etapa.token} entrou={() => carregar().then((b) => b && setEtapa({ tela: 'lista' }))} />;
  if (!balcao) return null;
  if (etapa.tela === 'enviar')
    return (
      <Enviar
        item={etapa.item}
        voltar={() => setEtapa({ tela: 'lista' })}
        enviado={() =>
          carregar().then((b) => {
            const faltam = b?.itens.filter((i) => (i.status === 'pendente' || i.status === 'recusado') && !i.verificando).length ?? 0;
            setEtapa({ tela: faltam ? 'lista' : 'pronto' });
          })
        }
      />
    );
  if (etapa.tela === 'pronto') return <Pronto b={balcao} voltar={() => setEtapa({ tela: 'lista' })} />;
  return <Lista b={balcao} abrir={(item) => setEtapa({ tela: 'enviar', item })} verResumo={() => setEtapa({ tela: 'pronto' })} />;
}
