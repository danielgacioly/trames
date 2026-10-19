import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PLANOS } from '@trames/shared';
import { Icone } from '../../ui/Icone';
import { CabecalhoSite, RodapeSite } from './Site';

/*
 * Páginas de texto do site. Os textos de Termos e Privacidade são a base para
 * a revisão jurídica (docs/pendencias.md); os e-mails precisam existir antes do lançamento.
 */

const ATUALIZACAO = '19 de outubro de 2026';
export const EMAIL_CONTATO = 'contato@trames.app';
export const EMAIL_PRIVACIDADE = 'privacidade@trames.app';

function PaginaDeTexto({ titulo, resumo, atualizado, children }: { titulo: string; resumo: string; atualizado?: boolean; children: ReactNode }) {
  return (
    <div>
      <CabecalhoSite />
      <article className="texto-longo">
        <h1>{titulo}</h1>
        <p className="texto-suave" style={{ fontSize: 18, lineHeight: '28px' }}>
          {resumo}
        </p>
        {atualizado && <p className="miudo texto-suave">Atualizado em {ATUALIZACAO}.</p>}
        {children}
      </article>
      <RodapeSite />
    </div>
  );
}

export function Termos() {
  return (
    <PaginaDeTexto titulo="Termos de uso" resumo="As regras para usar a Trames, escritas para serem lidas. Se algo não ficar claro, fale com a gente." atualizado>
      <h2>1. O que é a Trames</h2>
      <p>
        A Trames é um serviço para escritórios de contabilidade, advocacia, consultórios e outros profissionais pedirem documentos aos seus clientes. Cada pedido é um balcão: uma lista do que é preciso, um link para o cliente enviar os arquivos e um lugar para conferir o que chegou.
      </p>
      <h2>2. Quem usa</h2>
      <ul>
        <li>
          <strong>Assinante</strong>: o escritório que cria a conta e os balcões. Quem cria a conta declara ter poderes para aceitar estes termos em nome do escritório.
        </li>
        <li>
          <strong>Equipe</strong>: as pessoas que o assinante convida. Cada uma tem login próprio e responde pelo que faz na conta.
        </li>
        <li>
          <strong>Cliente</strong>: quem recebe o link e envia os documentos. O cliente não cria conta e não paga nada.
        </li>
      </ul>
      <h2>3. Conta e acesso</h2>
      <p>
        Você é responsável por manter a sua senha em segredo. Todo login pede, além da senha, um código enviado para o seu e-mail. Se perceber um acesso que não reconhece, troque a senha em Configurações › Senha e acesso e desconecte os outros aparelhos.
      </p>
      <h2>4. Planos, pagamento e cancelamento</h2>
      <ul>
        <li>O plano Grátis não tem custo nem pede cartão.</li>
        <li>
          Os planos pagos são cobrados por mês ou por ano, adiantado, por Pix ou cartão. Os preços e limites estão em <Link to="/planos">Planos</Link>.
        </li>
        <li>No Ultra, os balcões novos além dos incluídos no mês entram na fatura seguinte, como mostrado em Planos.</li>
        <li>Você pode trocar de plano ou cancelar quando quiser. Ao cancelar, a conta volta para o Grátis no fim do período já pago.</li>
      </ul>
      <h2>5. Uso permitido</h2>
      <p>Não é permitido usar a Trames para pedir documentos sem base legal, enviar conteúdo ilegal ou malicioso, tentar acessar contas de outros escritórios ou atrapalhar o funcionamento do serviço. Contas que fizerem isso podem ser suspensas.</p>
      <h2>6. Os documentos são do escritório e do cliente</h2>
      <p>
        A Trames não usa os documentos para nenhum outro fim que não seja guardá-los e mostrá-los a quem tem acesso ao balcão. Depois de concluído o balcão, os arquivos são apagados no prazo do plano ({PLANOS.gratis.retencao.padrao} dias no Grátis, {PLANOS.pro.retencao.padrao} dias no Pro e de 30 dias a 12 meses no Ultra). Guarde uma cópia do que precisar manter por mais tempo.
      </p>
      <h2>7. Disponibilidade</h2>
      <p>Trabalhamos para a Trames ficar no ar o tempo todo, mas podem acontecer interrupções para manutenção ou por falhas de terceiros. Avisamos com antecedência quando a parada for planejada.</p>
      <h2>8. Responsabilidade</h2>
      <p>O escritório é responsável pelo que pede e pelo uso que faz dos documentos recebidos. A Trames responde pela guarda segura dos arquivos e pelo funcionamento do serviço, nos limites da lei.</p>
      <h2>9. Mudanças nestes termos</h2>
      <p>Se estes termos mudarem de forma importante, avisamos por e-mail quem administra a conta pelo menos 30 dias antes.</p>
      <h2>10. Contato e foro</h2>
      <p>
        Dúvidas sobre estes termos: <a href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>. Fica eleito o foro da comarca do Recife (PE), salvo quando a lei garantir outro ao consumidor.
      </p>
    </PaginaDeTexto>
  );
}

export function Privacidade() {
  return (
    <PaginaDeTexto titulo="Política de privacidade" resumo="Quais dados passam pela Trames, por quê, por quanto tempo e quais são os seus direitos pela LGPD." atualizado>
      <div className="indice">
        <strong style={{ fontWeight: 600 }}>Em resumo</strong>
        <ul style={{ marginTop: 8 }}>
          <li>Os documentos dos clientes pertencem ao escritório que os pediu. A Trames só guarda e mostra a quem tem acesso.</li>
          <li>Os arquivos ficam guardados com criptografia e são apagados depois de concluído o balcão, no prazo do plano.</li>
          <li>Não vendemos dados e não usamos documentos para treinar sistemas de terceiros.</li>
        </ul>
      </div>
      <h2>1. Quem é quem</h2>
      <p>
        Para os dados de quem usa o painel (nome, e-mail, cargo), a Trames é a <strong>controladora</strong>. Para os dados e documentos dos clientes do escritório, o escritório é o <strong>controlador</strong> e a Trames é a <strong>operadora</strong>: trata esses dados só para prestar o serviço, seguindo as instruções do escritório.
      </p>
      <h2>2. Quais dados</h2>
      <ul>
        <li>Da equipe do escritório: nome, e-mail, cargo, senha (guardada só como hash) e o registro de acessos.</li>
        <li>Dos clientes do escritório: nome, CPF, e-mail, WhatsApp e os documentos enviados. O CPF e o telefone ficam cifrados.</li>
        <li>Dados técnicos: navegador, sistema e endereço IP de cada acesso, para segurança e auditoria.</li>
      </ul>
      <h2>3. Para quê</h2>
      <ul>
        <li>Prestar o serviço: montar balcões, enviar links, códigos e lembretes, receber e mostrar documentos.</li>
        <li>Segurança: confirmar quem entra, evitar abuso e registrar quem viu, baixou, aprovou ou recusou cada documento.</li>
        <li>Cobrança e avisos sobre a conta.</li>
      </ul>
      <h2>4. Com quem compartilhamos</h2>
      <p>Só com os fornecedores necessários para o serviço funcionar, que atuam como suboperadores: hospedagem e armazenamento (AWS, no Brasil), envio de mensagens pelo WhatsApp (Meta) e o provedor de pagamento. Nenhum deles pode usar os dados para outro fim.</p>
      <h2>5. Por quanto tempo</h2>
      <p>
        Os documentos são apagados depois de concluído o balcão, no prazo do plano do escritório. Fica apenas o registro de que existiram. Os dados da conta ficam enquanto ela existir; ao encerrar a conta, são apagados, exceto o que a lei manda guardar.
      </p>
      <h2>6. Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados. Se você é cliente de um escritório, o pedido vai primeiro para ele, que tem as ferramentas para exportar ou apagar os seus dados na Trames. Se preferir, escreva para <a href={`mailto:${EMAIL_PRIVACIDADE}`}>{EMAIL_PRIVACIDADE}</a> e encaminhamos.
      </p>
      <h2>7. Segurança</h2>
      <p>Arquivos cifrados, isolamento entre escritórios no banco de dados, antivírus em cada envio, código de acesso para o cliente e para a equipe e registro de cada ação. Se houver um incidente que possa trazer risco, avisamos os escritórios afetados e a ANPD.</p>
      <h2>8. Cookies</h2>
      <p>Usamos só os cookies necessários para manter você conectado. Não usamos cookies de publicidade.</p>
      <h2>9. Encarregado</h2>
      <p>
        Fale com o encarregado de dados da Trames pelo e-mail <a href={`mailto:${EMAIL_PRIVACIDADE}`}>{EMAIL_PRIVACIDADE}</a>.
      </p>
    </PaginaDeTexto>
  );
}

const CANAIS: { icone: 'info' | 'equipe' | 'cadeado'; titulo: string; texto: string; email: string; assunto: string }[] = [
  { icone: 'info', titulo: 'Suporte', texto: 'Dúvidas sobre a conta, um balcão ou um documento.', email: EMAIL_CONTATO, assunto: 'Suporte' },
  { icone: 'equipe', titulo: 'Comercial', texto: 'Planos para escritórios maiores, demonstração para a equipe.', email: EMAIL_CONTATO, assunto: 'Comercial' },
  { icone: 'cadeado', titulo: 'Privacidade e dados', texto: 'Pedidos pela LGPD e assuntos de segurança.', email: EMAIL_PRIVACIDADE, assunto: 'Privacidade' },
];

export function Contato() {
  return (
    <PaginaDeTexto titulo="Fale com a gente" resumo="Quem responde é gente do time, em dias úteis. Antes, vale olhar a central de ajuda: a resposta pode estar lá.">
      <div className="ajuda-grupos" style={{ marginTop: 8 }}>
        {CANAIS.map((c) => (
          <a key={c.titulo} href={`mailto:${c.email}?subject=${encodeURIComponent(c.assunto)}`} className="cartao" style={{ textDecoration: 'none', color: 'var(--tinta)', gap: 10 }}>
            <span className="acao-rapida__icone">
              <Icone nome={c.icone} tamanho={20} />
            </span>
            <strong style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: 18 }}>{c.titulo}</strong>
            <span className="pequeno texto-suave">{c.texto}</span>
            <span className="pequeno" style={{ color: 'var(--mangue)', fontWeight: 500 }}>
              {c.email}
            </span>
          </a>
        ))}
      </div>
      <p className="pequeno texto-suave">
        É cliente de um escritório e tem dúvida sobre um pedido de documentos? Fale direto com o escritório: ele é quem vê e responde pelo seu balcão.
      </p>
      <Link to="/ajuda" className="tr-btn tr-btn--secundario" style={{ alignSelf: 'flex-start' }}>
        Ir para a central de ajuda
      </Link>
    </PaginaDeTexto>
  );
}

const PERGUNTAS: { grupo: string; itens: [string, string][] }[] = [
  {
    grupo: 'Começando',
    itens: [
      ['O que é um balcão?', 'É o pedido de documentos de um cliente: a lista do que você precisa, o prazo e o link que o cliente usa para enviar. Tudo o que chega fica ali, com a situação de cada item.'],
      ['Posso começar de um modelo?', 'Sim. Ao criar a conta você escolhe a sua área e já encontra modelos prontos. Nos planos Pro e Ultra, você também cria os seus.'],
      ['Como convido a minha equipe?', 'Em Equipe, digite o nome e o e-mail da pessoa. Ela recebe um convite para criar a senha. O Grátis tem 1 pessoa; o Pro, até 3; o Ultra, sem limite.'],
    ],
  },
  {
    grupo: 'Para o seu cliente',
    itens: [
      ['O cliente precisa baixar aplicativo ou criar conta?', 'Não. Ele abre o link no celular, confirma um código de seis números que chega por e-mail ou WhatsApp e envia as fotos ou PDFs.'],
      ['E se o cliente mandar o documento errado?', 'Você recusa dizendo o motivo. O cliente vê o que faltou e manda outro pelo mesmo link.'],
      ['O cliente recebe lembretes?', 'Se você deixar ligado, sim: três dias antes do prazo, no dia e dois dias depois, enquanto faltar documento obrigatório.'],
    ],
  },
  {
    grupo: 'Conta e segurança',
    itens: [
      ['Esqueci a minha senha', 'Na tela de entrar, clique em "Esqueci a senha" e informe o seu e-mail. O link para criar uma senha nova vale por 1 hora.'],
      ['Por que pede um código a cada login?', 'É a segunda etapa de segurança: mesmo que alguém descubra a sua senha, não entra sem o código que chega no seu e-mail.'],
      ['Onde fico sabendo do uso do plano?', 'Em Configurações › Plano e uso. Quando estiver perto de um limite, um aviso aparece no canto da tela para quem administra.'],
    ],
  },
  {
    grupo: 'Arquivos e LGPD',
    itens: [
      ['Por quanto tempo os arquivos ficam guardados?', 'Até o balcão ser concluído e, depois, pelo prazo do plano: 30 dias no Grátis, 90 no Pro e de 30 dias a 12 meses no Ultra. Uma semana antes de apagar, você recebe um e-mail.'],
      ['Um cliente pediu para apagar os dados dele. E agora?', 'Em Clientes, use Exportar dados ou Apagar. Fica só o registro de que o pedido foi atendido.'],
      ['Posso baixar tudo de um balcão?', 'Sim. Na tela do balcão, Baixar tudo monta um ZIP com os documentos.'],
    ],
  },
];

export function Ajuda() {
  return (
    <div>
      <CabecalhoSite atual="ajuda" />
      <section className="texto-longo" style={{ maxWidth: 1000 }}>
        <h1>Central de ajuda</h1>
        <p className="texto-suave" style={{ fontSize: 18, lineHeight: '28px' }}>
          As dúvidas mais comuns de quem pede e de quem envia documentos. Não achou?{' '}
          <Link to="/contato">Fale com a gente</Link>.
        </p>
        <div className="ajuda-grupos" style={{ marginTop: 16, alignItems: 'start' }}>
          {PERGUNTAS.map((g) => (
            <section key={g.grupo} className="cartao" style={{ gap: 0 }}>
              <h2 style={{ fontSize: 18, lineHeight: '24px', margin: '0 0 4px' }}>{g.grupo}</h2>
              {g.itens.map(([p, r]) => (
                <details key={p} className="pergunta">
                  <summary>{p}</summary>
                  <p>{r}</p>
                </details>
              ))}
            </section>
          ))}
        </div>
      </section>
      <RodapeSite />
    </div>
  );
}
