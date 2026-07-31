// ═══════════════════════════════════════════════════════════════════════════
// GÜNLÜK KONUŞMA-KARNESİ (2026-07-31)
//
// Her gece 03:00 UTC: son 24 saatin GERÇEK konuşmalarını tarar, üç sinyali
// çıkarır ve süper-admin'e tek satır özet + detay tablosu bırakır.
//   (a) escape    — bot kaçış cümlesi kurdu (meşru yönlendirmeler DÜŞÜLÜR)
//   (b) repeat    — müşteri aynı soruyu 2+ kez sordu (>=0.8 benzerlik)
//   (c) abandoned — akış COMPLETED'a ulaşmadan >2 saat sessiz kaldı
//
// Amaç: W1–W4 sınıfı delikler gece nöbetiyle değil sistemle yakalansın.
// Bu fonksiyon HİÇBİR müşteri mesajı göndermez — salt okuma + rapor.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ESCAPE_RE, LEGIT_REDIRECTS, similarity, REPEAT_SIMILARITY,
  ABANDON_AFTER_MINUTES, ABANDON_STAGES,
} from "../shared/constants/report-patterns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const TURZZ_CENTRAL_AGENCY_ID = "11111111-1111-1111-1111-111111111111";

function isInternalCall(req: Request): boolean {
  const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET") || "";
  if (!secret) return false;
  return req.headers.get("x-internal-secret") === secret;
}

type Row = { phone: string; role: string; content: string; created_at: string; agency_id: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!isInternalCall(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const _now = Date.now();
    const _since = new Date(_now - 24 * 3600 * 1000).toISOString();
    const _reportDate = new Date(_now).toISOString().slice(0, 10);

    const { data, error } = await sb
      .from("whatsapp_conversations")
      .select("phone, role, content, created_at, agency_id")
      .gte("created_at", _since)
      .order("created_at", { ascending: true })
      .limit(20000);
    if (error) throw error;

    const rows = (data ?? []) as Row[];

    // Konuşma = (agency_id, phone)
    const convs = new Map<string, Row[]>();
    for (const r of rows) {
      const k = `${r.agency_id ?? "-"}|${r.phone}`;
      (convs.get(k) ?? convs.set(k, []).get(k)!).push(r);
    }

    const findings: Array<Record<string, unknown>> = [];
    let legitCount = 0;

    for (const [key, msgs] of convs) {
      const [agencyId, phone] = key.split("|");
      const _agency = agencyId === "-" ? null : agencyId;
      // KANAL AYRIMI: demo-chat konuşmayı sessionId ile saklıyor (harf içerir),
      // WhatsApp ise saf rakam telefon. İlk koşumda karne 99 konuşma saydı ve
      // bunların büyük kısmı benim prob trafiğimdi — kanal etiketi olmadan
      // "gerçek müşteri sinyali" ile "test gürültüsü" ayırt edilemiyordu.
      const _channel = /^\d{10,15}$/.test(phone) ? "whatsapp" : "demo";

      // ── (a) KAÇIŞ CÜMLESİ ────────────────────────────────────────────────
      for (const m of msgs) {
        if (m.role !== "assistant" || !ESCAPE_RE.test(m.content || "")) continue;
        const _legit = LEGIT_REDIRECTS.find((w) => w.re.test(m.content || ""));
        if (_legit) { legitCount++; continue; }   // meşru → sayılır, bulgu değil
        // Kaçışı TETİKLEYEN müşteri sorusu (hemen öncesi) teşhis için şart.
        const _idx = msgs.indexOf(m);
        const _q = [...msgs.slice(0, _idx)].reverse().find((x) => x.role === "user");
        findings.push({
          agency_id: _agency, phone, category: "escape",
          snippet: (m.content || "").replace(/\s+/g, " ").slice(0, 300),
          detail: { kanal: _channel, soru: (_q?.content || "").replace(/\s+/g, " ").slice(0, 200), at: m.created_at },
        });
      }

      // ── (b) TEKRAR-SORU ──────────────────────────────────────────────────
      const _userMsgs = msgs.filter((m) => m.role === "user");
      for (let i = 1; i < _userMsgs.length; i++) {
        const a = _userMsgs[i - 1].content || "", b = _userMsgs[i].content || "";
        if ((a.trim().length < 6) || (b.trim().length < 6)) continue;  // "evet/ok" gürültüsü
        const s = similarity(a, b);
        if (s >= REPEAT_SIMILARITY) {
          findings.push({
            agency_id: _agency, phone, category: "repeat",
            snippet: b.replace(/\s+/g, " ").slice(0, 300),
            detail: { kanal: _channel, onceki: a.replace(/\s+/g, " ").slice(0, 200), benzerlik: Number(s.toFixed(2)), at: _userMsgs[i].created_at },
          });
        }
      }

      // ── (c) TERK EDİLEN AKIŞ ─────────────────────────────────────────────
      const _last = msgs[msgs.length - 1];
      const _idleMin = (_now - new Date(_last.created_at).getTime()) / 60000;
      if (_idleMin >= ABANDON_AFTER_MINUTES) {
        // Aşama son 'system' satırından okunur (bot state snapshot'ı).
        let _stage: string | null = null;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role !== "system") continue;
          try { _stage = (JSON.parse(msgs[i].content) as any)?.stage ?? null; } catch { /* yoksay */ }
          break;
        }
        // COMPLETED bilerek dışarıda: after-sales sohbeti terk değildir.
        if (_stage && ABANDON_STAGES.has(_stage)) {
          const _lastUser = [...msgs].reverse().find((x) => x.role === "user");
          findings.push({
            agency_id: _agency, phone, category: "abandoned",
            snippet: (_lastUser?.content || "").replace(/\s+/g, " ").slice(0, 300),
            detail: { kanal: _channel, stage: _stage, sessiz_dk: Math.round(_idleMin), at: _last.created_at },
          });
        }
      }
    }

    if (findings.length > 0) {
      const { error: insErr } = await sb.from("conversation_daily_report")
        .insert(findings.map((f) => ({ ...f, report_date: _reportDate })));
      if (insErr) console.error("[karne] detay insert hatası:", insErr.message);
    }

    const _n = (c: string) => findings.filter((f) => f.category === c).length;
    const _counts = { escape: _n("escape"), repeat: _n("repeat"), abandoned: _n("abandoned") };
    const _waFindings = findings.filter((f: any) => (f.detail as any)?.kanal === "whatsapp").length;

    // ── Süper-admin özeti: admin_notifications'a TEK satır ────────────────
    const _title = `📋 Konuşma karnesi ${_reportDate} — kaçış:${_counts.escape} · tekrar:${_counts.repeat} · terk:${_counts.abandoned}`;
    const _desc = `${convs.size} konuşma tarandı · WhatsApp bulgusu: ${_waFindings}/${findings.length} · meşru-yönlendirme: ${legitCount}`;
    const { error: notifErr } = await sb.from("admin_notifications").insert({
      agency_id: TURZZ_CENTRAL_AGENCY_ID,
      type: "daily_report",
      title: _title,
      description: _desc,
      metadata: { ...(_counts), whatsapp_findings: _waFindings, legit_redirects: legitCount, conversations: convs.size, report_date: _reportDate },
    });
    if (notifErr) console.error("[karne] özet insert hatası:", notifErr.message);

    console.log(`[karne] ${_title} | ${_desc}`);
    return new Response(JSON.stringify({
      success: true, report_date: _reportDate,
      conversations: convs.size, ...(_counts), legit_redirects: legitCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[karne] hata:", e?.message || e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
