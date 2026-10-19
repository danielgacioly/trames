/*
 * Filas do worker (pg-boss). Os payloads não levam dado pessoal em claro:
 * o que é sensível (código, link, texto da mensagem) vai selado com o KMS.
 */
export const FILAS = ['verificar-documento', 'enviar-mensagem', 'apagar-arquivos', 'exportar', 'avisar-mudanca', 'lembretes', 'expirar', 'retencao'] as const;
export type Fila = (typeof FILAS)[number];

/**
 * codigo, link, lembrete e mudanca vão ao cliente; convite e login, a uma pessoa da equipe;
 * admin vai a quem administra a conta (avisos de uso, cota e retenção).
 */
export type TipoMensagem = 'codigo' | 'link' | 'lembrete' | 'mudanca' | 'convite' | 'login' | 'redefinir_senha' | 'senha_trocada' | 'admin';

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
    /** JSON selado (base64) com o ConteudoSelado. */
    selado: string;
  };
  'apagar-arquivos': { organizacaoId: string; chaves: string[] };
  exportar: { organizacaoId: string; exportacaoId: string };
  /** Aviso ao cliente de que a lista mudou. Agrupa as mudanças de 10 minutos (singletonKey por balcão). */
  'avisar-mudanca': { organizacaoId: string; balcaoId: string };
  lembretes: Record<string, never>;
  expirar: Record<string, never>;
  retencao: Record<string, never>;
}

export interface ConteudoSelado {
  codigo?: string;
  url?: string;
  texto?: string;
  /** Mensagens ao admin. */
  assunto?: string;
  /** Lembrete: qual etapa da cadência ("antes", "dia", "depois" ou "manual"). */
  etapa?: string;
  /** Aviso de mudança: os nomes dos itens novos ou pedidos de novo. */
  itens?: string[];
}
