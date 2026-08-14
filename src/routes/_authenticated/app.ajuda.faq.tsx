import { createFileRoute } from "@tanstack/react-router";
import { AjudaShell } from "@/components/ajuda/AjudaShell";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/app/ajuda/faq")({
  component: FAQ,
});

const PERGUNTAS = [
  {
    q: "Quais tipos de arquivo posso carregar?",
    a: "PDF, DOCX, TXT e imagens (JPG/PNG). Documentos escaneados — mesmo em PDF de imagem — são lidos automaticamente por reconhecimento de texto (OCR).",
  },
  {
    q: "Qual o limite de tamanho por arquivo?",
    a: "15 MB por arquivo para usuários comuns, com até 10 arquivos por upload. Planos superiores podem ter limites estendidos — veja a tela Conta.",
  },
  {
    q: "Meus documentos ficam protegidos?",
    a: "Sim. Apenas o titular do condomínio e os operadores por ele vinculados acessam. Há controle por papel e trilha de auditoria de todas as ações.",
  },
  {
    q: "A IA usa meus documentos para treinar modelos?",
    a: "Não. Seus documentos são usados exclusivamente para responder perguntas dentro do próprio condomínio — nunca para treinar modelos de IA.",
  },
  {
    q: "A IA pode gerar atas oficiais?",
    a: "Sim, a IA gera minutas de ata completas. Mas qualquer documento produzido deve ser revisado e assinado pelo responsável legal antes de ter valor formal.",
  },
  {
    q: "Posso usar a resposta da IA como peça jurídica final?",
    a: "Não sem revisão. A IA é uma ferramenta de apoio: cita legislação e jurisprudência, mas a validação e a assinatura são sempre do profissional responsável.",
  },
  {
    q: "Posso reabrir uma conversa antiga?",
    a: "Sim. Abra o condomínio, vá na aba Histórico de Conversas e clique em Abrir conversa. Também dá para buscar por palavra-chave.",
  },
  {
    q: "Cadastrei uma cidade nova — a IA já entende a legislação municipal?",
    a: "As legislações municipais de João Pessoa/PB, Cabedelo/PB e Campina Grande/PB já estão indexadas. Para qualquer outra cidade, a incorporação da legislação municipal acontece em até 3 dias úteis após o cadastro. Enquanto isso, a IA continua respondendo com base na legislação federal, estadual e na jurisprudência.",
  },
  {
    q: "O que muda entre os planos?",
    a: "Os planos definem quantos condomínios você pode cadastrar, o tamanho máximo dos arquivos e a possibilidade de vincular operadores. Os limites aparecem na tela Conta, e o botão Novo em Condomínios sinaliza quando o limite foi atingido.",
  },
  {
    q: "Sou administradora — como dou acesso ao meu time?",
    a: "Contas PJ podem criar operadores com login próprio e vincular cada operador aos condomínios que ele atende. Faça isso pela aba Configurações do condomínio.",
  },
  {
    q: "Como excluo minha conta e meus dados?",
    a: "Na tela Conta, seção Privacidade e dados, use Excluir minha conta. A exclusão respeita os prazos legais de retenção. Também há opções para baixar seus dados e solicitar correções (LGPD).",
  },
];

function FAQ() {
  return (
    <AppShell>
      <AjudaShell>
      <h1 className="text-2xl font-semibold mb-3">Perguntas frequentes</h1>
      <div className="space-y-5 mt-4">
        {PERGUNTAS.map((p) => (
          <div key={p.q}>
            <h3 className="font-semibold text-foreground">{p.q}</h3>
            <p className="text-muted-foreground mt-1">{p.a}</p>
          </div>
        ))}
      </div>
      </AjudaShell>
    </AppShell>
  );
}