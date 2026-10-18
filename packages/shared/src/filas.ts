/*
 * Filas do worker (pg-boss). Os payloads não levam dado pessoal em claro:
 * o que é sensível (código, link, texto da mensagem) vai selado com o KMS.
 */
export const FILAS = ['verificar-documento', 'enviar-mensagem', 'apagar-arquivos', 'lembretes', 'expirar', 'retencao'] as const;
export type Fila = (typeof FILAS)[number];

export type TipoMensagem = 'codigo' | 'link' | 'lembrete' | 'convite' | 'login';

export interface PayloadFila {
  'verificar-documento': { organizacaoId: string; documentoId: string };
  'enviar-mensagem': {
    organizacaoId: string;
    tipo: TipoMensagem;
    canal: 'whatsapp' | 'email';
    /** Para mensagens ao cliente. */
    balcaoId?: string;
    /** Para convites e para o código de login. */
    usuarioId?: string;
    /** JSON selado (base64) com { codigo?, url?, texto? }. */
    selado: string;
  };
  'apagar-arquivos': { organizacaoId: string; chaves: string[] };
  lembretes: Record<string, never>;
  expirar: Record<string, never>;
  retencao: Record<string, never>;
}

export interface ConteudoSelado {
  codigo?: string;
  url?: string;
  texto?: string;
}
