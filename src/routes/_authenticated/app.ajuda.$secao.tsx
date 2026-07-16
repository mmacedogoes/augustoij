import { createFileRoute, Link } from "@tanstack/react-router";
import { AjudaShell } from "@/components/ajuda/AjudaShell";

export const Route = createFileRoute("/_authenticated/app/ajuda/$secao")({
  component: SecaoGenerica,
});

const CONTEUDO: Record<string, { titulo: string; descricao: string; bullets: string[] }> = {
  "cadastro-condominio": {
    titulo: "Como cadastrar seu condomínio",
    descricao:
      "Cadastrar o condomínio é o primeiro passo. Cada condomínio funciona como uma pasta isolada: documentos, conversas e unidades ficam vinculados a ele. Você pode ter quantos condomínios seu plano permitir.",
    bullets: [
      "Acesse o menu Condomínios na barra lateral e clique em Novo.",
      "Preencha: nome, CNPJ (opcional), Cidade, UF, quantidade de unidades e categoria (prédio, casas, misto).",
      "O campo Cidade é obrigatório — é ele que permite à IA aplicar a legislação municipal correta.",
      "Ao cadastrar uma cidade que ainda não está na base municipal (hoje já cobertas: João Pessoa/PB, Cabedelo/PB e Campina Grande/PB), aparece um aviso: a legislação municipal daquela cidade é incorporada em até 3 dias úteis. Enquanto isso, a IA continua respondendo com base na legislação federal, estadual e na jurisprudência já indexadas.",
      "Salve — o condomínio já aparece na sua lista e pode ser selecionado na tela Início.",
      "Para editar dados depois, abra o condomínio e vá na aba Configurações.",
    ],
  },
  "carregar-documentos": {
    titulo: "Como carregar documentos importantes",
    descricao:
      "Os documentos do condomínio são o combustível da IA. Quanto mais rico o acervo, mais preciso o Augusto.IJ fica ao responder sobre o seu caso específico.",
    bullets: [
      "Abra o condomínio e vá na aba Documentos.",
      "Arraste os arquivos para a área indicada ou clique em Selecionar arquivos.",
      "Formatos aceitos: PDF, DOCX, TXT, JPG e PNG. Documentos escaneados são lidos automaticamente por reconhecimento de texto (OCR).",
      "Limite de 15 MB por arquivo (usuários comuns) e até 10 arquivos por upload.",
      "O sistema sugere automaticamente o tipo (Convenção, Regimento Interno, Ata, Contrato, etc.) e o título — revise se necessário.",
      "Se um arquivo já existir no acervo, o sistema alerta sobre a duplicidade antes de subir.",
      "Aguarde o status mudar para Pronto — só depois disso a IA passa a considerar o conteúdo do arquivo nas respostas.",
      "Prioridade recomendada: Convenção, Regimento Interno, últimas 3 atas de assembleia, prestações de contas recentes e contratos vigentes.",
    ],
  },
  "primeira-conversa": {
    titulo: "Primeira conversa com a IA",
    descricao:
      "Depois de cadastrar o condomínio e enviar ao menos a Convenção e o Regimento Interno, você já pode conversar com o Augusto. Comece com perguntas amplas e vá refinando.",
    bullets: [
      "Vá para a tela Início e selecione o condomínio no seletor superior.",
      "Verifique se os documentos que você quer usar estão com status Pronto.",
      "Digite sua pergunta na caixa de mensagem.",
      "Use Shift+Enter para quebrar linha dentro da mesma mensagem; Enter envia.",
      "A IA responde citando os trechos dos seus documentos que embasaram a resposta.",
      "Para retomar uma conversa depois, abra o condomínio e vá na aba Histórico de Conversas.",
    ],
  },
  onboarding: {
    titulo: "Tour guiado e onboarding",
    descricao:
      "Ao entrar pela primeira vez, o Augusto.IJ apresenta um passo a passo curto para você configurar sua conta e cadastrar o primeiro condomínio.",
    bullets: [
      "Confirme seus dados (nome, categoria de uso, telefone) na tela de onboarding.",
      "Aceite os termos de uso e a política de privacidade.",
      "Siga o tour guiado sobre a barra lateral, cadastro de condomínios e envio de documentos.",
      "Você pode pular o tour a qualquer momento — o manual está sempre disponível em Ajuda.",
      "Para reabrir o tour guiado, acesse Conta → Preferências e clique em Refazer tour.",
    ],
  },
  "chat-ia": {
    titulo: "Interação com a IA: o que pedir",
    descricao:
      "O Augusto.IJ atende síndicos, moradores, advogados e administradoras. Veja abaixo os pedidos mais comuns e como formulá-los para obter respostas úteis.",
    bullets: [
      "Notificações formais com base na Convenção e no Regimento (informe unidade, fato, data e reincidência).",
      "Modelos de atas de assembleia ordinária, extraordinária e convocações.",
      "Pareceres jurídicos sobre situações específicas (inadimplência, uso de área comum, animais, obras).",
      "Análise de contratos com semáforo de risco por cláusula (portaria, limpeza, manutenção, seguros).",
      "Explicação de dispositivos legais (Código Civil, Lei do Condomínio, leis estaduais e municipais quando disponíveis).",
      "Comunicados internos, editais e memorandos para moradores.",
      "Cheque a aba Dicas de interação com a IA para ver exemplos de prompts prontos.",
    ],
  },
  inicio: {
    titulo: "Tela Início",
    descricao:
      "A tela Início (antigo Dashboard) é o ponto de partida do dia a dia. É onde você conversa com a IA rapidamente sem precisar abrir um condomínio específico.",
    bullets: [
      "Selecione o condomínio ativo no seletor superior — a IA passa a considerar os documentos daquele condomínio.",
      "Digite sua pergunta na caixa de conversa e envie com Enter.",
      "Ao trocar de condomínio, a IA reinicia o contexto — cada condomínio tem seu próprio histórico.",
      "Se você ainda não tem condomínios cadastrados, o Início direciona para o cadastro.",
    ],
  },
  historico: {
    titulo: "Histórico de conversas",
    descricao:
      "Toda conversa fica salva dentro do condomínio em que foi iniciada, para consulta e continuação futura.",
    bullets: [
      "Abra o condomínio e vá na aba Histórico de Conversas.",
      "Cada conversa aparece com título automático, data e resumo.",
      "Clique em Abrir conversa para continuar de onde parou.",
      "Use a busca para localizar conversas por palavra-chave (assunto, unidade, data).",
      "As conversas ficam disponíveis enquanto sua conta e o condomínio existirem.",
    ],
  },
  documentos: {
    titulo: "Documentos: tipos aceitos e organização",
    descricao:
      "A aba Documentos, dentro de cada condomínio, é onde o acervo é gerenciado. Cada arquivo é indexado para que a IA possa citar trechos ao responder.",
    bullets: [
      "Formatos aceitos: PDF, DOCX, TXT, JPG e PNG.",
      "Documentos escaneados (imagens ou PDFs de imagem) passam por reconhecimento óptico de caracteres (OCR).",
      "Limite de 15 MB por arquivo para usuários comuns; até 10 arquivos por upload.",
      "O tipo (Convenção, Regimento Interno, Ata, Contrato, Prestação de Contas, Outros) é sugerido automaticamente — revise se necessário.",
      "Detecção de duplicidade evita que o mesmo arquivo seja subido duas vezes.",
      "Cada documento tem status: Enviando, Processando, Pronto ou Erro. Só documentos Prontos entram no contexto da IA.",
      "Você pode remover documentos a qualquer momento — a IA deixa de considerá-los imediatamente.",
    ],
  },
  unidades: {
    titulo: "Unidades do condomínio",
    descricao:
      "Cadastrar as unidades (apartamentos, casas, salas) permite endereçar notificações e comunicações com precisão, e ajuda a IA a personalizar textos.",
    bullets: [
      "Abra o condomínio e vá na aba Unidades.",
      "Cadastre unidades individualmente ou em lote (bloco, andar, número).",
      "Ao pedir uma notificação, informe a unidade (ex.: apto 502, bloco A) — a IA usa o cadastro para preencher os dados corretamente.",
      "É possível editar ou remover unidades quando houver reformas, unificações ou renumerações.",
    ],
  },
  configuracoes: {
    titulo: "Configurações do condomínio",
    descricao:
      "A aba Configurações reúne os dados cadastrais do condomínio e o controle de quem pode acessá-lo.",
    bullets: [
      "Apenas o dono (quem cadastrou o condomínio) pode editar os dados principais.",
      "Campos editáveis: nome, CNPJ, endereço, cidade, UF, quantidade de unidades e categoria.",
      "Contas PJ podem vincular operadores ao condomínio — veja a seção Operadores.",
      "Operadores têm acesso de leitura à configuração e podem interagir com a IA e com documentos.",
      "Todas as ações relevantes (edições, uploads, remoções) ficam registradas na trilha de auditoria da conta.",
    ],
  },
  operadores: {
    titulo: "Operadores (contas PJ)",
    descricao:
      "Contas Pessoa Jurídica (administradoras e escritórios) podem cadastrar operadores para que a equipe use o sistema sem compartilhar o login do titular.",
    bullets: [
      "Abra o condomínio, vá em Configurações e localize a área de Operadores.",
      "Você pode convidar alguém que já tem conta no Augusto.IJ ou criar um novo operador com login e senha próprios.",
      "Cada operador acessa apenas os condomínios aos quais foi vinculado.",
      "Operadores conseguem conversar com a IA, enviar e consultar documentos e ver o histórico.",
      "Operadores não editam dados cadastrais do condomínio nem removem outros operadores — isso é do titular.",
      "Para remover um operador, use o botão remover na lista de operadores do condomínio.",
    ],
  },
  "conta-dados": {
    titulo: "Dados pessoais e segurança",
    descricao:
      "A tela Conta reúne seus dados pessoais, opções de segurança e preferências. Mantê-la atualizada garante comunicações corretas e mais segurança.",
    bullets: [
      "Edite nome, e-mail de contato, telefone e categoria de uso (síndico morador, profissional, administradora, advogado, conselheiro).",
      "Troque sua senha na seção Segurança sempre que necessário.",
      "Encerre sua sessão no botão Sair, especialmente ao usar computadores compartilhados.",
      "Mantenha um e-mail válido: notificações importantes (limites do plano, avisos de segurança) são enviadas por lá.",
    ],
  },
  "conta-plano": {
    titulo: "Plano e limites",
    descricao:
      "Cada plano define quantos condomínios você pode cadastrar, o tamanho máximo de arquivo e a possibilidade de ter operadores vinculados.",
    bullets: [
      "O plano atual aparece no topo da tela Conta, com o resumo dos limites em uso.",
      "Quando o limite de condomínios do plano é atingido, o botão Novo fica bloqueado com uma dica explicando o motivo.",
      "Para aumentar limites (mais condomínios, arquivos maiores, operadores), faça upgrade a partir da tela Conta.",
      "As categorias PJ (administradora, escritório de advocacia) desbloqueiam a gestão de operadores.",
    ],
  },
  privacidade: {
    titulo: "Privacidade e LGPD",
    descricao:
      "O Augusto.IJ segue a Lei Geral de Proteção de Dados (LGPD). A tela Conta traz atalhos para exercer seus direitos como titular de dados.",
    bullets: [
      "Baixar meus dados — solicita um arquivo com todas as informações vinculadas à sua conta.",
      "Corrigir meus dados — abre um pedido de correção quando alguma informação estiver errada.",
      "E-mails de marketing — ative ou desative o recebimento de comunicações promocionais quando disponíveis.",
      "Excluir minha conta — remove sua conta e os dados associados, respeitando prazos legais de retenção.",
      "DPO — encarregado pelo tratamento de dados: privacidade@augusto.ij.",
      "Seus documentos NÃO são usados para treinar modelos de IA — o uso é restrito ao seu próprio condomínio.",
    ],
  },
};

export const PERFIS: Record<string, { titulo: string; descricao: string; bullets: string[] }> = {
  "sindico-morador": {
    titulo: "Guia para síndicos moradores",
    descricao:
      "Você mora no condomínio e assumiu a função de síndico. O Augusto.IJ ajuda a profissionalizar a comunicação e a fundamentar suas decisões.",
    bullets: [
      "Comece pela Convenção, Regimento Interno e as últimas 3 atas.",
      "Peça notificações formais informando unidade, fato, data e se é reincidência.",
      "Use modelos de atas de assembleia — descreva pauta, quórum e deliberações.",
      "Antes de aplicar multa, consulte a IA sobre o rito previsto na Convenção.",
      "Exemplo de pedido: “Gere notificação de barulho para o apto 302, ocorrido em 12/10 às 23h, primeira reincidência”.",
    ],
  },
  "sindico-profissional": {
    titulo: "Guia para síndicos profissionais",
    descricao:
      "Você administra vários condomínios como síndico profissional. O sistema permite manter padrões e alternar contextos rapidamente.",
    bullets: [
      "Cadastre cada condomínio como entidade separada com Convenção e Regimento próprios.",
      "Use o seletor superior na tela Início para trocar de condomínio em um clique.",
      "Padronize modelos: peça à IA para reutilizar a mesma estrutura de notificação em diferentes condomínios.",
      "Centralize o histórico de comunicações por unidade usando a aba Histórico.",
      "Exemplo de pedido: “Comparar cláusulas de portaria dos contratos anexados e apontar riscos”.",
    ],
  },
  administradora: {
    titulo: "Guia para administradoras",
    descricao:
      "Empresas administradoras podem gerir muitos condomínios e delegar operações à equipe por meio de operadores.",
    bullets: [
      "Cadastre cada condomínio gerido como entidade separada.",
      "Crie operadores para os membros da equipe e vincule-os aos condomínios que cada um atende.",
      "Use a trilha de auditoria para acompanhar quem enviou documentos ou pediu notificações.",
      "Padronize a base documental: exija Convenção, Regimento e últimas atas em todo condomínio novo.",
      "Exemplo de pedido: “Elaborar comunicado padrão de reajuste de taxa com base na ata da AGO”.",
    ],
  },
  advogado: {
    titulo: "Guia para advogados",
    descricao:
      "Advogados que atendem condomínios usam o Augusto.IJ para análises contratuais, pareceres e fundamentação com jurisprudência.",
    bullets: [
      "Anexe contratos completos e peça parecer cláusula a cláusula.",
      "Solicite jurisprudência aplicável — a IA cita as fontes, você valida no repositório oficial.",
      "Use o semáforo de risco (vermelho/amarelo/verde) para priorizar cláusulas críticas.",
      "Peça sugestões de redação alternativa quando encontrar riscos.",
      "Exemplo de pedido: “Analisar contrato de limpeza anexado, apontar cláusulas abusivas e sugerir redação para as vermelhas”.",
    ],
  },
  conselheiro: {
    titulo: "Guia para conselheiros",
    descricao:
      "Conselheiros usam o Augusto.IJ para revisar prestações de contas e apoiar a fiscalização da gestão.",
    bullets: [
      "Carregue as prestações de contas mensais em Documentos.",
      "Peça à IA para listar pontos de atenção, gastos atípicos e questionamentos sugeridos.",
      "Compare períodos: “compare a prestação de agosto com a de julho e destaque as variações relevantes”.",
      "Use o histórico para registrar as análises feitas e retomar em reuniões do conselho.",
    ],
  },
};

function SecaoGenerica() {
  const { secao } = Route.useParams();
  const data = CONTEUDO[secao];
  if (!data) {
    return (
      <AjudaShell>
        <h1 className="text-2xl font-semibold mb-3">Seção não encontrada</h1>
        <p>
          Volte para o{" "}
          <Link to="/app/ajuda" className="text-emerald-600 hover:underline">
            manual
          </Link>
          .
        </p>
      </AjudaShell>
    );
  }
  return (
    <AjudaShell>
      <h1 className="text-2xl font-semibold mb-3">{data.titulo}</h1>
      <p className="text-slate-600">{data.descricao}</p>
      <h2 className="text-lg font-semibold mt-6 mb-2">Passo a passo</h2>
      <ul className="list-disc pl-6 space-y-2">
        {data.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div className="mt-8 p-4 bg-slate-50 border border-dashed border-slate-300 rounded text-sm text-slate-500">
        Vídeo demonstrativo em produção. Em breve aqui.
      </div>
    </AjudaShell>
  );
}