import { abrir, criarKms, decifrarDadosCliente, naOrganizacao } from '@trames/db';
import { VALIDADE_CODIGO_MINUTOS, type PayloadFila } from '@trames/shared';
import type { ConteudoSelado } from '@trames/shared/filas';
import { enviar } from '../mensagens';

const kms = criarKms();

/** Monta e envia a mensagem. O telefone só é decifrado aqui, na hora de mandar. */
export async function enviarMensagem(p: PayloadFila['enviar-mensagem']) {
  const conteudo = JSON.parse(await abrir(kms, Buffer.from(p.selado, 'base64'), `fila:${p.organizacaoId}`)) as ConteudoSelado;

  await naOrganizacao(p.organizacaoId, async (tx) => {
    const org = await tx.organizacao.findUniqueOrThrow({ where: { id: p.organizacaoId } });

    if (p.tipo === 'login') {
      const u = await tx.usuario.findUnique({ where: { id: p.usuarioId! } });
      if (!u) return;
      return enviar(tx, {
        organizacaoId: org.id,
        usuarioId: u.id,
        canal: 'email',
        destino: u.email,
        assunto: 'Seu código para entrar na Trames',
        texto: `Seu código para entrar na Trames é ${conteudo.codigo}. Ele vale por ${VALIDADE_CODIGO_MINUTOS} minutos. Se não foi você que tentou entrar, troque a sua senha.`,
      });
    }

    if (p.tipo === 'convite') {
      const u = await tx.usuario.findUnique({ where: { id: p.usuarioId! } });
      if (!u) return;
      return enviar(tx, {
        organizacaoId: org.id,
        canal: 'email',
        destino: u.email,
        assunto: `Convite para a conta ${org.nome} na Trames`,
        texto: `Olá, ${u.nome.split(' ')[0]}. Você foi convidado para a conta ${org.nome} na Trames. Para entrar, crie sua senha por este link (vale 7 dias): ${conteudo.url}`,
      });
    }

    const b = await tx.balcao.findUnique({ where: { id: p.balcaoId! }, include: { cliente: true, itens: { select: { status: true } } } });
    if (!b) return;
    const destino = p.canal === 'whatsapp' ? (await decifrarDadosCliente(kms, b.cliente)).telefone : b.cliente.email;
    if (!destino) return;
    const nome = b.cliente.nome.split(' ')[0];
    const faltam = b.itens.filter((i) => i.status === 'pendente' || i.status === 'recusado').length;

    const textos = {
      codigo: { assunto: 'Seu código de acesso', texto: `${org.nome}: seu código para abrir o balcão de documentos é ${conteudo.codigo}. Vale por ${VALIDADE_CODIGO_MINUTOS} minutos. Não passe este código para ninguém.` },
      link: {
        assunto: `Documentos para ${org.nome}`,
        texto: conteudo.texto?.includes(conteudo.url ?? '') ? conteudo.texto : `${conteudo.texto || `Olá, ${nome}. ${org.nome} abriu um balcão para reunir os seus documentos.`} ${conteudo.url}`,
      },
      lembrete: {
        assunto: `Faltam documentos para ${org.nome}`,
        texto: `Olá, ${nome}. ${org.nome} ainda está esperando ${faltam} ${faltam === 1 ? 'documento' : 'documentos'}. Envie pelo celular, neste link: ${conteudo.url} (o link anterior deixa de valer).`,
      },
    };
    await enviar(tx, { organizacaoId: org.id, balcaoId: b.id, canal: p.canal, destino, ...textos[p.tipo] });
  });
}
