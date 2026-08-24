/**
 * Helper server-only para registrar cada chamada de IA fora do chat
 * (importação de convenção, OCR/visão, embeddings, KB, demo).
 *
 * O trigger `tg_eventos_ia_agrega` (public.eventos_ia) agrega
 * automaticamente em `uso_mensal` e `custos_cliente_mensal`, então
 * chamar `registrarEventoIa()` é suficiente para o consumo aparecer no
 * dashboard de "Usos e custos" e no financeiro admin.
 *
 * SEMPRE usa supabaseAdmin (service_role) porque a tabela `eventos_ia`
 * não tem policy de INSERT para `authenticated` — só o backend grava.
 * Falhas nunca propagam: são logadas e engolidas para não quebrar o
 * fluxo do usuário (upload de documento, importação, etc.).
 */

export type OrigemEventoIa =
  | "chat"
  | "importacao_convencao"
  | "ocr_visao_documento"
  | "ocr_visao_kb"
  | "embedding_documento"
  | "embedding_kb"
  | "demo_chat"
  | "assembleia_transcricao"
  | "assembleia_ata"
  | "assembleia_inadimplencia"
  | "assembleia_revisao_pauta"
  | "outro";

type ModelPricingCache = {
  loadedAt: number;
  rows: Map<string, { input: number; output: number }>;
};

let _pricingCache: ModelPricingCache | null = null;

async function getPricing(
  model: string,
): Promise<{ input: number; output: number } | null> {
  const now = Date.now();
  // Cache 60s para não bater no banco a cada embedding.
  if (!_pricingCache || now - _pricingCache.loadedAt > 60_000) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("model_pricing")
        .select("model, credits_per_input_token, credits_per_output_token");
      const rows = new Map<string, { input: number; output: number }>();
      for (const r of data ?? []) {
        rows.set(r.model, {
          input: Number(r.credits_per_input_token) || 0,
          output: Number(r.credits_per_output_token) || 0,
        });
      }
      _pricingCache = { loadedAt: now, rows };
    } catch (err) {
      console.error("[uso-ia] pricing lookup failed:", err);
      return null;
    }
  }
  const hit = _pricingCache.rows.get(model);
  if (hit) return hit;
  // Fallback: tenta sem/com prefixo "openai/" ou "google/"
  const semPrefixo = model.replace(/^[^/]+\//, "");
  return _pricingCache.rows.get(semPrefixo) ?? null;
}

export type RegistrarEventoIaInput = {
  userId: string | null;
  condominioId?: string | null;
  origem: OrigemEventoIa;
  model: string;
  tokensInput?: number;
  tokensOutput?: number;
  /** Se informado, sobrescreve o cálculo por model_pricing. */
  creditosOverride?: number;
  aigLogId?: string | null;
  aigRunId?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function registrarEventoIa(input: RegistrarEventoIaInput): Promise<void> {
  try {
    const tokensInput = Math.max(0, Math.round(input.tokensInput ?? 0));
    const tokensOutput = Math.max(0, Math.round(input.tokensOutput ?? 0));

    let creditos = input.creditosOverride ?? 0;
    if (!(creditos > 0)) {
      const pricing = await getPricing(input.model);
      if (pricing) {
        creditos = tokensInput * pricing.input + tokensOutput * pricing.output;
      }
    }

    // Cálculo de custo BRL usa config_alertas.credito_brl no trigger,
    // então passamos 0 aqui e deixamos o trigger converter (single source
    // of truth com o fluxo de chat).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("eventos_ia").insert({
      user_id: input.userId,
      condominio_id: input.condominioId ?? null,
      origem: input.origem,
      model: input.model,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      creditos_lovable: creditos > 0 ? creditos : 0,
      custo_brl: 0,
      aig_log_id: input.aigLogId ?? null,
      aig_run_id: input.aigRunId ?? null,
      meta: (input.meta ?? null) as never,
    });
    if (error) {
      console.error("[uso-ia] insert eventos_ia falhou:", error.message);
    }
  } catch (err) {
    console.error("[uso-ia] registrarEventoIa exception:", err);
  }
}

/**
 * Extrai o log id do gateway a partir dos headers de resposta.
 * Usado por chamadas fetch diretas ao endpoint /v1/chat/completions.
 */
export function extractAigIds(response: Response) {
  return {
    logId: response.headers.get("x-lovable-aig-log-id") ?? null,
    runId: response.headers.get("x-lovable-aig-run-id") ?? null,
  };
}