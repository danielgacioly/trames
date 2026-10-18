import type { AreaId, ItemEntrada as ItemModelo } from '@trames/shared';

export interface ModeloPadrao {
  id: string;
  area: AreaId;
  nome: string;
  quando: string;
  itens: ItemModelo[];
}

const i = (nome: string, detalhe: string, obrigatorio = true): ItemModelo => ({ nome, detalhe, obrigatorio });

export const MODELOS_PADRAO: ModeloPadrao[] = [
  // Advocacia
  {
    id: 'adv-inventario',
    area: 'advocacia',
    nome: 'Inventário',
    quando: 'Quando alguém da família faleceu e é preciso dividir os bens.',
    itens: [
      i('Certidão de óbito', 'A certidão emitida pelo cartório. Se tiver mais de uma página, envie todas.'),
      i('RG ou CNH', 'Frente e verso, ou a CNH digital em PDF.'),
      i('Comprovante de residência', 'Conta de luz, água ou internet dos últimos 90 dias.'),
      i('Certidão de casamento', 'Só se for casado. Pode ser a original ou uma cópia atualizada.', false),
      i('RG dos herdeiros', 'Um documento com foto de cada herdeiro.'),
      i('Matrícula do imóvel', 'A matrícula atualizada, pedida no cartório de registro de imóveis.'),
      i('Documento do carro (CRLV)', 'O documento mais recente, em PDF ou foto.', false),
      i('Extratos bancários', 'Saldo das contas na data do falecimento.'),
      i('Testamento', 'Só se existir.', false),
    ],
  },
  {
    id: 'adv-aposentadoria',
    area: 'advocacia',
    nome: 'Aposentadoria pelo INSS',
    quando: 'Para pedir aposentadoria ou revisar um benefício.',
    itens: [
      i('Extrato do CNIS', 'Baixe pelo Meu INSS, em "Extrato de contribuição".'),
      i('Carteiras de trabalho', 'Todas as páginas com registro, inclusive as antigas.'),
      i('PPP', 'Perfil profissiográfico, se trabalhou com algo insalubre.', false),
      i('RG ou CNH', 'Frente e verso.'),
      i('CPF', 'Pode ser o cartão ou um print do app da Receita.'),
      i('Comprovante de residência', 'Dos últimos 90 dias.'),
      i('Carnês de contribuição', 'Se pagou o INSS por conta própria.', false),
      i('Laudos médicos', 'Só se o pedido for por invalidez.', false),
    ],
  },
  {
    id: 'adv-divorcio',
    area: 'advocacia',
    nome: 'Divórcio consensual',
    quando: 'Quando o casal está de acordo e quer resolver em cartório ou na justiça.',
    itens: [
      i('Certidão de casamento', 'Atualizada, emitida há menos de 90 dias.'),
      i('Pacto antenupcial', 'Só se o casal fez.', false),
      i('RG e CPF dos dois', 'Um documento com foto de cada um.'),
      i('Comprovante de residência', 'De cada um, dos últimos 90 dias.'),
      i('Certidão de nascimento dos filhos', 'Se tiverem filhos.', false),
      i('Documentos dos bens', 'Matrícula de imóveis, CRLV de veículos.'),
      i('Comprovante de renda', 'Contracheque ou declaração de IR.'),
      i('Extratos bancários', 'Dos últimos 3 meses.'),
      i('Acordo de partilha', 'Rascunho do que o casal combinou, se já tiver.', false),
      i('Procuração', 'Se um dos dois não puder comparecer.', false),
    ],
  },
  {
    id: 'adv-trabalhista',
    area: 'advocacia',
    nome: 'Ação trabalhista',
    quando: 'Para reunir provas do vínculo e do que ficou sem pagar.',
    itens: [
      i('Carteira de trabalho', 'Páginas de identificação e do contrato.'),
      i('Contracheques', 'Os que tiver, de preferência dos últimos 12 meses.'),
      i('Termo de rescisão', 'Se a empresa entregou.', false),
      i('Extrato do FGTS', 'Baixe pelo app FGTS.'),
      i('Conversas e e-mails', 'Prints que mostrem horários, ordens ou cobranças.', false),
      i('RG ou CNH', 'Frente e verso.'),
      i('Comprovante de residência', 'Dos últimos 90 dias.'),
    ],
  },
  {
    id: 'adv-imovel',
    area: 'advocacia',
    nome: 'Compra e venda de imóvel',
    quando: 'Para conferir a documentação antes da escritura.',
    itens: [
      i('Matrícula atualizada', 'Emitida há menos de 30 dias.'),
      i('Certidões do vendedor', 'Cíveis, trabalhistas e de protesto.'),
      i('IPTU', 'O carnê do ano e a certidão negativa.'),
      i('RG e CPF do vendedor', 'Um documento com foto.'),
      i('RG e CPF do comprador', 'Um documento com foto.'),
      i('Certidão de casamento do vendedor', 'Se for casado.', false),
      i('Declaração de quitação do condomínio', 'Se for apartamento.', false),
      i('Habite-se', 'Para imóveis novos.', false),
      i('Contrato de promessa', 'Se já existir.', false),
      i('Comprovante de residência', 'De comprador e vendedor.'),
      i('Comprovante de pagamento do sinal', 'Se já houve pagamento.', false),
    ],
  },
  {
    id: 'adv-pensao',
    area: 'advocacia',
    nome: 'Pensão alimentícia',
    quando: 'Para pedir, revisar ou cobrar pensão.',
    itens: [
      i('Certidão de nascimento', 'De cada filho.'),
      i('Comprovantes de gastos', 'Escola, saúde, alimentação.'),
      i('Comprovante de renda', 'Seu e, se souber, o da outra parte.'),
      i('RG ou CNH', 'Frente e verso.'),
      i('Comprovante de residência', 'Dos últimos 90 dias.'),
      i('Decisão anterior', 'Se for revisão ou cobrança.', false),
    ],
  },

  // Contabilidade
  {
    id: 'cont-irpf',
    area: 'contabilidade',
    nome: 'Imposto de Renda pessoa física',
    quando: 'Para a declaração anual.',
    itens: [
      i('Informes de rendimentos', 'Da empresa onde trabalha e de cada banco.'),
      i('Recibos médicos', 'Consultas, exames, plano de saúde.'),
      i('Extratos', 'Saldo das contas em 31 de dezembro.'),
      i('Declaração do ano anterior', 'O arquivo ou o recibo de entrega.'),
      i('Comprovantes de educação', 'Mensalidades de escola e faculdade.', false),
      i('Documentos de bens comprados', 'Imóveis ou veículos adquiridos no ano.', false),
      i('Informe de previdência privada', 'Se tiver.', false),
      i('RG e CPF dos dependentes', 'Se for declarar alguém.', false),
      i('Comprovante de residência', 'Atual.'),
      i('Recibos de aluguel', 'Se pagou ou recebeu aluguel.', false),
    ],
  },
  {
    id: 'cont-abertura',
    area: 'contabilidade',
    nome: 'Abertura de empresa',
    quando: 'Para registrar um CNPJ novo.',
    itens: [
      i('RG e CPF dos sócios', 'Um documento com foto de cada sócio.'),
      i('Comprovante de endereço dos sócios', 'Dos últimos 90 dias.'),
      i('IPTU do ponto', 'Do local onde a empresa vai funcionar.'),
      i('Contrato de aluguel do ponto', 'Se o local for alugado.', false),
      i('Certidão de casamento dos sócios', 'Se algum for casado.', false),
      i('Descrição das atividades', 'Conte o que a empresa vai fazer.'),
      i('Título de eleitor', 'De cada sócio.'),
      i('Recibo do último IR', 'De cada sócio.'),
    ],
  },
  {
    id: 'cont-mensal',
    area: 'contabilidade',
    nome: 'Rotina do mês',
    quando: 'Fechamento mensal de empresa do Simples.',
    itens: [
      i('Extratos bancários', 'De todas as contas da empresa no mês.'),
      i('Notas fiscais emitidas', 'O arquivo XML ou o relatório do sistema.'),
      i('Notas de compra', 'Fornecedores e despesas.'),
      i('Folha de ponto', 'Se tiver funcionários.', false),
      i('Comprovantes de pagamento', 'Boletos e transferências pagos.'),
    ],
  },
  {
    id: 'cont-admissao',
    area: 'contabilidade',
    nome: 'Admissão de funcionário',
    quando: 'Para registrar alguém novo na folha.',
    itens: [
      i('Carteira de trabalho digital', 'Print da tela do app.'),
      i('RG e CPF', 'Frente e verso.'),
      i('Comprovante de residência', 'Dos últimos 90 dias.'),
      i('Exame admissional', 'O ASO assinado pelo médico.'),
      i('Certidão de nascimento dos filhos', 'Para o salário-família.', false),
      i('Dados bancários', 'Banco, agência e conta para o salário.'),
    ],
  },

  // Saúde
  {
    id: 'sau-preop',
    area: 'saude',
    nome: 'Pré-operatório',
    quando: 'Exames e autorizações antes de uma cirurgia.',
    itens: [
      i('Hemograma', 'Feito há menos de 30 dias.'),
      i('Eletrocardiograma', 'Com o laudo.'),
      i('Guia do plano', 'A autorização da cirurgia.'),
      i('Carteirinha do plano', 'Frente e verso.'),
      i('RG ou CNH', 'Frente e verso.'),
      i('Avaliação do cardiologista', 'Se tiver mais de 50 anos.', false),
    ],
  },
  {
    id: 'sau-consulta',
    area: 'saude',
    nome: 'Primeira consulta',
    quando: 'Para o paciente chegar com tudo em ordem.',
    itens: [
      i('RG ou CNH', 'Frente e verso.'),
      i('Carteirinha do plano', 'Frente e verso.', false),
      i('Exames anteriores', 'Os mais recentes que tiver.', false),
      i('Lista de remédios', 'Nome e dose do que toma hoje.'),
    ],
  },
  {
    id: 'sau-reembolso',
    area: 'saude',
    nome: 'Reembolso do plano',
    quando: 'Para pedir de volta o que o paciente pagou.',
    itens: [
      i('Nota fiscal ou recibo', 'Com CPF do paciente e CNPJ ou CRM de quem atendeu.'),
      i('Pedido médico', 'A solicitação do exame ou procedimento.'),
      i('Laudo', 'Se for exame.', false),
      i('Dados bancários', 'Do titular do plano.'),
    ],
  },
];
