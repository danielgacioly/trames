import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { naOrganizacao } from '@trames/db';
import { apagar, baixar, BUCKET_DOCUMENTOS, BUCKET_QUARENTENA, chaveMiniatura, enviar, moverParaDocumentos } from '@trames/db/armazenamento';
import { ehTipoPermitido, TAMANHO_MAXIMO_ARQUIVO, type PayloadFila } from '@trames/shared';
import { escanear } from '../antivirus';
import { log } from '../log';

const MOTIVO_CLIENTE = 'Não conseguimos aceitar este arquivo. Envie uma foto nítida ou um PDF.';

/**
 * Sai da quarentena só o que passa nas três checagens: tamanho, tipo real pelos
 * bytes (não vale a extensão nem o Content-Type) e antivírus.
 */
export async function verificarDocumento({ organizacaoId, documentoId }: PayloadFila['verificar-documento']) {
  const doc = await naOrganizacao(organizacaoId, (tx) => tx.documento.findUnique({ where: { id: documentoId } }));
  if (!doc || doc.status !== 'quarentena') return;

  const arquivo = await baixar(BUCKET_QUARENTENA, doc.chave);
  const tipo = await fileTypeFromBuffer(arquivo);
  let problema: string | null = null;
  if (arquivo.length > TAMANHO_MAXIMO_ARQUIVO) problema = 'tamanho';
  else if (!tipo || !ehTipoPermitido(tipo.mime)) problema = 'tipo';
  else {
    const r = await escanear(arquivo);
    if (!r.limpo) problema = 'virus';
  }

  if (problema) {
    await apagar(BUCKET_QUARENTENA, doc.chave);
    await naOrganizacao(organizacaoId, async (tx) => {
      await tx.documento.update({ where: { id: doc.id }, data: { status: 'rejeitado', motivo: problema, tipoReal: tipo?.mime ?? null, verificadoEm: new Date() } });
      await tx.itemBalcao.update({ where: { id: doc.itemId }, data: { status: 'pendente', motivoRecusa: MOTIVO_CLIENTE } });
      await tx.eventoAuditoria.create({ data: { organizacaoId, atorTipo: 'sistema', acao: 'documento.rejeitado', alvoTipo: 'documento', alvoId: doc.id, detalhes: { balcaoId: doc.balcaoId, motivo: problema } } });
    });
    log.warn({ documentoId, problema }, 'arquivo rejeitado');
    return;
  }

  await moverParaDocumentos(doc.chave, tipo!.mime);
  let miniatura: string | null = null;
  if (tipo!.mime.startsWith('image/') && tipo!.mime !== 'image/heic') {
    try {
      const corpo = await sharp(arquivo).rotate().resize(480, 480, { fit: 'inside' }).webp({ quality: 70 }).toBuffer();
      miniatura = chaveMiniatura(organizacaoId, doc.id);
      await enviar(BUCKET_DOCUMENTOS, miniatura, corpo, 'image/webp');
    } catch {
      miniatura = null; // imagem que o sharp não abre: segue sem miniatura
    }
  }
  await naOrganizacao(organizacaoId, async (tx) => {
    await tx.documento.update({ where: { id: doc.id }, data: { status: 'disponivel', tipoReal: tipo!.mime, chaveMiniatura: miniatura, verificadoEm: new Date() } });
    await tx.itemBalcao.update({ where: { id: doc.itemId }, data: { status: 'analise', motivoRecusa: null } });
    await tx.eventoAuditoria.create({ data: { organizacaoId, atorTipo: 'sistema', acao: 'documento.verificado', alvoTipo: 'documento', alvoId: doc.id, detalhes: { balcaoId: doc.balcaoId } } });
  });
  log.info({ documentoId }, 'arquivo liberado');
}

export async function apagarArquivos({ chaves }: PayloadFila['apagar-arquivos']) {
  for (const chave of chaves) {
    await apagar(BUCKET_DOCUMENTOS, chave);
    await apagar(BUCKET_QUARENTENA, chave);
  }
}
