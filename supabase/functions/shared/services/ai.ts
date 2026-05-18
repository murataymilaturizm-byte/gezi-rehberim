// Shared AI service — demo-chat/services/ai.ts'den taşındı, logger/CONFIG bağımlılıkları kaldırıldı.
// Retry + exponential backoff + timeout ile Anthropic API çağrısı yapar.

const AI_TIMEOUT_MS = 25000;
const AI_MAX_RETRIES = 2;
const AI_MODEL = "claude-sonnet-4-5";
const AI_MAX_TOKENS = 2000;

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
 * systemPrompt: buildSystemPrompt(...) çıktısı
 */
export async function callAI(params: {
  systemPrompt: string;
  history: Array<{ role: string; content: string }>;
  userMessage: string;
}): Promise<string> {
  const { systemPrompt, history, userMessage } = params;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

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
          },
          body: JSON.stringify({
            model: AI_MODEL,
            max_tokens: AI_MAX_TOKENS,
            system: systemPrompt,
            messages,
          }),
        },
        AI_TIMEOUT_MS,
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(`[ai] HTTP ${response.status} attempt ${attempt}/${AI_MAX_RETRIES}: ${errText.slice(0, 200)}`);

        const isTransient = response.status === 503 || response.status === 529;
        lastError = new Error(
          response.status === 429 ? "AI_RATE_LIMIT" :
          isTransient ? "AI_SERVICE_UNAVAILABLE" :
          `AI_HTTP_${response.status}`
        );
        if (!isTransient || attempt === AI_MAX_RETRIES) throw lastError;
        await delay(1000 * attempt);
        continue;
      }

      const data = await response.json();
      return (data.content || [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("") || "";
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("AI_UNKNOWN");
      const shouldRetry =
        (lastError.message.includes("AI_SERVICE_UNAVAILABLE") || lastError.message === "AI_TIMEOUT") &&
        attempt < AI_MAX_RETRIES;
      if (!shouldRetry) throw lastError;
      console.warn(`[ai] Retrying after error (attempt ${attempt}):`, lastError.message);
      await delay(1000 * attempt);
    }
  }

  throw lastError || new Error("AI_UNKNOWN");
}
