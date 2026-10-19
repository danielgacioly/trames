import { useCallback } from 'react';
import type { CanalCodigo, LinkGerado } from '@trames/shared';
import { api, mensagemDe } from '../../../dados/api';
import { chaves, useAcao } from '../../../dados/consultas';
import { useNotificar } from '../../../ui';

/** Abre uma URL assinada (~60 segundos). A janela abre antes da resposta para o navegador não bloquear. */
export async function abrirUrl(buscar: () => Promise<{ url: string }>) {
  const janela = window.open('', '_blank');
  try {
    const { url } = await buscar();
    if (janela) janela.location.href = url;
    else window.location.href = url;
  } catch (e) {
    janela?.close();
    throw e;
  }
}

/** "Baixar original": o único caminho para o arquivo original. Cada download fica na auditoria. */
export const baixarOriginal = (documentoId: string) => abrirUrl(() => api<{ url: string }>('GET', `/documentos/${documentoId}/url`));
export const baixarZip = (balcaoId: string) => abrirUrl(() => api<{ url: string }>('GET', `/balcoes/${balcaoId}/exportacao/url`));

/** Todas as ações do balcão, com o mesmo recarregamento e o erro mostrado como notificação. */
export function useAcoesBalcao(id: string) {
  const notificar = useNotificar();
  const recarregar = [chaves.balcao(id), chaves.balcoes, chaves.cobranca, chaves.historico(id)];
  const acoes = {
    aprovar: useAcao((itemId: string) => api('POST', `/itens/${itemId}/aprovar`), recarregar),
    recusar: useAcao((x: { itemId: string; motivo: string }) => api('POST', `/itens/${x.itemId}/recusar`, { motivo: x.motivo }), recarregar),
    concluir: useAcao(() => api('POST', `/balcoes/${id}/concluir`), recarregar),
    reabrir: useAcao(() => api('POST', `/balcoes/${id}/reabrir`), recarregar),
    arquivar: useAcao(() => api('POST', `/balcoes/${id}/arquivar`), recarregar),
    lembrar: useAcao(() => api<{ canal: CanalCodigo }>('POST', `/balcoes/${id}/lembrar`), recarregar),
    trocarLinks: useAcao(() => api<LinkGerado>('POST', `/balcoes/${id}/link`), recarregar),
    encerrarAcesso: useAcao(() => api('DELETE', `/balcoes/${id}/sessoes`), recarregar),
    configurar: useAcao((corpo: Record<string, unknown>) => api('PATCH', `/balcoes/${id}`, corpo), recarregar),
    exportar: useAcao(() => api('POST', `/balcoes/${id}/exportar`), recarregar),
    apagarArquivo: useAcao((docId: string) => api('DELETE', `/documentos/${docId}`), recarregar),
  };

  /** Roda a ação; se der certo, mostra a confirmação; se falhar, mostra o erro. */
  const executar = useCallback(
    async <T,>(fazer: () => Promise<T>, sucesso?: string | ((r: T) => string)): Promise<{ ok: true; valor: T } | { ok: false }> => {
      try {
        const valor = await fazer();
        if (sucesso) notificar({ titulo: typeof sucesso === 'function' ? sucesso(valor) : sucesso });
        return { ok: true, valor };
      } catch (e) {
        notificar({ tom: 'erro', titulo: 'Não deu certo', texto: mensagemDe(e) });
        return { ok: false };
      }
    },
    [notificar],
  );

  return { ...acoes, executar };
}

export type AcoesBalcao = ReturnType<typeof useAcoesBalcao>;

export const ACOES: Record<string, string> = {
  'balcao.criado': 'criou o balcão',
  'balcao.concluido': 'concluiu o balcão',
  'balcao.reaberto': 'reabriu o balcão',
  'balcao.arquivado': 'arquivou o balcão',
  'balcao.alterado': 'mudou o prazo ou os lembretes',
  'link.criado': 'gerou um link',
  'link.revogado': 'cancelou os links',
  'link.enviado': 'enviou o link por e-mail',
  'link.copiado': 'copiou o link',
  'link.aberto_whatsapp': 'abriu o WhatsApp para mandar o link',
  'link.visto': 'viu o link de novo',
  'lembrete.enviado': 'mandou um lembrete',
  'cliente.entrou': 'entrou com o código',
  'cliente.codigo_errado': 'errou o código',
  'cliente.acesso_encerrado': 'encerrou o acesso do cliente',
  'item.adicionado': 'incluiu um documento na lista',
  'item.editado': 'editou um documento da lista',
  'item.pedido_de_novo': 'pediu um documento de novo',
  'item.removido': 'tirou um documento da lista',
  'itens.reordenados': 'mudou a ordem da lista',
  'documento.enviado': 'enviou um arquivo',
  'documento.verificado': 'liberou o arquivo (antivírus e tipo conferidos)',
  'documento.rejeitado': 'rejeitou o arquivo na verificação',
  'documento.viu': 'viu a miniatura de um arquivo',
  'documento.baixou': 'baixou um original',
  'documento.aprovou': 'aprovou um documento',
  'documento.recusou': 'recusou um documento',
  'documento.apagou': 'apagou um arquivo',
  'exportacao.pedida': 'pediu o ZIP com todos os arquivos',
  'exportacao.baixou': 'baixou o ZIP',
  'cobranca.excedente': 'gerou um balcão excedente',
  'retencao.apagou_documento': 'apagou um arquivo (retenção)',
  'retencao.apagou': 'apagou os arquivos (retenção)',
};
