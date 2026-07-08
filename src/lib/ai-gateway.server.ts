import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) runId = nextRunId;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    },
  });

  return Object.assign(provider, {
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  });
}

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export type EmbeddingUsage = {
  promptTokens: number;
  totalTokens: number;
};

export async function embedTextWithUsage(
  lovableApiKey: string,
  input: string,
): Promise<{ embedding: number[]; usage: EmbeddingUsage }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": lovableApiKey,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
      dimensions: 1536,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as {
    data: Array<{ embedding: number[] }>;
    usage?: { prompt_tokens?: number; total_tokens?: number };
  };
  const promptTokens = json.usage?.prompt_tokens ?? 0;
  const totalTokens = json.usage?.total_tokens ?? promptTokens;
  return { embedding: json.data[0].embedding, usage: { promptTokens, totalTokens } };
}

export async function embedText(lovableApiKey: string, input: string): Promise<number[]> {
  const { embedding } = await embedTextWithUsage(lovableApiKey, input);
  return embedding;
}

export async function embedBatch(lovableApiKey: string, inputs: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const text of inputs) {
    out.push(await embedText(lovableApiKey, text));
  }
  return out;
}

/**
 * Gera embeddings com paralelismo controlado para evitar timeout do Worker
 * em documentos longos. Concurrency=5 por padrão (≈ 5x mais rápido que
 * sequencial, sem estourar rate-limit do provedor).
 */
export async function embedChunksParallel(
  apiKey: string,
  chunks: string[],
  concurrency = 5,
): Promise<{ embeddings: number[][]; totalTokens: number }> {
  if (chunks.length === 0) return { embeddings: [], totalTokens: 0 };
  const results: number[][] = new Array(chunks.length);
  let totalTokens = 0;
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, chunks.length) },
    async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= chunks.length) return;
        const { embedding, usage } = await embedTextWithUsage(apiKey, chunks[idx]);
        results[idx] = embedding;
        totalTokens += usage.totalTokens || usage.promptTokens || 0;
      }
    },
  );
  await Promise.all(workers);
  return { embeddings: results, totalTokens };
}