/**
 * Rate Limiting e Concurrency Guard com Sliding Window Token Bucket em memória
 * para proteção do /api/chat e endpoints de IA contra abusos, rajadas e corridas.
 */

export interface RateLimitConfig {
  /** Nome descritivo da regra / rota */
  name: string;
  /** Janela de tempo em milissegundos */
  windowMs: number;
  /** Número máximo de requisições permitidas na janela */
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
  reason?: string;
}

interface WindowBucket {
  timestamps: number[];
  lastUpdated: number;
}

// Armazenamento em memória dos buckets por chave
const memoryBuckets = new Map<string, WindowBucket>();
// Armazenamento em memória de travas ativas de concorrência (ex: 1 geração por conversa)
const concurrencyLocks = new Map<string, { acquiredAt: number; expiresAt: number }>();

// Limpeza automática periódica a cada 5 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function purgeExpiredBuckets(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  // Limpa buckets com mais de 10 minutos sem atividade
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (now - bucket.lastUpdated > 10 * 60 * 1000) {
      memoryBuckets.delete(key);
    }
  }

  // Limpa travas de concorrência expiradas
  for (const [key, lock] of concurrencyLocks.entries()) {
    if (now >= lock.expiresAt) {
      concurrencyLocks.delete(key);
    }
  }
}

/**
 * Avalia se uma requisição é permitida com base em Sliding Window de timestamps.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  purgeExpiredBuckets();

  const now = Date.now();
  const windowStart = now - config.windowMs;

  let bucket = memoryBuckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [], lastUpdated: now };
    memoryBuckets.set(key, bucket);
  }

  // Remove timestamps fora da janela deslizante atual
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);
  bucket.lastUpdated = now;

  const currentCount = bucket.timestamps.length;
  const limit = config.maxRequests;

  if (currentCount >= limit) {
    // Calcula tempo até o timestamp mais antigo expirar
    const oldest = bucket.timestamps[0] || now;
    const resetMs = Math.max(0, oldest + config.windowMs - now);
    const retryAfterSec = Math.max(1, Math.ceil(resetMs / 1000));

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetMs,
      retryAfterSec,
      reason: `Limite de taxa (${config.name}) excedido.`,
    };
  }

  // Registra a requisição atual
  bucket.timestamps.push(now);
  const remaining = Math.max(0, limit - bucket.timestamps.length);
  const resetMs = config.windowMs;
  const retryAfterSec = 0;

  return {
    allowed: true,
    limit,
    remaining,
    resetMs,
    retryAfterSec,
  };
}

/**
 * Tenta adquirir uma trava de concorrência exclusiva (ex: para evitar que o
 * mesmo usuário dispare 5 requisições de chat em paralelo na mesma conversa).
 * @param key Chave identificadora (ex: chat_lock:conversaId)
 * @param ttlMs Tempo máximo de vida da trava (padrão 45s para streaming de IA)
 */
export function acquireConcurrencyLock(key: string, ttlMs = 45000): boolean {
  purgeExpiredBuckets();
  const now = Date.now();
  const existing = concurrencyLocks.get(key);

  if (existing && now < existing.expiresAt) {
    return false; // Trava ainda ativa
  }

  concurrencyLocks.set(key, {
    acquiredAt: now,
    expiresAt: now + ttlMs,
  });
  return true;
}

/**
 * Libera uma trava de concorrência após a conclusão ou erro do streaming.
 */
export function releaseConcurrencyLock(key: string): void {
  concurrencyLocks.delete(key);
}

/**
 * Regras padrão de proteção para o endpoint /api/chat:
 * 1. Concorrência: máx 1 geração ativa por conversa ao mesmo tempo.
 * 2. Rajada (Burst): máx 6 requisições em 10 segundos por usuário.
 * 3. Janela Média: máx 25 requisições por minuto por usuário.
 */
export interface ChatRateLimitDecision {
  allowed: boolean;
  status: number;
  message?: string;
  headers: Record<string, string>;
  lockKey?: string;
}

export function rateLimitChat(params: {
  userId: string;
  conversaId: string;
  clientIp: string;
  bypass: boolean;
}): ChatRateLimitDecision {
  const { userId, conversaId, clientIp, bypass } = params;

  // Administradores e contas cortesia não sofrem throttling
  if (bypass) {
    return {
      allowed: true,
      status: 200,
      headers: {
        "X-RateLimit-Bypass": "true",
      },
    };
  }

  const lockKey = `chat_lock:${conversaId}`;

  // 1. Verificação de concorrência ativa na conversa
  const lockAcquired = acquireConcurrencyLock(lockKey, 45000);
  if (!lockAcquired) {
    return {
      allowed: false,
      status: 429,
      message:
        "Uma resposta já está sendo gerada para esta conversa. Por favor, aguarde alguns instantes antes de enviar outra mensagem.",
      headers: {
        "Retry-After": "3",
        "X-RateLimit-Reason": "concurrency_lock",
      },
    };
  }

  // 2. Verificação de rajada por Usuário (burst: 6 reqs / 10 seg)
  const burstCheck = checkRateLimit(`chat_burst:${userId}`, {
    name: "Chat Burst",
    windowMs: 10 * 1000,
    maxRequests: 6,
  });

  if (!burstCheck.allowed) {
    releaseConcurrencyLock(lockKey);
    return {
      allowed: false,
      status: 429,
      message:
        "Muitas mensagens enviadas rapidamente. Por favor, aguarde alguns segundos.",
      headers: {
        "Retry-After": String(burstCheck.retryAfterSec),
        "X-RateLimit-Limit": String(burstCheck.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(burstCheck.retryAfterSec),
        "X-RateLimit-Reason": "burst_limit",
      },
    };
  }

  // 3. Verificação de janela média por Usuário (25 reqs / 60 seg)
  const sustainedCheck = checkRateLimit(`chat_sustained:${userId}`, {
    name: "Chat Sustained",
    windowMs: 60 * 1000,
    maxRequests: 25,
  });

  if (!sustainedCheck.allowed) {
    releaseConcurrencyLock(lockKey);
    return {
      allowed: false,
      status: 429,
      message:
        "Limite de requisições por minuto atingido. Por favor, aguarde para continuar.",
      headers: {
        "Retry-After": String(sustainedCheck.retryAfterSec),
        "X-RateLimit-Limit": String(sustainedCheck.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(sustainedCheck.retryAfterSec),
        "X-RateLimit-Reason": "sustained_limit",
      },
    };
  }

  // 4. Verificação de IP (prevenção contra scripts anônimos/ataques distribuídos)
  if (clientIp && clientIp !== "0.0.0.0") {
    const ipCheck = checkRateLimit(`chat_ip:${clientIp}`, {
      name: "Chat IP",
      windowMs: 60 * 1000,
      maxRequests: 40,
    });
    if (!ipCheck.allowed) {
      releaseConcurrencyLock(lockKey);
      return {
        allowed: false,
        status: 429,
        message: "Muitas requisições originadas do mesmo endereço de rede.",
        headers: {
          "Retry-After": String(ipCheck.retryAfterSec),
          "X-RateLimit-Reason": "ip_limit",
        },
      };
    }
  }

  return {
    allowed: true,
    status: 200,
    lockKey,
    headers: {
      "X-RateLimit-Limit": String(sustainedCheck.limit),
      "X-RateLimit-Remaining": String(sustainedCheck.remaining),
      "X-RateLimit-Reset": String(Math.ceil(sustainedCheck.resetMs / 1000)),
    },
  };
}
