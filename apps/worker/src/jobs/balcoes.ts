import { Upload } from '@aws-sdk/lib-storage';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { criarKms, naOrganizacao, selar } from '@trames/db';
import { abrirFluxo, BUCKET_DOCUMENTOS, s3 } from '@trames/db/armazenamento';
import type { PayloadFila } from '@trames/shared';
import { log } from '../log';
import type { Enfileirar } from '../fila';
import { emitirLink } from '../links';

const kms = criarKms();
const VALIDADE_ZIP_MS = 24 * 60 * 60 * 1000;

/**
 * Aviso ao cliente de que a lista mudou (item novo ou pedido de novo). A fila é
 * stately com singletonKey por balcão: o job roda 10 minutos depois da primeira
 * mudança e junta tudo o que mudou desde o último aviso num e-mail só.
 */
export async function avisarMudanca({ organizacaoId, balcaoId }: PayloadFila['avisar-mudanca'], enfileirar: Enfileirar) {
  const r = await naOrganizacao(organizacaoId, async (tx) => {
    const b = await tx.balcao.findUnique({ where: { id: balcaoId } });
    if (!b || b.concluidoEm) return null;
    const desde = b.ultimoAvisoMudancaEm ?? b.criadoEm;
    const eventos = await tx.eventoAuditoria.findMany({
      where: { acao: { in: ['item.adicionado', 'item.pedido_de_novo'] }, criadoEm: { gt: desde }, detalhes: { path: ['balcaoId'], equals: balcaoId } },
      orderBy: { criadoEm: 'asc' },
    });
    // Só o que ainda está na lista e ainda falta.
    const ids = [...new Set(eventos.map((e) => e.alvoId).filter((x): x is string => !!x))];
    const itens = await tx.itemBalcao.findMany({ where: { id: { in: ids }, removidoEm: null, status: { in: ['pendente', 'recusado'] } }, orderBy: { ordem: 'asc' } });
    await tx.balcao.update({ where: { id: b.id }, data: { ultimoAvisoMudancaEm: new Date() } });
    if (!itens.length) return null;
    // Link novo para o aviso; os anteriores continuam valendo. O aviso vai por e-mail (sem custo de WhatsApp).
    return { url: await emitirLink(tx, organizacaoId, b.id, b.prazo), nomes: itens.map((i) => i.nome) };
  });
  if (!r) return;
  const selado = (await selar(kms, JSON.stringify({ url: r.url, itens: r.nomes }), `fila:${organizacaoId}`)).toString('base64');
  await enfileirar('enviar-mensagem', { organizacaoId, balcaoId, tipo: 'mudanca', canal: 'email', selado });
}

const pasta = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .slice(0, 60) || 'documento';

/**
 * ZIP com os originais de um balcão, montado em fluxo: os arquivos vêm do S3 um
 * por vez e o ZIP sobe em partes, sem guardar nada em disco nem tudo na memória.
 * Fica no bucket de documentos (prefixo exportacoes/, que o ciclo de vida limpa em 2 dias) e vale 24 horas.
 */
export async function exportar({ organizacaoId, exportacaoId }: PayloadFila['exportar']) {
  const dados = await naOrganizacao(organizacaoId, async (tx) => {
    const e = await tx.exportacao.findUnique({ where: { id: exportacaoId }, include: { balcao: { select: { protocolo: true } } } });
    if (!e || e.status !== 'pendente') return null;
    const docs = await tx.documento.findMany({ where: { balcaoId: e.balcaoId, status: 'disponivel' }, include: { item: { select: { nome: true, ordem: true, removidoEm: true } } }, orderBy: { enviadoEm: 'asc' } });
    return { e, docs };
  });
  if (!dados) return;
  const chave = `exportacoes/${organizacaoId}/${exportacaoId}.zip`;
  try {
    const zip = archiver('zip', { zlib: { level: 1 } }); // fotos e PDFs já vêm comprimidos
    const saida = new PassThrough();
    zip.pipe(saida);
    const envio = new Upload({
      client: s3,
      params: { Bucket: BUCKET_DOCUMENTOS, Key: chave, Body: saida, ContentType: 'application/zip', ServerSideEncryption: process.env.S3_ENDPOINT ? undefined : 'aws:kms' },
    });
    const nomes = new Set<string>();
    for (const d of dados.docs) {
      const fluxo = await abrirFluxo(BUCKET_DOCUMENTOS, d.chave);
      let nome = `${String(d.item.ordem + 1).padStart(2, '0')} ${pasta(d.item.nome)}${d.item.removidoEm ? ' (removido da lista)' : ''}/${pasta(d.nomeArquivo)}`;
      for (let k = 2; nomes.has(nome); k++) nome = nome.replace(/(\.[^./]+)?$/, ` (${k})$1`);
      nomes.add(nome);
      // Um arquivo por vez: espera este entrar no ZIP antes de abrir o próximo no S3.
      const entrou = new Promise((ok) => zip.once('entry', ok));
      zip.append(fluxo, { name: nome, date: d.enviadoEm });
      await entrou;
    }
    await Promise.all([zip.finalize(), envio.done()]);
    const tamanho = zip.pointer();
    await naOrganizacao(organizacaoId, (tx) =>
      tx.exportacao.update({ where: { id: exportacaoId }, data: { status: 'pronta', chave, tamanho: BigInt(tamanho), prontaEm: new Date(), expiraEm: new Date(Date.now() + VALIDADE_ZIP_MS) } }),
    );
    log.info({ exportacaoId, arquivos: dados.docs.length }, 'exportação pronta');
  } catch (e) {
    await naOrganizacao(organizacaoId, (tx) => tx.exportacao.update({ where: { id: exportacaoId }, data: { status: 'falhou' } }));
    throw e;
  }
}
