import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClienteDto } from '@trames/shared';
import { api, mensagemDe } from '../../dados/api';
import { chaves, useAcao, useClientes, useSessao } from '../../dados/consultas';
import { AvisoErro, Avatar, Busca, Carregando, Menu, Pagina, useDialogos, useNotificar } from '../../ui';
import { plural } from '../../util/formatos';

/** Baixa o JSON com tudo o que a conta guarda sobre o cliente (pedido de acesso da LGPD). */
async function exportar(c: ClienteDto) {
  const r = await fetch(`/api/clientes/${c.id}/exportar`, { credentials: 'same-origin' });
  if (!r.ok) throw new Error('Não deu para exportar os dados.');
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `dados-${c.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Clientes() {
  const s = useSessao();
  const consulta = useClientes();
  const navegar = useNavigate();
  const { confirmar } = useDialogos();
  const notificar = useNotificar();
  const [busca, setBusca] = useState('');
  const apagar = useAcao((id: string) => api('DELETE', `/clientes/${id}`), [chaves.clientes, chaves.balcoes, chaves.cobranca]);
  const admin = s.usuario.permissao === 'admin';

  async function excluir(c: ClienteDto) {
    const ok = await confirmar({
      titulo: `Apagar ${c.nome}?`,
      texto: `Apaga o cadastro, ${c.balcoesTotal === 1 ? 'o balcão' : `os ${c.balcoesTotal} balcões`} e todos os arquivos. Use quando o próprio cliente pedir (LGPD). Não dá para desfazer.`,
      confirmar: 'Apagar tudo',
      perigo: true,
    });
    if (!ok) return;
    try {
      await apagar.mutateAsync(c.id);
      notificar({ titulo: 'Dados do cliente apagados', texto: 'Os arquivos saem do storage em instantes.' });
    } catch (e) {
      notificar({ tom: 'erro', titulo: 'Não deu para apagar', texto: mensagemDe(e) });
    }
  }

  if (consulta.isPending) return <Carregando />;
  const termo = busca.trim().toLowerCase();
  const linhas = (consulta.data ?? []).filter((c) => !termo || c.nome.toLowerCase().includes(termo) || c.email.toLowerCase().includes(termo));

  return (
    <Pagina titulo="Clientes" subtitulo="Todo mundo para quem a conta já abriu um balcão." ferramentas={<Busca valor={busca} mudar={setBusca} rotulo="Buscar nome ou e-mail" />}>
      <AvisoErro erro={consulta.error} />
      {linhas.length ? (
        <div className="grupo">
          {linhas.map((c) => (
            <div key={c.id} className="linha">
              <Avatar nome={c.nome} />
              <span className="linha__corpo">
                <span className="linha__titulo corta">{c.nome}</span>
                <span className="linha__sub corta">
                  {c.email} · WhatsApp final {c.whatsappFinal}
                </span>
              </span>
              <span className="pequeno secundario numero" style={{ whiteSpace: 'nowrap' }}>
                {c.balcoesAbertos ? plural(c.balcoesAbertos, 'aberto', 'abertos') : 'Nenhum aberto'}
                {c.balcoesTotal > c.balcoesAbertos && <span className="terciario"> · {c.balcoesTotal - c.balcoesAbertos} encerrado</span>}
              </span>
              <Menu
                rotulo={`Ações de ${c.nome}`}
                itens={[
                  !!c.ultimoBalcaoId && { rotulo: 'Abrir último balcão', icone: 'balcoes', acao: () => navegar(`/app/balcao/${c.ultimoBalcaoId}`) },
                  admin && { rotulo: 'Exportar dados (LGPD)', icone: 'baixar', acao: () => exportar(c).catch((e) => notificar({ tom: 'erro', titulo: mensagemDe(e) })) },
                  admin && 'separador',
                  admin && { rotulo: 'Apagar cliente e arquivos…', icone: 'lixo', perigo: true, acao: () => excluir(c) },
                ]}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grupo grupo--vazio">{termo ? 'Nenhum cliente encontrado.' : 'Os clientes aparecem aqui quando você abre o primeiro balcão.'}</div>
      )}
      {admin && <p className="secao__nota">A pedido do cliente, você pode exportar ou apagar os dados dele pelo menu “…”.</p>}
    </Pagina>
  );
}
