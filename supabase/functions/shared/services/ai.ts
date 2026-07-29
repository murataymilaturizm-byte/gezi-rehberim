// Shared AI service — demo-chat/services/ai.ts'den taşındı, logger/CONFIG bağımlılıkları kaldırıldı.
// Retry + exponential backoff + timeout ile Anthropic API çağrısı yapar.

import { logCritical } from "../../_shared/error-sink.ts";

const AI_TIMEOUT_MS = 25000;
const AI_MAX_RETRIES = 2;
const AI_MODEL = "claude-sonnet-4-5";
const AI_MAX_TOKENS = 2000;
// O1: 429 Retry-After header'ı üst sınırı (Anthropic genelde 5-30s döner; biz max 10s'a sınırlıyoruz
// çünkü edge function budget'ı sınırlı + müşteri 30s beklesin istemiyoruz).
const AI_RATE_LIMIT_MAX_DELAY_MS = 10000;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new Error("AI_TIMEOUT");
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Anthropic API'ye mesaj gönderir, string yanıt döner.
 * Sistem mesajı messages array'inde role:"system" olarak GEÇİLMEZ —
 * Anthropic'in top-level `system` alanına ayrılır (messages içinden çıkarılır).
 *
 * messages: [...history, {role:"user", content: sanitizedMessage}]
 *
 * PROMPT CACHING:
 *   systemPromptCached → STATİK büyük prefix (rol+tone+format+stage+agency+guards).
 *   Bu blok ephemeral cache_control alır; 5 dk içinde aynı prefix → input token'larda %90 indirim.
 *   systemPromptDynamic → conditional add-on'lar (tour switch warning, transition,
 *   returning user, anti-contradiction, mid-flow, off-topic, multi-tour warning).
 *   Her çağrıda farklı olabileceği için cache DIŞINDA.
 *
 *   Geriye uyumluluk: caller tek string olarak `systemPrompt` da yollayabilir — tek blok cache'lenir.
 */
export async function callAI(params: {
  systemPrompt?: string;
  systemPromptCached?: string;
  systemPromptDynamic?: string;
  history: Array<{ role: string; content: string }>;
  userMessage: string;
}): Promise<string> {
  const { systemPrompt, systemPromptCached, systemPromptDynamic, history, userMessage } = params;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  // System payload'unu cache breakpoint ile kur.
  // Eğer cached/dynamic split verilmişse: 1. blok cache hedefi, 2. blok serbest.
  // Eski tek-string `systemPrompt` yollanmışsa: bütün prompt cache'e gider.
  const cachedText = systemPromptCached ?? systemPrompt ?? "";
  const systemBlocks: any[] = [];
  if (cachedText) {
    systemBlocks.push({
      type: "text",
      text: cachedText,
      cache_control: { type: "ephemeral" },
    });
  }
  if (systemPromptDynamic && systemPromptDynamic.trim() !== "") {
    systemBlocks.push({ type: "text", text: systemPromptDynamic });
  }

  const messages = [
    ...history.filter((m) => m.role === "user" || m.role === "assistant"),
    { role: "user", content: userMessage },
  ];

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            // Prompt caching artık GA, defensive olarak beta header'ı da bırakıyoruz —
            // eski SDK/proxy katmanlarında zorunlu olabilir, varlığı sorun çıkarmaz.
            "anthropic-beta": "prompt-caching-2024-07-31",
          },
          body: JSON.stringify({
            model: AI_MODEL,
            max_tokens: AI_MAX_TOKENS,
            system: systemBlocks,
            messages,
          }),
        },
        AI_TIMEOUT_MS,
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(`[ai] HTTP ${response.status} attempt ${attempt}/${AI_MAX_RETRIES}: ${errText.slice(0, 200)}`);

        // P8-EK (2026-07-29): AI hataları BUGÜNE KADAR yalnız console.error'daydı —
        // yani DB'den görünmezdi. Canlı bot cevap üretemez hale geldiğinde
        // (bugün 6/6 fallback) kök sebebi okuyacak HİÇBİR kalıcı iz yoktu.
        // Artık system_errors'a düşüyor: status + Anthropic'in kendi hata metni.
        await logCritical({
          event: "AI_HTTP_ERROR",
          error: new Error(`Anthropic HTTP ${response.status}`),
          context: {
            status: response.status,
            attempt,
            model: AI_MODEL,
            body: errText.slice(0, 300),
          },
          severity: response.status === 429 || response.status === 529 ? "warning" : "error",
        }).catch(() => {});

        // O1: 429 (rate limit) artık retry edilebilir. Retry-After header respekt edilir.
        const isRateLimit = response.status === 429;
        const isTransient = response.status === 503 || response.status === 529;
        const isRetryable = isRateLimit || isTransient;

        lastError = new Error(
          isRateLimit ? "AI_RATE_LIMIT" :
          isTransient ? "AI_SERVICE_UNAVAILABLE" :
          `AI_HTTP_${response.status}`
        );
        if (!isRetryable || attempt === AI_MAX_RETRIES) throw lastError;

        // O1: 429 için Retry-After header'ı oku (saniye), yoksa exponential backoff.
        let waitMs = 1000 * attempt;
        if (isRateLimit) {
          const ra = response.headers.get("retry-after");
          const sec = ra ? Number(ra) : NaN;
          if (Number.isFinite(sec) && sec > 0) {
            waitMs = Math.min(sec * 1000, AI_RATE_LIMIT_MAX_DELAY_MS);
          } else {
            waitMs = Math.min(2000 * attempt, AI_RATE_LIMIT_MAX_DELAY_MS);
          }
          console.warn(`[ai] 429 rate limit — waiting ${waitMs}ms before retry (attempt ${attempt})`);
        }
        await delay(waitMs);
        continue;
      }

      const data = await response.json();
      // DEBUG: prompt caching çalıştığını doğrulamak için usage log'u.
      // İlk çağrıda cache_creation > 0, sonraki 5 dk içindeki aynı prefix → cache_read > 0.
      // Kalıcı olmamalı — verify ettikten sonra kaldırılabilir.
      if (data.usage) {
        console.log("[ai] CACHE_USAGE", {
          input: data.usage.input_tokens,
          output: data.usage.output_tokens,
          cache_creation_input_tokens: data.usage.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: data.usage.cache_read_input_tokens ?? 0,
        });
      }
      return (data.content || [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("") || "";
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("AI_UNKNOWN");
      // O1: 429 da retry edilebilir (üst blokta zaten retry yapıldı; burası catch içine düşen
      // throw'ları yakalıyor — örn. network exception). RATE_LIMIT mesajı varsa retry'a izin ver.
      const shouldRetry =
        (lastError.message.includes("AI_SERVICE_UNAVAILABLE") ||
         lastError.message === "AI_TIMEOUT" ||
         lastError.message === "AI_RATE_LIMIT") &&
        attempt < AI_MAX_RETRIES;
      if (!shouldRetry) throw lastError;
      console.warn(`[ai] Retrying after error (attempt ${attempt}):`, lastError.message);
      await delay(1000 * attempt);
    }
  }

  throw lastError || new Error("AI_UNKNOWN");
}
