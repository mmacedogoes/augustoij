import { useEffect, useState } from "react";
import { Joyride, STATUS, type EventData, type Step } from "react-joyride";
import { useServerFn } from "@tanstack/react-start";
import { setTourCompleto } from "@/lib/condominios.functions";

type PerfilAtuacao =
  | "sindico_morador"
  | "sindico_profissional"
  | "administradora"
  | "advogado"
  | "conselheiro"
  | null
  | undefined;

function buildSteps(perfil: PerfilAtuacao): Step[] {
  const comum: Step[] = [
    {
      target: "body",
      placement: "center",
      title: "Bem-vindo ao Augusto.IJ",
      content:
        "Seu assistente inteligente para gestão de condomínios. Vamos te mostrar rapidamente como aproveitar ao máximo.",
    },
    {
      target: "[data-tour='seletor-condominio']",
      title: "Seu condomínio ativo",
      content:
        "Use este seletor para alternar entre condomínios sem perder o histórico das conversas.",
    },
    {
      target: "[data-tour='chat-box']",
      title: "Converse com a IA",
      content:
        "Digite aqui sua dúvida, peça notificações, atas, pareceres. A IA usa seus documentos como contexto.",
    },
    {
      target: "[data-tour='nav-condominios']",
      title: "Documentos",
      content:
        "Cadastre a Convenção, Regimento Interno e atas. Quanto mais documentos, melhores as respostas.",
    },
    {
      target: "[data-tour='nav-conta']",
      title: "Sua conta",
      content: "Gerencie plano, dados pessoais e usuários vinculados.",
    },
  ];
  const especifico: Record<string, Step> = {
    sindico_morador: {
      target: "[data-tour='chat-box']",
      title: "Dica para síndicos moradores",
      content:
        "Use a IA para gerar notificações formais e atas de assembleia rapidamente.",
    },
    sindico_profissional: {
      target: "[data-tour='chat-box']",
      title: "Dica para síndicos profissionais",
      content:
        "Padronize comunicações entre condomínios — peça modelos com sua identidade visual e tom.",
    },
    administradora: {
      target: "[data-tour='nav-condominios']",
      title: "Dica para administradoras",
      content:
        "Cadastre múltiplos condomínios e vincule operadores em Conta > Usuários Vinculados.",
    },
    advogado: {
      target: "[data-tour='chat-box']",
      title: "Dica para advogados",
      content:
        "Peça análise contratual com semáforo de risco por cláusula e fundamentação com jurisprudência.",
    },
    conselheiro: {
      target: "[data-tour='chat-box']",
      title: "Dica para conselheiros",
      content:
        "Use para revisar prestações de contas e formular questionamentos fundamentados.",
    },
  };
  const extra = perfil && especifico[perfil] ? [especifico[perfil]] : [];
  return [...comum, ...extra];
}

type Props = {
  perfil: PerfilAtuacao;
  forceRun?: boolean;
  onClose?: () => void;
};

export function OnboardingTour({ perfil, forceRun = false, onClose }: Props) {
  const [run, setRun] = useState(false);
  const persist = useServerFn(setTourCompleto);

  useEffect(() => {
    if (forceRun) setRun(true);
  }, [forceRun]);

  useEffect(() => {
    if (!forceRun) {
      // small delay to ensure targets are mounted
      const t = setTimeout(() => setRun(true), 400);
      return () => clearTimeout(t);
    }
  }, [forceRun]);

  function handleEvent(data: EventData) {
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finished.includes(data.status)) {
      setRun(false);
      persist({ data: { completo: true } }).catch(() => {});
      onClose?.();
    }
  }

  return (
    <Joyride
      steps={buildSteps(perfil)}
      run={run}
      continuous
      onEvent={handleEvent}
      options={{
        primaryColor: "#10B981",
        zIndex: 10000,
        textColor: "#0B1426",
        backgroundColor: "#FFFFFF",
        arrowColor: "#FFFFFF",
        overlayColor: "rgba(11, 20, 38, 0.55)",
        showProgress: true,
        skipBeacon: true,
      }}
      locale={{
        back: "Voltar",
        close: "Fechar",
        last: "Finalizar",
        next: "Próximo",
        skip: "Pular tour",
      }}
    />
  );
}