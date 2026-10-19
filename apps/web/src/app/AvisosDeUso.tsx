import { useEffect } from 'react';
import { AVISO_BALCOES_NO_MES, type UsoDto } from '@trames/shared';
import { useCobranca, useSessao } from '../dados/consultas';
import { useNotificar, type Notificacao } from '../ui';
import { moeda, plural } from '../util/formatos';

type Plano = ReturnType<typeof useSessao>['plano'];

/** Avisos de uso que valem para o mês, do mais importante para o menos. A chave evita repetir o mesmo aviso. */
export function avisosDeUso(plano: Plano, uso: UsoDto): (Notificacao & { chave: string })[] {
  const lista: (Notificacao & { chave: string })[] = [];
  const limite = plano.limiteBalcoes;
  if (limite !== null) {
    const restam = limite - uso.balcoesAtivos;
    if (restam <= 0)
      lista.push({ chave: 'balcoes-cheio', tom: 'aviso', titulo: 'Limite de balcões ativos', texto: `Você está usando os ${limite} balcões do plano ${plano.nome}. Conclua um balcão que já terminou ou mude de plano.` });
    else if (restam <= Math.max(1, Math.round(limite * 0.1)))
      lista.push({ chave: 'balcoes-quase', tom: 'aviso', titulo: `${plural(restam, 'balcão disponível', 'balcões disponíveis')}`, texto: `${uso.balcoesAtivos} de ${limite} balcões ativos no plano ${plano.nome}.` });
  }
  if (plano.balcoesNoMes !== null) {
    if (uso.excedentes > 0)
      lista.push({ chave: `excedentes-${uso.excedentes >= 50 ? 50 : uso.excedentes >= 10 ? 10 : 1}`, tom: 'aviso', titulo: `${plural(uso.excedentes, 'balcão excedente', 'balcões excedentes')} neste mês`, texto: `${moeda(uso.valorExcedentesCentavos)} entram na próxima fatura.` });
    else if (uso.balcoesNoMes >= AVISO_BALCOES_NO_MES)
      lista.push({ chave: 'mes-quase', tom: 'aviso', titulo: `${uso.balcoesNoMes} de ${plano.balcoesNoMes} balcões do mês`, texto: 'Depois do limite, cada balcão novo custa R$ 1,00, sem bloqueio.' });
  }
  if (plano.cotaWhatsapp > 0) {
    if (uso.whatsappEnviados >= plano.cotaWhatsapp)
      lista.push({ chave: 'whatsapp-fim', tom: 'aviso', titulo: 'A cota de WhatsApp do mês acabou', texto: 'Até o mês virar, códigos e lembretes vão por e-mail.' });
    else if (uso.whatsappEnviados >= plano.cotaWhatsapp * 0.9)
      lista.push({ chave: 'whatsapp-quase', tom: 'aviso', titulo: 'A cota de WhatsApp está no fim', texto: `${uso.whatsappEnviados.toLocaleString('pt-BR')} de ${plano.cotaWhatsapp.toLocaleString('pt-BR')} mensagens enviadas neste mês.` });
  }
  return lista;
}

function jaMostrado(chave: string) {
  try {
    if (sessionStorage.getItem(chave)) return true;
    sessionStorage.setItem(chave, '1');
  } catch {
    /* sem storage: mostra de novo, sem problema */
  }
  return false;
}

/**
 * Avisos de uso aparecem só como notificação, uma vez por sessão, para quem
 * administra a conta. O detalhe fica em Minha conta › Plano e uso.
 */
export function AvisosDeUso() {
  const s = useSessao();
  const admin = s.usuario.permissao === 'admin';
  const uso = useCobranca(admin).data;
  const notificar = useNotificar();

  useEffect(() => {
    if (!uso) return;
    for (const a of avisosDeUso(s.plano, uso)) {
      if (jaMostrado(`trames.aviso.${s.organizacao.id}.${uso.mes}.${a.chave}`)) continue;
      const { chave: _, ...n } = a;
      notificar({ ...n, acao: { rotulo: 'Ver uso', para: '/app/conta/plano' } });
    }
  }, [uso, s.plano, s.organizacao.id, notificar]);

  return null;
}
