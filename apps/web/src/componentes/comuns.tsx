import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PLANOS, RECURSO_INFO, type Recurso, type StatusItem as StatusDoc } from '@trames/shared';
import { Icone, type NomeIcone } from './Icone';

export function Logo({ altura = 32, para }: { altura?: number; para?: string }) {
  const conteudo = (
    <>
      <svg viewBox="0 0 40 32" aria-hidden="true">
        <path d="M4.5 29.5V18a15.5 15.5 0 0 1 31 0v11.5" />
        <path d="M13.5 29.5V20.5a6.5 6.5 0 0 1 13 0v9" />
      </svg>
      <span>trames</span>
    </>
  );
  const estilo = { '--logo-h': `${altura}px` } as React.CSSProperties;
  return para ? (
    <Link to={para} className="tr-logo" style={estilo} aria-label="trames">
      {conteudo}
    </Link>
  ) : (
    <span className="tr-logo" style={estilo} role="img" aria-label="trames">
      {conteudo}
    </span>
  );
}

const STATUS: Record<StatusDoc, { texto: string; classe: string; icone: NomeIcone }> = {
  aprovado: { texto: 'Aprovado', classe: 'tr-status--aprovado', icone: 'check' },
  analise: { texto: 'Em análise', classe: 'tr-status--analise', icone: 'lupa' },
  pendente: { texto: 'Pendente', classe: 'tr-status--pendente', icone: 'relogio' },
  recusado: { texto: 'Recusado', classe: 'tr-status--recusado', icone: 'xis' },
};

export function Status({ status, texto }: { status: StatusDoc; texto?: string }) {
  const s = STATUS[status];
  return (
    <span className={`tr-status ${s.classe}`}>
      <Icone nome={s.icone} />
      {texto ?? s.texto}
    </span>
  );
}

export function Progresso({ feitos, total, rotulo, direita }: { feitos: number; total: number; rotulo?: ReactNode; direita?: ReactNode }) {
  const p = total ? Math.round((feitos / total) * 100) : 0;
  return (
    <div className="tr-progresso">
      <div className="tr-progresso__topo">
        <span>{rotulo ?? <><strong>{feitos} de {total}</strong> documentos aprovados</>}</span>
        <span>{direita ?? `${p}%`}</span>
      </div>
      <div className="tr-progresso__trilho">
        <div className="tr-progresso__barra" style={{ '--p': `${p}%` } as React.CSSProperties} />
      </div>
    </div>
  );
}

/** Sigla colorida do escritório (sua marca no balcão). */
export function SeloConta({ conta, tamanho = 32 }: { conta: { sigla: string; cor: string }; tamanho?: number }) {
  return (
    <span className="selo" style={{ background: conta.cor, width: tamanho, height: tamanho, fontSize: tamanho * 0.36, borderRadius: tamanho / 4 }}>
      {conta.sigla}
    </span>
  );
}

/** Aviso mostrado no lugar de um recurso que o plano atual não libera. */
export function Bloqueio({ recurso, compacto = false }: { recurso: Recurso; compacto?: boolean }) {
  const info = RECURSO_INFO[recurso];
  const plano = PLANOS[info.plano];
  if (compacto) {
    return (
      <div className="aviso aviso--plano">
        <Icone nome="cadeado" />
        <span>
          {info.texto} <Link to="/planos">Ver planos</Link>
        </span>
      </div>
    );
  }
  return (
    <div className="bloqueio">
      <span className="bloqueio__icone">
        <Icone nome="cadeado" />
      </span>
      <h2 className="titulo-2">{info.titulo}</h2>
      <p className="texto-suave" style={{ maxWidth: 520 }}>
        {info.texto}
      </p>
      <Link to="/planos" className="tr-btn tr-btn--primario">
        Conhecer o {plano.nome}
      </Link>
    </div>
  );
}

/** Mensagem curta que some sozinha. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  const toast = msg ? (
    <div className="toast" role="status">
      <Icone nome="check" />
      {msg}
    </div>
  ) : null;
  return [toast, setMsg] as const;
}

export function Carregando({ erro }: { erro?: string }) {
  return (
    <div style={{ minHeight: '40vh', display: 'grid', placeItems: 'center', padding: 24 }} role="status">
      <span className="texto-suave">{erro ?? 'Carregando…'}</span>
    </div>
  );
}

export function AvisoErro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  return (
    <div className="aviso aviso--erro" role="alert">
      <Icone nome="info" />
      <span>{erro instanceof Error ? erro.message : 'Algo deu errado.'}</span>
    </div>
  );
}
