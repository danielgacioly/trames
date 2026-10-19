import { createRequire } from 'node:module';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';

/*
 * Miniatura para conferir sem baixar o original: WebP leve, com cerca de 1200 px
 * no lado maior. Imagem: redimensionada pelo sharp. PDF: a primeira página
 * desenhada pelo pdf.js (sem executar scripts do arquivo) e convertida para WebP.
 */

const LADO = 1200;
/** Um PDF pesado ou malicioso não segura o worker: passou disso, segue sem miniatura. */
const LIMITE_MS = 20_000;
const QUALIDADE = 72;
const require = createRequire(import.meta.url);
const fontesPdf = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep;

async function primeiraPaginaPdf(arquivo: Buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(arquivo), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: fontesPdf, verbosity: 0 }).promise;
  try {
    const pagina = await doc.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const v = pagina.getViewport({ scale: LADO / Math.max(base.width, base.height) });
    const canvas = createCanvas(Math.ceil(v.width), Math.ceil(v.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: v }).promise;
    return canvas.encode('png');
  } finally {
    await doc.destroy();
  }
}

/** Devolve o WebP, ou null quando não dá para gerar (HEIC, PDF protegido ou corrompido). */
export async function gerarMiniatura(arquivo: Buffer, tipo: string): Promise<Buffer | null> {
  try {
    const origem =
      tipo === 'application/pdf'
        ? await Promise.race([primeiraPaginaPdf(arquivo), new Promise<never>((_, falhar) => setTimeout(() => falhar(new Error('tempo')), LIMITE_MS).unref())])
        : tipo.startsWith('image/') && tipo !== 'image/heic'
          ? arquivo
          : null;
    if (!origem) return null;
    return await sharp(origem).rotate().resize(LADO, LADO, { fit: 'inside', withoutEnlargement: true }).webp({ quality: QUALIDADE }).toBuffer();
  } catch {
    return null;
  }
}
