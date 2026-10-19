import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../dados/api';
import { chaves, useAcao, useClientes, useSessao } from '../../dados/consultas';
import { AvisoErro, Carregando, useToast } from '../../ui/comuns';
import { plural } from '../../util/formatos';

export function Clientes() {
  const s = useSessao();
  const consulta = useClientes();
  const [busca, setBusca] = useState('');
  const [toast, avisar] = useToast();
  const excluir = useAcao((id: string) => api('DELETE', `/clientes/${id}`), [chaves.clientes, chaves.balcoes, chaves.cobranca]);
  const admin = s.usuario.permissao === 'admin';

  async function exportar(id: string, nome: string) {
    const r = await fetch(`/api/clientes/${id}/exportar`, { credentials: 'same-origin' });
    if (!r.ok) return avisar('Não deu para exportar.');
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `dados-${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (consulta.isPending) return <Carregando />;
  const termo = busca.trim().toLowerCase();
  const linhas = (consulta.data ?? []).filter((c) => c.nome.toLowerCase().includes(termo));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-1">Clientes</h1>
          <p className="subtitulo">Todo mundo para quem você já abriu um balcão. A pedido do cliente, dá para exportar ou apagar os dados dele (LGPD).</p>
        </div>
        <label className="tr-campo" style={{ width: 320 }}>
          <span className="sr-only">Buscar cliente</span>
          <input className="tr-campo__entrada" placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>
      <AvisoErro erro={excluir.error} />
      <div className="tabela-caixa">
        <table className="tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>WhatsApp</th>
              <th>E-mail</th>
              <th>Balcões</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.nome}</td>
                <td className="tr-protocolo">final {c.whatsappFinal}</td>
                <td className="texto-suave">{c.email || '—'}</td>
                <td>
                  {plural(c.balcoesAbertos, 'aberto', 'abertos')}
                  {c.balcoesTotal > c.balcoesAbertos && <span className="texto-suave"> · {c.balcoesTotal - c.balcoesAbertos} concluído</span>}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.ultimoBalcaoId && (
                    <Link to={`/app/balcao/${c.ultimoBalcaoId}`} className="tr-btn tr-btn--secundario tr-btn--sm">
                      Abrir
                    </Link>
                  )}
                  {admin && (
                    <>
                      <button type="button" className="tr-btn tr-btn--discreto tr-btn--sm" onClick={() => exportar(c.id, c.nome)}>
                        Exportar dados
                      </button>
                      <button
                        type="button"
                        className="tr-btn tr-btn--discreto tr-btn--sm"
                        style={{ color: 'var(--recusado)' }}
                        onClick={async () => {
                          if (!window.confirm(`Apagar ${c.nome}, todos os balcões e todos os arquivos? Não dá para desfazer.`)) return;
                          await excluir.mutateAsync(c.id);
                          avisar('Dados do cliente apagados. Os arquivos saem do storage em instantes.');
                        }}
                      >
                        Apagar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast}
    </>
  );
}
