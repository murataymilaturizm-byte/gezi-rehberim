// Meta Cloud API WhatsApp utilities

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// K1: Meta gönderim için timeout + retry sabitleri.
// 15s timeout: Meta yavaşsa edge function asılı kalmasın (whatsapp-webhook total budget'ı kısıtlı).
// Tek retry: ağ flicker'ı veya 429 (rate limit) geçici → 2. denemede çoğunlukla geçer.
const META_SEND_TIMEOUT_MS = 15000;
const META_RETRY_MAX_DELAY_MS = 5000;     // Retry-After saniyesinin üst sınırı

/** AbortController ile timeout'lu fetch (Meta send için). */
async function _fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`META_TIMEOUT_${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * K1: 429 Retry-After header'ı parse. Saniye veya HTTP-date olabilir; saniye varsayıyoruz (Meta).
 * Üst sınır META_RETRY_MAX_DELAY_MS — edge function budget'ını koru.
 */
function _parseRetryAfter(header: string | null): number {
  if (!header) return 1500;
  const sec = Number(header);
  if (Number.isFinite(sec) && sec > 0) {
    return Math.min(sec * 1000, META_RETRY_MAX_DELAY_MS);
  }
  return 1500;
}

function _sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * K1: Meta webhook HMAC-SHA256 imza doğrulama
 *
 * Meta her webhook POST'unda `x-hub-signature-256: sha256=<hex>` header'ı yollar.
 * Bu imza, raw request body üzerinde APP_SECRET ile HMAC-SHA256 olarak üretilir.
 *
 * @param rawBody  Parse edilmemiş ham string body (req.text() sonucu)
 * @param signature  x-hub-signature-256 header değeri ("sha256=..." formatı)
 * @param appSecret  META_APP_SECRET env değişkeni (Facebook App Settings'de "App Secret")
 * @returns true imza geçerli, false aksi halde
 */
/**
 * Verify sonucu — sadece boolean değil, debug bilgisi de döner.
 * Sebep: signature fail olduğunda kullanıcı "secret yanlış mı, body mi bozuldu" görebilsin.
 * `secretFingerprint` PII güvenli: tam secret değil, secret'ın SHA-256'sının ilk 8 karakteri.
 */
export interface VerifyResult {
  valid: boolean;
  reason?: string;            // "MISSING_SIGNATURE" | "MISSING_SECRET" | "BAD_PREFIX" | "BAD_HEX" | "LENGTH_MISMATCH" | "HASH_MISMATCH" | "CRYPTO_ERROR"
  computedPrefix?: string;    // beklenen hash ilk 8 char (debug)
  providedPrefix?: string;    // gelen hash ilk 8 char (debug)
  bodyLength?: number;
  secretLength?: number;
  secretFingerprint?: string; // sha256(secret) ilk 8 char — secret değerini sızdırmadan "doğru mu" karşılaştır
}

/** İç hash hesabı (16-bit hex). */
async function _sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * K1: Meta webhook HMAC-SHA256 imza doğrulama (detaylı sonuç).
 *
 * @param rawBody  req.text() çıktısı — parse edilmemiş raw string
 * @param signature  x-hub-signature-256 header
 * @param appSecret  META_APP_SECRET — bu fonksiyon kendi içinde TRIM eder
 */
export async function verifyMetaSignatureDetailed(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): Promise<VerifyResult> {
  // Defansif TRIM — Supabase secrets'a yapıştırırken trailing newline/space
  // (en yaygın K1 sebebidir) silinsin. Meşru secret'ta whitespace olmaz.
  const _secret = (appSecret || '').trim();

  if (!signature) return { valid: false, reason: 'MISSING_SIGNATURE' };
  if (!_secret) return { valid: false, reason: 'MISSING_SECRET' };
  if (!signature.startsWith('sha256=')) return { valid: false, reason: 'BAD_PREFIX' };

  const provided = signature.slice('sha256='.length).trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(provided)) return { valid: false, reason: 'BAD_HEX' };

  // PII-güvenli secret fingerprint (debug log'da gözükecek — secret sızmaz)
  const secretFingerprint = (await _sha256Hex(_secret)).slice(0, 8);

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(_secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const baseDebug = {
      computedPrefix: computed.slice(0, 8),
      providedPrefix: provided.slice(0, 8),
      bodyLength: rawBody.length,
      secretLength: _secret.length,
      secretFingerprint,
    };

    if (computed.length !== provided.length) {
      return { valid: false, reason: 'LENGTH_MISMATCH', ...baseDebug };
    }
    // Timing-safe compare
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ provided.charCodeAt(i);
    }
    if (diff !== 0) {
      return { valid: false, reason: 'HASH_MISMATCH', ...baseDebug };
    }
    return { valid: true, ...baseDebug };
  } catch (e) {
    console.error('[verifyMetaSignature] crypto error:', e);
    return { valid: false, reason: 'CRYPTO_ERROR' };
  }
}

/**
 * Backward-compatible wrapper — eski caller'lar (sadece boolean bekleyen) için.
 * Yeni kullanım için verifyMetaSignatureDetailed tercih edilir.
 */
export async function verifyMetaSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): Promise<boolean> {
  const result = await verifyMetaSignatureDetailed(rawBody, signature, appSecret);
  return result.valid;
}

/**
 * Send a text message via Meta Cloud API.
 *
 * K1 hardening:
 *   - Timeout (15s) — Meta yavaşsa edge function asılı kalmasın.
 *   - 429 + 5xx için TEK retry (Retry-After header'ı respekt eder).
 *   - 4xx (401/403/404) retry edilmez — token/permission sorunu, beklemek anlamsız.
 *   - status kodu sonuca eklenir → caller log/error-sink'e geçirebilir.
 */
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string; status?: number }> {
  const normalizedTo = to.replace('whatsapp:', '').replace('+', '').trim();
  const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;
  const body = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedTo,
    type: 'text',
    text: { body: message },
  });

  const MAX_ATTEMPTS = 2;
  let lastStatus: number | undefined;
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await _fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body,
        },
        META_SEND_TIMEOUT_MS,
      );

      if (response.ok) {
        const data = await response.json();
        const messageId = data?.messages?.[0]?.id;
        return { success: true, messageId, status: response.status };
      }

      lastStatus = response.status;
      const errorText = await response.text().catch(() => '');
      lastError = errorText;
      console.error(`❌ Meta send error (attempt ${attempt}/${MAX_ATTEMPTS}):`, response.status, errorText.slice(0, 200));

      // K1: 429 (rate limit) ve 5xx (geçici) → retry. 4xx (auth/perm) → instant fail.
      const isRetryable = response.status === 429 || response.status >= 500;
      if (!isRetryable || attempt === MAX_ATTEMPTS) {
        return { success: false, error: `Meta API ${response.status}: ${errorText.slice(0, 300)}`, status: response.status };
      }

      const retryAfter = _parseRetryAfter(response.headers.get('retry-after'));
      console.warn(`[meta-send] Retrying after ${retryAfter}ms (status=${response.status})`);
      await _sleep(retryAfter);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`❌ Meta send exception (attempt ${attempt}/${MAX_ATTEMPTS}):`, lastError);

      // Timeout veya network → retry (1. denemede). Diğerinde fail.
      const isNetworkLike = lastError.includes('META_TIMEOUT') || lastError.includes('network') || lastError.includes('fetch');
      if (!isNetworkLike || attempt === MAX_ATTEMPTS) {
        return { success: false, error: lastError, status: lastStatus };
      }
      await _sleep(1000 * attempt);
    }
  }

  return { success: false, error: lastError || 'unknown', status: lastStatus };
}

/**
 * Send a template message via Meta Cloud API
 * Used when 24-hour window has passed
 */
export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string,
  components?: any[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const normalizedTo = to.replace('whatsapp:', '').replace('+', '').trim();

    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    if (components && components.length > 0) {
      body.template.components = components;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Meta WhatsApp template error:', response.status, errorText);
      return { success: false, error: `Meta API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error) {
    console.error('❌ Error sending Meta WhatsApp template:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Extract incoming message data from Meta Cloud API webhook payload
 */
export function extractMetaWebhookData(body: any): {
  from: string;
  message: string;
  messageId: string;
  isStatus: boolean;
  phoneNumberId: string;
} | null {
  try {
    if (body?.object !== 'whatsapp_business_account') {
      return null;
    }

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const phoneNumberId = value?.metadata?.phone_number_id || '';

    // Status updates - ignore
    if (value?.statuses && !value?.messages) {
      return { from: '', message: '', messageId: '', isStatus: true, phoneNumberId };
    }

    const messages = value?.messages;
    if (!messages || messages.length === 0) {
      return null;
    }

    const msg = messages[0];
    const from = msg.from || '';
    const messageId = msg.id || '';

    let message = '';
    if (msg.type === 'text') {
      message = msg.text?.body || '';
    } else if (msg.type === 'interactive') {
      if (msg.interactive?.type === 'button_reply') {
        message = msg.interactive.button_reply?.title || '';
      } else if (msg.interactive?.type === 'list_reply') {
        message = msg.interactive.list_reply?.title || '';
      }
    } else if (msg.type === 'image' || msg.type === 'document' || msg.type === 'audio' || msg.type === 'video') {
      message = msg[msg.type]?.caption || `[${msg.type}]`;
    }

    return { from, message, messageId, isStatus: false, phoneNumberId };
  } catch (error) {
    console.error('❌ Error extracting Meta webhook data:', error);
    return null;
  }
}

/**
 * Resolve agency by phone_number_id or fallback.
 *
 * L4: AMBIGUITY HANDLING
 *   - Eskiden .single() kullanılıyordu → iki kayıt eşleşirse PGRST116 patlardı,
 *     `agency` null dönerdi, bot "Agency not found" diye sessiz kalırdı (sebep belirsiz).
 *   - Şimdi multi-fetch:
 *       length === 1  → o acente
 *       length > 1   → AMBIGUOUS — logCritical + spesifik hata ("AMBIGUOUS_PHONE_NUMBER_ID")
 *                     yanlış-seçim yapılmaz; admin görünür hata alır
 *       length === 0 → mevcut fallback (single-agency env credentials)
 *   - Defense in depth: gelen phoneNumberId TRIM edilir (Meta normalde clean döner ama belt-and-suspenders).
 *
 * NOT: logCritical _shared/error-sink.ts'te tanımlı — burada dynamic import ile çağrılır,
 * çünkü tüm sender'lar (send-template-message, send-feedback-survey vb.) bu modülü kullanıyor;
 * error-sink import'unu zorunlu kılmak gereksiz coupling yaratır.
 */
export async function resolveAgencyByPhoneNumberId(
  supabase: any,
  phoneNumberId: string
): Promise<{ agency: any; error: string | null }> {
  // L4: Defansif TRIM — Meta normalde clean gönderir, ama belt-and-suspenders.
  const trimmedId = (phoneNumberId || '').trim();

  if (trimmedId) {
    const { data, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('meta_phone_number_id', trimmedId)
      .eq('active', true);

    if (error) {
      console.error('[resolveAgency] query error:', error.message);
      // Hata DB query'de — fallback'e düş
    } else if (data && data.length === 1) {
      return { agency: data[0], error: null };
    } else if (data && data.length > 1) {
      // L4: AMBIGUOUS — iki+ acente aynı phone_number_id'de.
      // .single() patlamasından farkı: sessiz yanlış seçim yapmıyoruz, spesifik hata + log.
      // UNIQUE constraint (L1) eklenince bu duruma normalde DÜŞMEMELİ — ama eski veri varsa görünür kalır.
      const ids = data.map((a: any) => a.id);
      const names = data.map((a: any) => a.name);
      console.error(`[resolveAgency] L4: AMBIGUOUS — ${data.length} agencies match phone_number_id`, {
        phoneNumberId: trimmedId,
        agencyIds: ids,
        agencyNames: names,
      });
      // Error sink (kritik görünürlük — admin sistem hatalarında görür)
      try {
        const { logCritical } = await import('./error-sink.ts');
        await logCritical({
          event: 'AMBIGUOUS_PHONE_NUMBER_ID',
          error: `${data.length} agencies match phone_number_id=${trimmedId}`,
          context: { phoneNumberId: trimmedId, agencyIds: ids, agencyNames: names },
          severity: 'critical',
        });
      } catch (_sinkErr) {
        // Sink fail etse bile console.error yukarıda var
      }
      // Sessiz yanlış-seçim YAPMA → "Agency not found" gibi davran (webhook 200 dönecek, log'da görünür).
      return { agency: null, error: 'AMBIGUOUS_PHONE_NUMBER_ID' };
    }
    // length === 0 → fallback'e düş
  }

  // Fallback: find agency that has meta_access_token or whatsapp_api_key set (single-agency setups)
  const { data: agencies } = await supabase
    .from('agencies')
    .select('*')
    .eq('active', true)
    .or('meta_access_token.not.is.null,whatsapp_api_key.not.is.null');

  if (agencies && agencies.length === 1) {
    return { agency: agencies[0], error: null };
  }

  console.error('❌ Could not resolve agency from webhook');
  return { agency: null, error: 'Agency not found' };
}

/**
 * Get Meta WhatsApp credentials - from agency or global env
 */
export function getMetaCredentials(agency: any): {
  phoneNumberId: string;
  accessToken: string;
} {
  // Agency-level credentials (future: Embedded Signup)
  if (agency.meta_phone_number_id && agency.meta_access_token) {
    return {
      phoneNumberId: agency.meta_phone_number_id,
      accessToken: agency.meta_access_token,
    };
  }

  // Global credentials from environment
  return {
    phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '',
    accessToken: Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '',
  };
}

/**
 * Subscribe app to WABA webhook events.
 * Content-Type + body + res.ok kontrolü — tam formatında.
 */
export async function subscribeAppToWaba(
  wabaId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string; httpStatus?: number }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscribed_fields: "messages,message_template_status_update",
        }),
      }
    );

    const data = await res.json();

    if (res.ok) {
      // v18.0+ bazen { success: true }, bazen sadece 200 döner — res.ok yeterli
      console.info("[subscribeAppToWaba] Success:", wabaId, JSON.stringify(data));
      return { success: true };
    } else {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      console.error("[subscribeAppToWaba] Failed:", res.status, JSON.stringify(data));
      return { success: false, error: errMsg, httpStatus: res.status };
    }
  } catch (err: any) {
    console.error("[subscribeAppToWaba] Exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * GET subscribed_apps ile gerçekten abone olup olmadığını doğrula.
 */
export async function verifyWabaSubscription(
  wabaId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`,
      { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return false;
    const data = await res.json();
    // data.data[] içinde en az 1 app varsa subscribe olmuş
    return Array.isArray(data?.data) && data.data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Retry'lı subscription — Meta propagation gecikmesi için 0/5/15s dener.
 * POST + GET verify — gerçek sonuç döner.
 */
export async function subscribeAppToWabaWithRetry(
  wabaId: string,
  accessToken: string
): Promise<boolean> {
  const delays = [0, 5000, 15000];

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }

    const result = await subscribeAppToWaba(wabaId, accessToken);

    if (result.success) {
      const verified = await verifyWabaSubscription(wabaId, accessToken);
      if (verified) {
        console.info(`[subscribeWithRetry] Confirmed on attempt ${attempt + 1} for WABA ${wabaId}`);
        return true;
      }
      console.warn(`[subscribeWithRetry] POST ok but GET verify failed (attempt ${attempt + 1})`);
    } else {
      console.warn(`[subscribeWithRetry] Attempt ${attempt + 1} failed: ${result.error}`);
    }
  }

  console.error(`[subscribeWithRetry] All ${delays.length} attempts failed for WABA ${wabaId}`);
  return false;
}
