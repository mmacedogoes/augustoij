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
  tipoModulo: "servico" | "locacao";
  tipoAlerta:
    | "vencido"
    | "vencendo_30d"
    | "vencendo_60d"
    | "vencendo_90d"
    | "reajuste_devido"
    | "aviso_previo_critico"
    | "pagamento_atrasado";
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
    totalContratosLocacaoAtivos: number;
    locacoesVencendo90d: number;
    locacoesReajustesDevidos: number;
    locacoesPagamentosAtrasados: number;
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

    // 2. Contratos de Locação (Administração de Imóveis - SuperAdmin)
    let totalLocacoesAtivas = 0;
    let locacoesVencendo90d = 0;
    let locacoesReajustesDevidos = 0;
    let locacoesPagamentosAtrasados = 0;

    if (isSuper) {
      const hoje = new Date();
      const hojeIso = hoje.toISOString().slice(0, 10);

      const [
        { data: locacoesRows },
        { data: pagamentosAtrasadosRows },
        { data: reajustesLocacaoRows },
      ] = await Promise.all([
        supabaseAdmin
          .from("contratos_locacao")
          .select(
            "id, inquilino_nome, valor_aluguel, data_inicio_vigencia, prazo_meses, mes_base_reajuste, periodicidade_reajuste_meses, indice_reajuste, status, imoveis(edificio, numero_unidade, endereco)",
          )
          .eq("owner_admin_id", userId)
          .eq("status", "ativo"),
        supabaseAdmin
          .from("pagamentos")
          .select("id, tipo, valor, vencimento, competencia, contrato_locacao_id, contratos_locacao(inquilino_nome)")
          .eq("owner_admin_id", userId)
          .eq("pago", false)
          .lt("vencimento", hojeIso),
        supabaseAdmin
          .from("reajustes")
          .select("contrato_locacao_id, data")
          .eq("owner_admin_id", userId)
          .order("data", { ascending: false }),
      ]);

      const locacoes = locacoesRows ?? [];
      totalLocacoesAtivas = locacoes.length;

      const ultimoReajusteLoc = new Map<string, string>();
      for (const r of reajustesLocacaoRows ?? []) {
        if (!ultimoReajusteLoc.has(r.contrato_locacao_id)) {
          ultimoReajusteLoc.set(r.contrato_locacao_id, r.data);
        }
      }

      for (const loc of locacoes) {
        const imovelInfo = loc.imoveis as unknown as { edificio: string | null; numero_unidade: string | null; endereco: string | null } | null;
        const imovelDesc = [imovelInfo?.edificio, imovelInfo?.numero_unidade ? `Apto ${imovelInfo.numero_unidade}` : null]
          .filter(Boolean)
          .join(" - ") || imovelInfo?.endereco || "Imóvel Locado";

        // Término de locação
        if (loc.data_inicio_vigencia && loc.prazo_meses) {
          const inicio = new Date(loc.data_inicio_vigencia + "T00:00:00Z");
          const fim = new Date(inicio);
          fim.setUTCMonth(fim.getUTCMonth() + loc.prazo_meses);
          const dias = Math.floor((fim.getTime() - hoje.getTime()) / 86400000);

          if (dias <= 90) {
            locacoesVencendo90d++;
            const prioridade: PrioridadeAlerta = dias <= 30 ? "alta" : "media";
            alertas.push({
              id: `loc-venc-${loc.id}`,
              contratoId: loc.id,
              tipoModulo: "locacao",
              tipoAlerta: dias < 0 ? "vencido" : dias <= 30 ? "vencendo_30d" : "vencendo_90d",
              prioridade,
              titulo: `Locação Terminando — ${loc.inquilino_nome ?? "Inquilino"}`,
              subtitulo: `${imovelDesc} • Término em ${dias < 0 ? `atraso de ${Math.abs(dias)}d` : `${dias} dias`} (${fim.toISOString().slice(0, 10)})`,
              condominioNome: imovelDesc,
              prestadorOuInquilino: loc.inquilino_nome ?? "Inquilino",
              valorMensal: loc.valor_aluguel ? Number(loc.valor_aluguel) : null,
              dataReferencia: fim.toISOString().slice(0, 10),
              diasRestantes: dias,
              acaoRecomendada: "Gerar termo aditivo de renovação ou vistoria de entrega das chaves.",
              linkDestino: `/app/admin/imoveis/locacao/${loc.id}`,
            });
          }
        }

        // Reajuste de locação
        const base = ultimoReajusteLoc.get(loc.id) ?? loc.data_inicio_vigencia;
        const periodicidade = loc.periodicidade_reajuste_meses ?? 12;
        if (base) {
          const dBase = new Date(base + "T00:00:00Z");
          dBase.setUTCMonth(dBase.getUTCMonth() + periodicidade);
          const diasRea = Math.floor((dBase.getTime() - hoje.getTime()) / 86400000);
          if (diasRea <= 30) {
            locacoesReajustesDevidos++;
            const proxIso = dBase.toISOString().slice(0, 10);
            alertas.push({
              id: `loc-reaj-${loc.id}`,
              contratoId: loc.id,
              tipoModulo: "locacao",
              tipoAlerta: "reajuste_devido",
              prioridade: diasRea <= 0 ? "alta" : "media",
              titulo: `Reajuste Anual de Aluguel — ${loc.inquilino_nome ?? "Inquilino"}`,
              subtitulo: `${imovelDesc} • Data-base ${diasRea < 0 ? `vencida há ${Math.abs(diasRea)} dias` : `em ${diasRea} dias`} (${proxIso})`,
              condominioNome: imovelDesc,
              prestadorOuInquilino: loc.inquilino_nome ?? "Inquilino",
              valorMensal: loc.valor_aluguel ? Number(loc.valor_aluguel) : null,
              dataReferencia: proxIso,
              diasRestantes: diasRea,
              acaoRecomendada: `Calcular reajuste pelo ${loc.indice_reajuste || "IGP-M/IPCA"} e enviar notificação ao locatário.`,
              linkDestino: `/app/admin/imoveis/locacao/${loc.id}`,
            });
          }
        }
      }

      // Pagamentos em atraso
      for (const p of pagamentosAtrasadosRows ?? []) {
        locacoesPagamentosAtrasados++;
        const cLoc = p.contratos_locacao as unknown as { inquilino_nome: string | null } | null;
        alertas.push({
          id: `loc-pgto-${p.id}`,
          contratoId: p.contrato_locacao_id,
          tipoModulo: "locacao",
          tipoAlerta: "pagamento_atrasado",
          prioridade: "alta",
          titulo: `${p.tipo.toUpperCase()} Atrasado — ${cLoc?.inquilino_nome ?? "Inquilino"}`,
          subtitulo: `Competência ${p.competencia} • Vencimento ${p.vencimento} • R$ ${Number(p.valor ?? 0).toFixed(2)}`,
          condominioNome: "Locação de Imóvel",
          prestadorOuInquilino: cLoc?.inquilino_nome ?? "Inquilino",
          valorMensal: Number(p.valor ?? 0),
          dataReferencia: p.vencimento,
          diasRestantes: Math.floor((new Date(p.vencimento).getTime() - hoje.getTime()) / 86400000),
          acaoRecomendada: "Cobrar locatário com aplicação de multa e juros contratuais.",
          linkDestino: `/app/admin/imoveis/locacao/${p.contrato_locacao_id}`,
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
        totalContratosLocacaoAtivos: totalLocacoesAtivas,
        locacoesVencendo90d,
        locacoesReajustesDevidos,
        locacoesPagamentosAtrasados,
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
