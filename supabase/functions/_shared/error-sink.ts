// K3: Merkezi kritik hata kaydı.
// Console log'a ek olarak system_errors tablosuna INSERT atar → admin panelinde görünür hale gelir.
// PII (telefon/email/isim/mesaj içeriği) maskelenmiş şekilde context'e yazılır (K6 uyumlu).
//
// Sentry/LogRocket değil — minimum görünürlük: launch için yeterli. Sonradan APM eklenirse
// bu helper'ı APM SDK'sına yönlendirmek tek satır iş.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// PII helper'ı shared/utils/log-mask.ts içinde — Deno relative import.
// Bu dosya supabase/functions/_shared/ altında, hedef shared/utils/ — iki seviye yukarı.
import { maskPII } from "../shared/utils/log-mask.ts";

// Önemli olay seviyeleri. system_errors.severity sütununda aynı isimlerle kaydedilir.
export type ErrorSeverity = "critical" | "error" | "warning";

export interface LogCriticalInput {
  /** Olay anahtarı (ör. "META_SEND_FAIL", "LS_HANDLER_ERROR", "AI_FATAL"). Tablo filtrelemede kullanılır. */
  event: string;
  /** Throw edilen Error veya string. */
  error: unknown;
  /** İlgili nesneler (agency_id, phone, status code, vb). PII maskeleme otomatik uygulanır. */
  context?: Record<string, any>;
  /** Default "error". */
  severity?: ErrorSeverity;
  /** Bilinen agency_id varsa ayrı kolona da yazılır (RLS / filtreleme için). */
  agencyId?: string | null;
}

// Service-role client (RLS bypass) — tek instance.
let _svc: ReturnType<typeof createClient> | null = null;
function _getServiceClient(): ReturnType<typeof createClient> | null {
  if (_svc) return _svc;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _svc = createClient(url, key);
  return _svc;
}

/**
 * Kritik hatayı kaydet. Asla throw etmez — kaydetme başarısız olsa bile
 * çağıran fonksiyon akışı bozulmasın (defansif).
 *
 * Kullanım:
 *   await logCritical({
 *     event: "META_SEND_FAIL",
 *     error: new Error(`status=${status}`),
 *     context: { phone: userPhone, status, errorBody },
 *     agencyId: agency.id,
 *   });
 */
export async function logCritical(input: LogCriticalInput): Promise<void> {
  const _sev: ErrorSeverity = input.severity ?? "error";
  const _errMsg = input.error instanceof Error ? input.error.message : String(input.error ?? "(unknown)");
  const _errStack = input.error instanceof Error ? (input.error.stack || null) : null;
  // Context'i PII-mask'le. Bilinmeyen anahtarlar olduğu gibi kalır.
  const _maskedCtx = input.context ? maskPII(input.context) : {};

  // Console önce — DB INSERT fail etse bile log'da kalır.
  console.error(`[critical] ${input.event}`, { error: _errMsg, ..._maskedCtx });

  try {
    const sb = _getServiceClient();
    if (!sb) return; // Service role yok → sadece console'a kaldık.
    await sb.from("system_errors").insert({
      event:         input.event,
      severity:      _sev,
      error_message: _errMsg.slice(0, 2000), // Aşırı uzun mesajlar kesilsin
      error_stack:   _errStack ? _errStack.slice(0, 4000) : null,
      context:       _maskedCtx,
      agency_id:     input.agencyId ?? null,
    });
  } catch (e) {
    // Sink fail etmemeli — log'a düşür, akışı kesme.
    console.error("[error-sink] insert failed (non-fatal):", e instanceof Error ? e.message : String(e));
  }
}
