import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/ajuda/$secao")({
  component: SecaoGenerica,
});

const CONTEUDO: Record<string, { titulo: string; descricao: string; bullets: string[] }> = {
  "cadastro-condominio": {
    titulo: "Como cadastrar seu condomínio",
    descricao:
      "Comece criando o registro do seu condomínio para que conversas e documentos fiquem organizados por contexto.",
    bullets: [
      "Acesse o menu Condomínios na barra lateral.",
      "Clique em Novo no canto superior direito.",
      "Preencha nome, UF e quantidade de unidades.",
      "Salve — o condomínio já fica selecionado no Dashboard.",
    ],
  },
  "carregar-documentos": {
    titulo: "Como carregar documentos importantes",
    descricao: "Cadastre Convenção, Regimento Interno e atas para que a IA use como contexto.",
    bullets: [
      "Abra o condomínio e vá na aba Documentos.",
      "Arraste arquivos ou clique em Selecionar arquivos.",
      "Revise tipo e título sugeridos automaticamente.",
      "Aguarde o processamento (status Pronto) antes de usar no chat.",
    ],
  },
  "primeira-conversa": {
    titulo: "Primeira conversa com a IA",
    descricao: "Comece com perguntas amplas e refine. A IA usa os documentos cadastrados como referência.",
    bullets: [
      "No Dashboard, selecione o condomínio.",
      "Digite sua pergunta na caixa de mensagem.",
      "Use Shift+Enter para quebrar linha.",
      "Reabra qualquer conversa antiga em Histórico.",
    ],
  },
  "chat-ia": {
    titulo: "Chat com IA: o que pedir",
    descricao: "Notificações, atas, pareceres, análises contratuais e dúvidas operacionais.",
    bullets: [
      "Notificações formais com base na Convenção.",
      "Modelos de atas de assembleia.",
      "Pareceres sobre situações específicas.",
      "Análise de contratos com semáforo de risco.",
    ],
  },
  documentos: {
    titulo: "Documentos: tipos aceitos e organização",
    descricao: "Suporte para PDF, DOCX, TXT e imagens. Escaneados são lidos via visão computacional.",
    bullets: [
      "Limite de 15 MB por arquivo (usuários comuns).",
      "Até 10 arquivos por upload.",
      "Tipos sugeridos automaticamente.",
      "Detecção de duplicidade antes do envio.",
    ],
  },
  configuracoes: {
    titulo: "Configurações do condomínio",
    descricao: "Edição de dados, gestão de operadores e configurações avançadas.",
    bullets: [
      "Apenas o dono edita dados do condomínio.",
      "PJ pode cadastrar operadores vinculados.",
      "Operadores têm acesso somente leitura à configuração.",
    ],
  },
};

export const PERFIS: Record<string, { titulo: string; descricao: string; bullets: string[] }> = {
  "sindico-morador": {
    titulo: "Guia para síndicos moradores",
    descricao: "Foco em comunicação com moradores, notificações e atas de assembleia.",
    bullets: [
      "Gere notificações formais com base no Regimento.",
      "Use modelos de atas e comunicados rapidamente.",
      "Consulte a IA antes de aplicar sanções.",
    ],
  },
  "sindico-profissional": {
    titulo: "Guia para síndicos profissionais",
    descricao: "Foco em padronização entre condomínios e produtividade.",
    bullets: [
      "Mantenha padrão de comunicação por condomínio.",
      "Use o seletor de condomínio para alternar rapidamente.",
      "Centralize histórico de comunicações por unidade.",
    ],
  },
  administradora: {
    titulo: "Guia para administradoras",
    descricao: "Foco em gestão de múltiplos condomínios e operadores.",
    bullets: [
      "Cadastre cada condomínio gerido como entidade separada.",
      "Vincule operadores em Conta.",
      "Use a auditoria para acompanhar ações da equipe.",
    ],
  },
  advogado: {
    titulo: "Guia para advogados",
    descricao: "Foco em análise contratual e fundamentação jurídica.",
    bullets: [
      "Anexe o contrato e peça parecer pormenorizado.",
      "Solicite jurisprudência aplicável.",
      "Use semáforo de risco por cláusula.",
    ],
  },
  conselheiro: {
    titulo: "Guia para conselheiros",
    descricao: "Foco em revisão de prestações de contas e fiscalização.",
    bullets: [
      "Carregue prestações de contas para análise.",
      "Peça pontos de atenção e questionamentos sugeridos.",
      "Use o histórico para comparar períodos.",
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