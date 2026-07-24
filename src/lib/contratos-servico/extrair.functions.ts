import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";

// Limite proporcional ao caso de uso (contratos de serviço geralmente <5MB).
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

const inputSchema = z.object({
  fileBase64: z.string().min(1, "Arquivo vazio"),
  mimeType: z.string().min(1),
  fileName: z.string().min(1).max(300),
});

export type CamposExtraidos = {
  prestador_nome?: string | null;
  prestador_documento?: string | null;
  prestador_email?: string | null;
  prestador_telefone?: string | null;
  objeto?: string | null;
  tipo_servico_slug?: string | null;
  situacao?: "ativo" | "suspenso" | "encerrado" | null;
  terceirizacao_mao_de_obra?: boolean | null;
  data_inicio?: string | null;
  prazo_indeterminado?: boolean | null;
  data_fim?: string | null;
  renovacao_automatica?: boolean | null;
  aviso_previo_dias?: number | null;
  valor?: number | null;
  tipo_valor?: "mensal" | "global" | null;
  dia_vencimento?: number | null;
  indice_reajuste?: "igpm" | "ipca" | "inpc" | "outro" | "nenhum" | null;
  mes_base_reajuste?: number | null;
  multa_rescisoria?: string | null;
  exige_seguro_rc?: boolean | null;
  garantias?: string | null;
  foro?: string | null;
};

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function coerceOrNull<T>(v: unknown, fn: (x: unknown) => T | null): T | null {
  if (v === null || v === undefined || v === "") return null;
  try {
    return fn(v);
  } catch {
    return null;
  }
}

function sanitize(raw: unknown, tiposSlugs: Set<string>): { campos: CamposExtraidos; avisos: string[] } {
  const avisos: string[] = [];
  const r = (raw ?? {}) as Record<string, unknown>;

  const str = (k: string, max = 500) =>
    coerceOrNull(r[k], (v) => {
      const s = String(v).trim();
      return s ? s.slice(0, max) : null;
    });
  const num = (k: string) =>
    coerceOrNull(r[k], (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    });
  const int = (k: string, min: number, max: number) =>
    coerceOrNull(r[k], (v) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= min && n <= max ? n : null;
    });
  const bool = (k: string) => {
    const v = r[k];
    if (v === true || v === false) return v;
    if (v === "true") return true;
    if (v === "false") return false;
    return null;
  };
  const date = (k: string) =>
    coerceOrNull(r[k], (v) => {
      const s = String(v).trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    });
  const enumStr = <T extends string>(k: string, allowed: readonly T[]): T | null => {
    const v = r[k];
    if (typeof v !== "string") return null;
    const lower = v.trim().toLowerCase();
    const hit = allowed.find((a) => a === lower);
    return hit ?? null;
  };

  const slugRaw = typeof r.tipo_servico_slug === "string" ? r.tipo_servico_slug.trim().toLowerCase() : null;
  const slug = slugRaw && tiposSlugs.has(slugRaw) ? slugRaw : null;
  if (slugRaw && !slug) avisos.push(`Tipo de serviço "${slugRaw}" não reconhecido — selecione manualmente.`);

  return {
    campos: {
      prestador_nome: str("prestador_nome", 200),
      prestador_documento: str("prestador_documento", 30),
      prestador_email: str("prestador_email", 200),
      prestador_telefone: str("prestador_telefone", 40),
      objeto: str("objeto", 2000),
      tipo_servico_slug: slug,
      situacao: enumStr("situacao", ["ativo", "suspenso", "encerrado"] as const),
      terceirizacao_mao_de_obra: bool("terceirizacao_mao_de_obra"),
      data_inicio: date("data_inicio"),
      prazo_indeterminado: bool("prazo_indeterminado"),
      data_fim: date("data_fim"),
      renovacao_automatica: bool("renovacao_automatica"),
      aviso_previo_dias: int("aviso_previo_dias", 0, 3650),
      valor: num("valor"),
      tipo_valor: enumStr("tipo_valor", ["mensal", "global"] as const),
      dia_vencimento: int("dia_vencimento", 1, 31),
      indice_reajuste: enumStr("indice_reajuste", ["igpm", "ipca", "inpc", "outro", "nenhum"] as const),
      mes_base_reajuste: int("mes_base_reajuste", 1, 12),
      multa_rescisoria: str("multa_rescisoria", 1000),
      exige_seguro_rc: bool("exige_seguro_rc"),
      garantias: str("garantias", 1000),
      foro: str("foro", 200),
    },
    avisos,
  };
}

function buildPrompt(texto: string, tiposDisponiveis: Array<{ slug: string; nome: string }>): string {
  const tiposLista = tiposDisponiveis.map((t) => `- ${t.slug}: ${t.nome}`).join("\n");
  return `Você é um assistente jurídico. Extraia os campos do CONTRATO DE PRESTAÇÃO DE SERVIÇOS abaixo e devolva APENAS um JSON válido, sem markdown, sem comentários.

Regras:
- Se um campo não estiver claro, use null. NUNCA invente dados.
- Datas no formato aaaa-mm-dd.
- Valores numéricos em reais (ex.: 1234.56), sem "R$" nem separador de milhar.
- Booleanos: true/false.

Tipos de serviço permitidos (use o slug exato, ou null):
${tiposLista}

Campos esperados (todos opcionais, use null quando não houver):
{
  "prestador_nome": string|null,
  "prestador_documento": string|null,  // CNPJ ou CPF, só dígitos e pontuação original
  "prestador_email": string|null,
  "prestador_telefone": string|null,
  "objeto": string|null,               // resumo do objeto contratado
  "tipo_servico_slug": string|null,    // um dos slugs acima
  "situacao": "ativo"|"suspenso"|"encerrado"|null,
  "terceirizacao_mao_de_obra": boolean|null,
  "data_inicio": string|null,
  "prazo_indeterminado": boolean|null,
  "data_fim": string|null,
  "renovacao_automatica": boolean|null,
  "aviso_previo_dias": number|null,
  "valor": number|null,
  "tipo_valor": "mensal"|"global"|null,
  "dia_vencimento": number|null,       // 1..31
  "indice_reajuste": "igpm"|"ipca"|"inpc"|"outro"|"nenhum"|null,
  "mes_base_reajuste": number|null,    // 1..12
  "multa_rescisoria": string|null,
  "exige_seguro_rc": boolean|null,
  "garantias": string|null,
  "foro": string|null
}

CONTRATO:
"""
${texto.slice(0, 60_000)}
"""`;
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error("Resposta da IA não é um JSON válido");
  }
}

export const extrairContratoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => inputSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);

    const mime = data.mimeType.toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) {
      throw new Error("Formato não suportado. Envie PDF, DOCX, TXT, JPG, PNG ou WEBP.");
    }

    const bytes = base64ToBytes(data.fileBase64);
    if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error(`Arquivo grande demais (máx. ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`);
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Serviço de IA indisponível no momento.");

    // 1) Extração de texto (com fallback para visão/OCR)
    const { extractText, extractTextWithVision } = await import("@/lib/documentos.server");
    let texto = "";
    try {
      texto = await extractText(bytes, data.fileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "__NEEDS_VISION__" || /image|imagem|scan/i.test(msg)) {
        try {
          texto = await extractTextWithVision(apiKey, bytes, data.fileName);
        } catch (visErr) {
          throw new Error(
            visErr instanceof Error
              ? `Falha ao ler o documento: ${visErr.message}`
              : "Falha ao ler o documento.",
          );
        }
      } else {
        throw new Error(msg || "Falha ao ler o documento.");
      }
    }

    if (!texto || texto.trim().length < 40) {
      throw new Error("Não foi possível extrair texto suficiente do contrato. Envie um arquivo com mais qualidade.");
    }

    // 2) Lista de tipos de serviço para constranger o slug retornado
    const { data: tiposRows, error: tiposErr } = await context.supabase
      .from("tipos_servico_contrato")
      .select("id, slug, nome")
      .eq("ativo", true);
    if (tiposErr) throw new Error(tiposErr.message);
    const tipos = (tiposRows ?? []) as Array<{ id: string; slug: string; nome: string }>;
    const tiposSlugs = new Set(tipos.map((t) => t.slug));

    // 3) Chamada de IA pedindo JSON estrito
    const prompt = buildPrompt(texto, tipos);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você extrai campos estruturados de contratos jurídicos em português. Responda APENAS com um objeto JSON válido.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Limite temporário da IA atingido. Aguarde alguns instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Recarregue para continuar.");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Falha na extração (${res.status}). ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) throw new Error("A IA não retornou dados.");

    let parsed: unknown;
    try {
      parsed = parseJsonLoose(content);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Resposta da IA inválida.");
    }

    const { campos, avisos } = sanitize(parsed, tiposSlugs);

    // Resolve slug -> id (o form usa tipo_servico_id)
    const tipoServicoId =
      campos.tipo_servico_slug ? tipos.find((t) => t.slug === campos.tipo_servico_slug)?.id ?? null : null;

    // Coerência: prazo_indeterminado => data_fim null
    if (campos.prazo_indeterminado) campos.data_fim = null;

    return {
      campos,
      tipo_servico_id: tipoServicoId,
      avisos,
      tamanhoTexto: texto.length,
    };
  });

// Silence unused import warning in some tsgo modes
void z;