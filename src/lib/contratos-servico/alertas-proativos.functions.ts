import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { condominiosAcessiveis, isSuperAdmin } from "./guard";
import {
  calcularVencimentoDetalhadoInfo,
  calcularAvisoPrevioInfo,
  calcularReajusteStatusInfo,
} from "./status";
import { calcularIndiceParaReajuste, rotuloIndiceContrato, round2 } from "./indices";

const filtroSchema = z.object({
  condominioId: z.string().uuid().nullable().optional(),
});

export type PrioridadeAlerta = "alta" | "media" | "baixa";

export type ItemAlertaProativo = {
  id: string;
  contratoId: string;
  tipoModulo: "servico";
  tipoAlerta:
    | "vencido"
    | "vencendo_30d"
    | "vencendo_60d"
    | "vencendo_90d"
    | "reajuste_devido"
    | "aviso_previo_critico";
  prioridade: PrioridadeAlerta;
  titulo: string;
  subtitulo: string;
  condominioNome: string;
  prestadorOuInquilino: string;
  valorMensal: number | null;
  dataReferencia: string | null;
  diasRestantes: number | null;
  acaoRecomendada: string;
  linkDestino: string;
};

export type ResumoAlertasProativos = {
  metricas: {
    totalContratosServicoAtivos: number;
    servicosVencidos: number;
    servicosVencendo30d: number;
    servicosVencendo60d: number;
    servicosVencendo90d: number;
    servicosReajustesPendentes: number;
    servicosAvisoPrevioCritico: number;
    totalAlertasCriticos: number;
  };
  alertas: ItemAlertaProativo[];
};

export const getAlertasProativosContratos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => filtroSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isSuper = await isSuperAdmin(context);
    const userId = context.userId;

    // 1. Contratos de Prestação de Serviços
    let qServicos = supabaseAdmin
      .from("contratos_servico")
      .select(
        "id, condominio_id, prestador_nome, situacao, prazo_indeterminado, data_inicio, data_fim, valor, tipo_valor, mes_base_reajuste, indice_reajuste, ultimo_reajuste_em, aviso_previo_dias, renovacao_automatica, condominios(nome)",
      )
      .eq("situacao", "ativo");

    if (data.condominioId) {
      qServicos = qServicos.eq("condominio_id", data.condominioId);
    } else if (!isSuper) {
      const ids = await condominiosAcessiveis(context);
      if (ids.length > 0) {
        qServicos = qServicos.in("condominio_id", ids);
      } else {
        qServicos = qServicos.in("condominio_id", ["00000000-0000-0000-0000-000000000000"]);
      }
    }

    const { data: servicosRows } = await qServicos;
    const servicos = servicosRows ?? [];

    const alertas: ItemAlertaProativo[] = [];

    let servicosVencidos = 0;
    let servicosVencendo30d = 0;
    let servicosVencendo60d = 0;
    let servicosVencendo90d = 0;
    let servicosReajustesPendentes = 0;
    let servicosAvisoPrevioCritico = 0;

    for (const c of servicos) {
      const condNome = (c.condominios as unknown as { nome: string })?.nome ?? "Condomínio";
      const valor = c.valor ? Number(c.valor) : null;

      // Vigência
      const vInfo = calcularVencimentoDetalhadoInfo({
        situacao: c.situacao,
        prazo_indeterminado: c.prazo_indeterminado,
        data_fim: c.data_fim,
      });

      if (vInfo.faixa === "vencido") {
        servicosVencidos++;
        alertas.push({
          id: `serv-vencido-${c.id}`,
          contratoId: c.id,
          tipoModulo: "servico",
          tipoAlerta: "vencido",
          prioridade: "alta",
          titulo: `Contrato Vencido — ${c.prestador_nome}`,
          subtitulo: `Vencido há ${Math.abs(vInfo.diasRestantes ?? 0)} dias (${vInfo.dataFimFormatada})`,
          condominioNome: condNome,
          prestadorOuInquilino: c.prestador_nome,
          valorMensal: valor,
          dataReferencia: c.data_fim,
          diasRestantes: vInfo.diasRestantes,
          acaoRecomendada: vInfo.acaoRecomendada,
          linkDestino: `/app/contratos/${c.id}`,
        });
      } else if (vInfo.faixa === "urgente_30d") {
        servicosVencendo30d++;
        alertas.push({
          id: `serv-venc30-${c.id}`,
          contratoId: c.id,
          tipoModulo: "servico",
          tipoAlerta: "vencendo_30d",
          prioridade: "alta",
          titulo: `Vencimento em ${vInfo.diasRestantes} dias — ${c.prestador_nome}`,
          subtitulo: `Término previsto para ${vInfo.dataFimFormatada}`,
          condominioNome: condNome,
          prestadorOuInquilino: c.prestador_nome,
          valorMensal: valor,
          dataReferencia: c.data_fim,
          diasRestantes: vInfo.diasRestantes,
          acaoRecomendada: vInfo.acaoRecomendada,
          linkDestino: `/app/contratos/${c.id}`,
        });
      } else if (vInfo.faixa === "atencao_60d") {
        servicosVencendo60d++;
        alertas.push({
          id: `serv-venc60-${c.id}`,
          contratoId: c.id,
          tipoModulo: "servico",
          tipoAlerta: "vencendo_60d",
          prioridade: "media",
          titulo: `Vence em ${vInfo.diasRestantes} dias — ${c.prestador_nome}`,
          subtitulo: `Término previsto para ${vInfo.dataFimFormatada}`,
          condominioNome: condNome,
          prestadorOuInquilino: c.prestador_nome,
          valorMensal: valor,
          dataReferencia: c.data_fim,
          diasRestantes: vInfo.diasRestantes,
          acaoRecomendada: vInfo.acaoRecomendada,
          linkDestino: `/app/contratos/${c.id}`,
        });
      } else if (vInfo.faixa === "alerta_90d") {
        servicosVencendo90d++;
        alertas.push({
          id: `serv-venc90-${c.id}`,
          contratoId: c.id,
          tipoModulo: "servico",
          tipoAlerta: "vencendo_90d",
          prioridade: "baixa",
          titulo: `Vence em ${vInfo.diasRestantes} dias — ${c.prestador_nome}`,
          subtitulo: `Término previsto para ${vInfo.dataFimFormatada}`,
          condominioNome: condNome,
          prestadorOuInquilino: c.prestador_nome,
          valorMensal: valor,
          dataReferencia: c.data_fim,
          diasRestantes: vInfo.diasRestantes,
          acaoRecomendada: vInfo.acaoRecomendada,
          linkDestino: `/app/contratos/${c.id}`,
        });
      }

      // Aviso prévio
      const avisoInfo = calcularAvisoPrevioInfo({
        data_fim: c.data_fim,
        aviso_previo_dias: c.aviso_previo_dias,
        renovacao_automatica: c.renovacao_automatica,
        prazo_indeterminado: c.prazo_indeterminado,
        situacao: c.situacao,
      });

      if (avisoInfo.emJanelaCritica || avisoInfo.expirado) {
        servicosAvisoPrevioCritico++;
        if (vInfo.faixa !== "vencido" && vInfo.faixa !== "urgente_30d") {
          alertas.push({
            id: `serv-aviso-${c.id}`,
            contratoId: c.id,
            tipoModulo: "servico",
            tipoAlerta: "aviso_previo_critico",
            prioridade: "alta",
            titulo: `Aviso Prévio Crítico — ${c.prestador_nome}`,
            subtitulo: avisoInfo.textoFormatado,
            condominioNome: condNome,
            prestadorOuInquilino: c.prestador_nome,
            valorMensal: valor,
            dataReferencia: avisoInfo.dataLimiteAviso,
            diasRestantes: avisoInfo.diasRestantesAviso,
            acaoRecomendada:
              "Notificar formalmente a empresa caso não pretenda renovar o contrato.",
            linkDestino: `/app/contratos/${c.id}`,
          });
        }
      }

      // Reajuste
      const rInfo = calcularReajusteStatusInfo({
        mes_base_reajuste: c.mes_base_reajuste,
        indice_reajuste: c.indice_reajuste,
        ultimo_reajuste_em: c.ultimo_reajuste_em,
        situacao: c.situacao,
      });

      if (rInfo.status === "pendente" || rInfo.status === "proximo_30d") {
        servicosReajustesPendentes++;
        alertas.push({
          id: `serv-reaj-${c.id}`,
          contratoId: c.id,
          tipoModulo: "servico",
          tipoAlerta: "reajuste_devido",
          prioridade: rInfo.status === "pendente" ? "alta" : "media",
          titulo: `Reajuste de Contrato — ${c.prestador_nome}`,
          subtitulo: `${rInfo.descricao} (Índice: ${rInfo.indiceNome})`,
          condominioNome: condNome,
          prestadorOuInquilino: c.prestador_nome,
          valorMensal: valor,
          dataReferencia: null,
          diasRestantes: null,
          acaoRecomendada:
            "Calcular variação acumulada do índice no BCB e registrar reajuste ou termo aditivo.",
          linkDestino: `/app/contratos/reajustes`,
        });
      }
    }

    // Ordena alertas: prioridade alta primeiro, depois dias restantes menores
    alertas.sort((a, b) => {
      const pesoPrio = { alta: 3, media: 2, baixa: 1 };
      if (pesoPrio[a.prioridade] !== pesoPrio[b.prioridade]) {
        return pesoPrio[b.prioridade] - pesoPrio[a.prioridade];
      }
      return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
    });

    const totalAlertasCriticos = alertas.filter((a) => a.prioridade === "alta").length;

    return {
      metricas: {
        totalContratosServicoAtivos: servicos.length,
        servicosVencidos,
        servicosVencendo30d,
        servicosVencendo60d,
        servicosVencendo90d,
        servicosReajustesPendentes,
        servicosAvisoPrevioCritico,
        totalAlertasCriticos,
      },
      alertas,
    };
  });

export const simularCalculoReajusteProativo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      valorAtual: z.number().positive(),
      mesBase: z.number().min(1).max(12),
      indiceContratual: z.string(),
      nomeParte: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sug = await calcularIndiceParaReajuste({
      indiceContratual: data.indiceContratual,
      mesBase: data.mesBase,
    });

    const taxaUsada =
      sug.acumuladoSugerido !== null && sug.acumuladoSugerido !== undefined
        ? sug.acumuladoSugerido
        : sug.acumuladoContratual ?? 0;

    const fator = 1 + taxaUsada / 100;
    const valorReajustado = round2(data.valorAtual * (fator > 0 ? fator : 1));
    const diferencaMonetaria = round2(valorReajustado - data.valorAtual);

    const nomeParte = data.nomeParte || "Prezado(a)";
    const minutaComunicado = `NOTIFICAÇÃO DE REAJUSTE CONTRATUAL ANUAL\n\nÀ atenção de: ${nomeParte}\n\nComunicamos que, em cumprimento às disposições contratuais vigentes, o valor contratual foi reajustado com base na variação acumulada do índice ${rotuloIndiceContrato(sug.indiceSugerido ?? data.indiceContratual)} (${taxaUsada >= 0 ? "+" : ""}${taxaUsada.toFixed(2)}%).\n\n- Valor anterior: R$ ${data.valorAtual.toFixed(2)}\n- Novo valor reajustado: R$ ${valorReajustado.toFixed(2)}\n- Variação apurada: R$ ${diferencaMonetaria.toFixed(2)}\n\nO novo valor passa a vigorar a partir do próximo ciclo de faturamento.\n\nAtenciosamente,\nAdministração`;

    return {
      valorAtual: data.valorAtual,
      valorReajustado,
      diferencaMonetaria,
      percentualAplicado: taxaUsada,
      indiceContratual: data.indiceContratual,
      indiceSugerido: sug.indiceSugerido,
      substituicaoPorNegativo: sug.substituicaoPorNegativo,
      janela: sug.janela,
      minutaComunicado,
    };
  });
