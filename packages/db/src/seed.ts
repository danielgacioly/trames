/*
 * Cria os modelos padrão e as três contas de teste (Grátis, Pro, Ultra).
 * Roda com o papel dono do banco. Apaga e recria tudo: só para desenvolvimento.
 *
 *   pnpm db:seed
 */
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { BUCKET_DOCUMENTOS, chaveDocumento, enviar } from './armazenamento';
import { criarKms, novoToken } from './cripto';
import { cifrarDadosCliente } from './dados-cliente';
import { MODELOS_PADRAO } from './modelos-padrao';
import { CONTAS_TESTE, SENHA_TESTE } from './contas-teste';
import { PrismaClient, type StatusItem } from '@prisma/client';
import { mesDe } from '@trames/shared';

if (process.env.NODE_ENV === 'production') throw new Error('O seed apaga o banco. Não rode em produção.');

const db = new PrismaClient();
const kms = criarKms();
const CHAVE_HMAC = process.env.CHAVE_HMAC!;
if (!CHAVE_HMAC) throw new Error('Configure CHAVE_HMAC.');

const DIA = 86_400_000;
const hoje = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};
const dia = (n: number) => new Date(hoje() + n * DIA);
const momento = (n: number, hora = 10, minuto = 0) => new Date(hoje() + n * DIA + (hora * 60 + minuto) * 60_000 + 3 * 3_600_000);

/** Um PDF mínimo de verdade, para os documentos de exemplo abrirem no navegador. */
function pdfExemplo(titulo: string) {
  const texto = titulo.replace(/[()\\]/g, '');
  const conteudo = `BT /F1 18 Tf 72 720 Td (${texto}) Tj ET BT /F1 11 Tf 72 690 Td (Documento de exemplo do prototipo da Trames.) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, k) => {
    offsets.push(pdf.length);
    pdf += `${k + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const A: StatusItem = 'aprovado';
const E: StatusItem = 'analise';
const P: StatusItem = 'pendente';
const R: StatusItem = 'recusado';

interface Cli {
  nome: string;
  cpf: string;
  whatsapp: string;
  email: string;
}

function cliFalso(nome: string, n: number): Cli {
  const partes = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').split(' ').filter(Boolean);
  return {
    nome,
    cpf: `${100 + ((n * 37) % 900)}${100 + ((n * 53) % 900)}${100 + ((n * 71) % 900)}${10 + (n % 89)}`,
    whatsapp: `819${8000 + ((n * 13) % 2000)}${1000 + ((n * 97) % 9000)}`,
    email: `${partes[0]}.${partes[partes.length - 1]}@email.com`,
  };
}

async function criarCliente(organizacaoId: string, c: Cli) {
  const cifrado = await cifrarDadosCliente(kms, CHAVE_HMAC, organizacaoId, c.cpf, c.whatsapp);
  return db.cliente.create({ data: { organizacaoId, nome: c.nome, email: c.email, ...cifrado } });
}

interface NovoBalcao {
  organizacaoId: string;
  n: number;
  tipo: string;
  cliente: Cli;
  prazo: number;
  itens: { nome: string; detalhe: string; obrigatorio: boolean; status: StatusItem; arquivo?: string; enviado?: Date }[];
  lembrete?: boolean;
  canal?: 'email' | 'whatsapp';
  concluido?: boolean;
  /** Dias atrás em que foi concluído (padrão: 2). */
  concluidoHa?: number;
  arquivado?: boolean;
  diasRetencao?: number;
  criadoPorId?: string;
  pastaId?: string;
}

let docs = 0;
async function criarBalcao(b: NovoBalcao) {
  const cliente = await criarCliente(b.organizacaoId, b.cliente);
  const balcao = await db.balcao.create({
    data: {
      organizacaoId: b.organizacaoId,
      clienteId: cliente.id,
      protocolo: `TRM-2026-${String(b.n).padStart(5, '0')}`,
      tipo: b.tipo,
      prazo: dia(b.prazo),
      lembrete: b.lembrete ?? true,
      canalCodigo: b.canal ?? 'email',
      canalLembrete: b.canal ?? 'email',
      criadoPorId: b.criadoPorId ?? null,
      pastaId: b.pastaId ?? null,
      criadoEm: momento(-14 - (b.n % 10)),
      concluidoEm: b.concluido ? momento(-(b.concluidoHa ?? 2), 16) : null,
      arquivadoEm: b.concluido && b.arquivado ? momento(-(b.concluidoHa ?? 2), 16) : null,
      apagarArquivosEm: b.concluido ? momento(-(b.concluidoHa ?? 2) + (b.diasRetencao ?? 90), 16) : null,
    },
  });
  if (!b.concluido) {
    // Um link ativo (só o hash). Para mandar ao cliente, o escritório gera um em "Link do cliente".
    const { hash } = novoToken();
    await db.linkAcesso.create({ data: { organizacaoId: b.organizacaoId, balcaoId: balcao.id, tokenHash: hash, expiraEm: new Date(Math.max(dia(b.prazo).getTime(), hoje()) + 30 * DIA) } });
  }
  for (const [k, it] of b.itens.entries()) {
    const item = await db.itemBalcao.create({
      data: {
        organizacaoId: b.organizacaoId,
        balcaoId: balcao.id,
        ordem: k,
        nome: it.nome,
        detalhe: it.detalhe,
        obrigatorio: it.obrigatorio,
        status: it.status,
        motivoRecusa: it.status === 'recusado' ? 'O arquivo está cortado na parte de baixo. Pode enviar de novo com a folha inteira?' : null,
      },
    });
    if (it.status === 'pendente') continue;
    const id = randomUUID();
    const chave = chaveDocumento(b.organizacaoId, id);
    const corpo = pdfExemplo(`${it.nome} - ${b.cliente.nome}`);
    await enviar(BUCKET_DOCUMENTOS, chave, corpo, 'application/pdf');
    docs++;
    await db.documento.create({
      data: {
        id,
        organizacaoId: b.organizacaoId,
        balcaoId: balcao.id,
        itemId: item.id,
        chave,
        nomeArquivo: it.arquivo ?? `${it.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
        tipoDeclarado: 'application/pdf',
        tipoReal: 'application/pdf',
        tamanho: corpo.length,
        status: 'disponivel',
        enviadoEm: it.enviado ?? momento(-((k % 5) + 1), 9 + (k % 9), 12),
        verificadoEm: momento(-((k % 5) + 1), 9 + (k % 9), 13),
      },
    });
  }
  return balcao;
}

function itensDoModelo(id: string, status: StatusItem[]) {
  const m = MODELOS_PADRAO.find((x) => x.id === id)!;
  return m.itens.map((it, k) => ({ ...it, status: status[k] ?? P }));
}

async function criarOrganizacao(o: { nome: string; sigla: string; cor: string; area: 'saude' | 'advocacia' | 'contabilidade'; plano: 'gratis' | 'pro' | 'ultra' }) {
  return db.organizacao.create({
    data: { id: randomUUID(), nome: o.nome, sigla: o.sigla, cor: o.cor, area: o.area, assinaturas: { create: { plano: o.plano } } },
  });
}

async function criarUsuario(organizacaoId: string, nome: string, email: string, permissao: 'admin' | 'monta' | 'confere') {
  const senhaHash = await argon2.hash(SENHA_TESTE, { type: argon2.argon2id });
  return db.usuario.create({ data: { organizacaoId, nome, email, senhaHash, permissao } });
}

async function criarPasta(organizacaoId: string, nome: string, cor: string) {
  return db.pasta.create({ data: { organizacaoId, nome, cor } });
}

async function main() {
  // Limpa (como dono, sem RLS). eventos_auditoria é append-only: o trigger deixa o dono truncar.
  await db.$executeRawUnsafe(
    'TRUNCATE organizacoes, assinaturas, usuarios, sessoes, clientes, balcoes, itens_balcao, documentos, modelos, itens_modelo, links_acesso, codigos_acesso, sessoes_cliente, eventos_auditoria, caixa_saida_dev, uso_mensal, itens_cobranca, exportacoes, pastas CASCADE',
  );

  for (const m of MODELOS_PADRAO) {
    await db.modelo.create({
      data: { area: m.area, nome: m.nome, quando: m.quando, itens: { create: m.itens.map((it, k) => ({ ...it, ordem: k })) } },
    });
  }

  // Grátis
  const g = await criarOrganizacao({ nome: 'Clínica Boa Vista', sigla: 'BV', cor: '#1c5d84', area: 'saude', plano: 'gratis' });
  const carla = await criarUsuario(g.id, 'Carla Menezes', CONTAS_TESTE[0].email, 'admin');
  await criarBalcao({ organizacaoId: g.id, criadoPorId: carla.id, n: 3101, tipo: 'Pré-operatório', cliente: cliFalso('Roberta Lins', 3101), prazo: 6, itens: itensDoModelo('sau-preop', [A, A, E]) });
  await criarBalcao({ organizacaoId: g.id, criadoPorId: carla.id, n: 3107, tipo: 'Reembolso do plano', cliente: cliFalso('Marcos Teixeira', 3107), prazo: 9, itens: itensDoModelo('sau-reembolso', []) });
  await criarBalcao({ organizacaoId: g.id, criadoPorId: carla.id, n: 3088, tipo: 'Primeira consulta', cliente: cliFalso('Helena Prado', 3088), prazo: -3, itens: itensDoModelo('sau-consulta', [A, A, A, A]), concluido: true, diasRetencao: 30 });

  // Pro
  const p = await criarOrganizacao({ nome: 'Albuquerque & Lima Advocacia', sigla: 'AL', cor: '#8a5330', area: 'advocacia', plano: 'pro' });
  const ana = await criarUsuario(p.id, 'Ana Albuquerque', CONTAS_TESTE[1].email, 'admin');
  const bruno = await criarUsuario(p.id, 'Bruno Lima', 'bruno@albuquerquelima.adv.br', 'monta');
  const prioridade = await criarPasta(p.id, 'Prioridade', '#a9361b');
  const cartorio = await criarPasta(p.id, 'Esperando cartório', '#1c5d84');
  await criarBalcao({
    organizacaoId: p.id,
    criadoPorId: ana.id,
    pastaId: prioridade.id,
    n: 4127,
    tipo: 'Inventário',
    lembrete: true,
    cliente: { nome: 'Júlio César Albuquerque', cpf: '41287359027', whatsapp: '81998124127', email: 'julio.albuquerque@email.com' },
    prazo: 20,
    canal: 'whatsapp',
    itens: [
      { nome: 'Certidão de óbito', detalhe: 'A certidão emitida pelo cartório. Se tiver mais de uma página, envie todas.', obrigatorio: true, status: A, arquivo: 'certidao-obito-maria.pdf', enviado: momento(-6, 11, 5) },
      { nome: 'RG ou CNH do Júlio', detalhe: 'Frente e verso, ou a CNH digital em PDF.', obrigatorio: true, status: A, arquivo: 'cnh-julio.pdf', enviado: momento(-6, 11, 9) },
      { nome: 'Comprovante de residência', detalhe: 'Conta de luz, água ou internet dos últimos 90 dias.', obrigatorio: true, status: P },
      { nome: 'Certidão de casamento', detalhe: 'Só se o Júlio for casado. Pode ser a original ou uma cópia atualizada.', obrigatorio: false, status: P },
      { nome: 'Matrícula do apartamento', detalhe: 'A matrícula atualizada, pedida no cartório de registro de imóveis.', obrigatorio: true, status: E, arquivo: 'matricula-apartamento.pdf', enviado: momento(-1, 19, 42) },
      { nome: 'Documento do carro (CRLV)', detalhe: 'O documento mais recente, em PDF ou foto.', obrigatorio: true, status: P },
    ],
  });
  await criarBalcao({ organizacaoId: p.id, criadoPorId: bruno.id, n: 4131, tipo: 'Previdenciário', cliente: cliFalso('Marta Cavalcanti', 4131), prazo: 24, lembrete: true, itens: itensDoModelo('adv-aposentadoria', [A, E, E, E]) });
  await criarBalcao({ organizacaoId: p.id, criadoPorId: ana.id, pastaId: prioridade.id, n: 4109, tipo: 'Divórcio', cliente: cliFalso('Roberto e Camila Sales', 4109), prazo: 3, itens: itensDoModelo('adv-divorcio', [A, A, A, A, A, A]) });
  await criarBalcao({ organizacaoId: p.id, criadoPorId: bruno.id, pastaId: cartorio.id, n: 4140, tipo: 'Inventário', cliente: cliFalso('Lúcia Ferraz', 4140), prazo: 12, lembrete: true, itens: itensDoModelo('adv-inventario', []) });
  await criarBalcao({ organizacaoId: p.id, criadoPorId: bruno.id, n: 4098, tipo: 'Previdenciário', cliente: cliFalso('Paulo Henrique Rocha', 4098), prazo: 16, itens: itensDoModelo('adv-aposentadoria', [A, A, R, A, A]) });
  await criarBalcao({ organizacaoId: p.id, criadoPorId: ana.id, pastaId: cartorio.id, n: 4088, tipo: 'Imóveis', cliente: cliFalso('Condomínio Maré Alta', 4088), prazo: 27, itens: itensDoModelo('adv-imovel', [A, A, A, A, A, A, A]) });
  await criarBalcao({ organizacaoId: p.id, criadoPorId: ana.id, n: 4051, tipo: 'Família', cliente: cliFalso('Fernanda Rêgo', 4051), prazo: -4, itens: itensDoModelo('adv-pensao', [A, A, A, A, A, A]), concluido: true, concluidoHa: 85, diasRetencao: 90 });
  for (const m of [
    { nome: 'Inventário com herdeiro no exterior', quando: 'Criado a partir do caso da família Albuquerque.', base: 'adv-inventario' },
    { nome: 'Usucapião', quando: 'Para quem mora há anos num imóvel sem escritura.', base: 'adv-imovel' },
  ]) {
    const itens = MODELOS_PADRAO.find((x) => x.id === m.base)!.itens.slice(0, 6);
    await db.modelo.create({ data: { organizacaoId: p.id, area: 'advocacia', nome: m.nome, quando: m.quando, itens: { create: itens.map((it, k) => ({ ...it, ordem: k, organizacaoId: p.id })) } } });
  }

  // Ultra
  const u = await criarOrganizacao({ nome: 'Lins & Moura Contabilidade', sigla: 'LM', cor: '#13594b', area: 'contabilidade', plano: 'ultra' });
  const responsaveis = [
    await criarUsuario(u.id, 'Rafael Moura', CONTAS_TESTE[2].email, 'admin'),
    await criarUsuario(u.id, 'Patrícia Lins', 'patricia@linsmoura.com.br', 'admin'),
    await criarUsuario(u.id, 'Diego Santos', 'diego@linsmoura.com.br', 'monta'),
    await criarUsuario(u.id, 'Juliana Rocha', 'juliana@linsmoura.com.br', 'monta'),
  ];
  const pastasUltra = { pj: await criarPasta(u.id, 'Clientes PJ', '#13594b'), ir: await criarPasta(u.id, 'IR 2026', '#865600'), vip: await criarPasta(u.id, 'Atendimento prioritário', '#a9361b') };
  await criarUsuario(u.id, 'Thiago Barros', 'thiago@linsmoura.com.br', 'confere');
  await criarUsuario(u.id, 'Marina Costa', 'marina@linsmoura.com.br', 'confere');
  const nomes = ['Ana', 'Bruno', 'Cecília', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Larissa', 'Mateus', 'Natália', 'Otávio', 'Priscila', 'Renato', 'Sofia', 'Tiago', 'Vanessa', 'Wagner'];
  const sobrenomes = ['Barbosa', 'Cardoso', 'Duarte', 'Freitas', 'Gomes', 'Leal', 'Macedo', 'Nunes', 'Pacheco', 'Queiroz', 'Ramos', 'Siqueira', 'Torres', 'Vieira'];
  const empresas = ['Padaria Bom Grão', 'Ótica Visão Clara', 'Ateliê Mãos de Fada', 'Mercadinho Boa Viagem', 'Oficina Dois Irmãos', 'Pet Shop Maracatu', 'Studio Frevo Pilates'];
  const tipos = [
    { modelo: 'cont-irpf', tipo: 'Imposto de Renda' },
    { modelo: 'cont-mensal', tipo: 'Rotina do mês' },
    { modelo: 'cont-admissao', tipo: 'Admissão' },
    { modelo: 'cont-irpf', tipo: 'Imposto de Renda' },
    { modelo: 'cont-abertura', tipo: 'Abertura de empresa' },
  ];
  for (let k = 0; k < 49; k++) {
    const t = tipos[k % tipos.length];
    const empresa = t.tipo === 'Rotina do mês' || t.tipo === 'Admissão';
    const nome = empresa ? empresas[k % empresas.length] : `${nomes[k % nomes.length]} ${sobrenomes[(k * 5) % sobrenomes.length]}`;
    const concluido = k >= 46;
    const qtd = MODELOS_PADRAO.find((m) => m.id === t.modelo)!.itens.length;
    const status = Array.from({ length: qtd }, (_, j): StatusItem => {
      if (concluido) return k === 48 ? (j % 2 ? A : P) : A;
      const v = (k * 7 + j * 3) % 10;
      if (v < 4) return A;
      if (v < 6) return E;
      if (v === 6 && k % 5 === 0) return R;
      return P;
    });
    const n = 5000 + k * 3;
    const pasta = k % 7 === 3 ? pastasUltra.vip : empresa ? pastasUltra.pj : t.tipo === 'Imposto de Renda' && k % 2 === 0 ? pastasUltra.ir : undefined;
    await criarBalcao({ organizacaoId: u.id, criadoPorId: responsaveis[k % responsaveis.length].id, pastaId: pasta?.id, n, tipo: t.tipo, cliente: cliFalso(nome, n), prazo: concluido ? -6 : ((k * 11) % 46) - 6, lembrete: k % 3 !== 0, canal: k % 4 === 0 ? 'whatsapp' : 'email', itens: itensDoModelo(t.modelo, status), concluido, arquivado: k === 48 });
  }

  // Uso do mês, para testar os limites sem criar centenas de balcões:
  // Ultra com 198 balcões novos (o 3º que você criar já é excedente) e Pro com 298 das 300 mensagens de WhatsApp.
  const mes = mesDe();
  await db.usoMensal.create({ data: { organizacaoId: u.id, mes, balcoesCriados: 198, whatsappEnviados: 412, aviso180Em: momento(-3) } });
  await db.usoMensal.create({ data: { organizacaoId: p.id, mes, balcoesCriados: 6, whatsappEnviados: 298 } });

  console.log(`Seed pronto: 3 escritórios, ${docs} arquivos de exemplo no storage.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
