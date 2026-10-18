/** Regras de upload, iguais no front (para avisar cedo) e no back (para valer). */
export const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024;

/** Tipos aceitos. O worker confere o tipo real pelos bytes; a extensão e o Content-Type não bastam. */
export const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export type TipoPermitido = (typeof TIPOS_PERMITIDOS)[number];

export const ehTipoPermitido = (t: string): t is TipoPermitido => (TIPOS_PERMITIDOS as readonly string[]).includes(t);

/** Validade das URLs assinadas, em segundos. */
export const VALIDADE_URL_UPLOAD = 5 * 60;
export const VALIDADE_URL_DOWNLOAD = 60;

/** Código de 6 dígitos do cliente. */
export const VALIDADE_CODIGO_MINUTOS = 10;
export const TENTATIVAS_CODIGO = 5;
