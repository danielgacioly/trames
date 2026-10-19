import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { PastaDto } from '@trames/shared';
import { api, mensagemDe } from '../../dados/api';
import { chaves, useAcao } from '../../dados/consultas';
import { Icone } from '../../ui/Icone';
import { iniciais, plural } from '../../util/formatos';
import { CORES_PASTA, enderecoDa, type Pasta } from './pastas';

/** Cartão de uma pasta: nome, quantos balcões abertos e, se houver, quantos esperam conferência. */
export function CartaoPasta({ p, abertos, paraConferir }: { p: Pasta; abertos: number; paraConferir: number }) {
  return (
    <Link to={enderecoDa(p)} className={`pasta${abertos === 0 && p.valor !== 'encerrados' ? ' pasta--vazia' : ''}`}>
      {p.grupo === 'pessoa' ? (
        <span className="pasta__avatar">{iniciais(p.nome)}</span>
      ) : (
        <span className="pasta__icone" style={{ color: p.cor }}>
          <Icone nome="pasta" tamanho={22} />
        </span>
      )}
      <span className="pasta__corpo">
        <span className="pasta__nome">{p.nome}</span>
        <span className="miudo texto-suave">{p.valor === 'encerrados' ? plural(abertos, 'balcão', 'balcões') : plural(abertos, 'aberto', 'abertos')}</span>
      </span>
      {paraConferir > 0 && p.valor !== 'conferir' && (
        <span className="pasta__conferir" title={`${paraConferir} para conferir`} aria-label={`${paraConferir} para conferir`}>
          {paraConferir}
        </span>
      )}
    </Link>
  );
}

/** Criar ou renomear uma pasta (nome e cor). */
export function FormularioPasta({ pasta, fechar }: { pasta?: PastaDto; fechar: (criada?: PastaDto) => void }) {
  const [nome, setNome] = useState(pasta?.nome ?? '');
  const [cor, setCor] = useState(pasta?.cor ?? CORES_PASTA[0]);
  const [erro, setErro] = useState('');
  const salvar = useAcao((corpo: { nome: string; cor: string }) => (pasta ? api<PastaDto>('PATCH', `/pastas/${pasta.id}`, corpo) : api<PastaDto>('POST', '/pastas', corpo)), [chaves.pastas]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      fechar(await salvar.mutateAsync({ nome: nome.trim(), cor }));
    } catch (x) {
      setErro(mensagemDe(x));
    }
  }

  return (
    <form className="pasta pasta--formulario" onSubmit={enviar}>
      <span className="pasta__icone" style={{ color: cor }}>
        <Icone nome="pasta" tamanho={22} />
      </span>
      <div className="pasta__corpo" style={{ gap: 8 }}>
        <input className="tr-campo__entrada" style={{ height: 36, fontSize: 15 }} autoFocus required maxLength={60} placeholder="Nome da pasta" aria-label="Nome da pasta" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="linha" style={{ gap: 6 }} role="radiogroup" aria-label="Cor da pasta">
          {CORES_PASTA.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={`Cor ${c}`} className="amostra" style={{ background: c }} onClick={() => setCor(c)} />
          ))}
        </div>
        {erro && <span className="miudo" style={{ color: 'var(--recusado)' }}>{erro}</span>}
        <div className="linha" style={{ gap: 6 }}>
          <button type="submit" className="tr-btn tr-btn--primario tr-btn--sm" disabled={salvar.isPending || !nome.trim()}>
            {pasta ? 'Salvar' : 'Criar pasta'}
          </button>
          <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => fechar()}>
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}
