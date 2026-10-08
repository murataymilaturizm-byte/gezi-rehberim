// PAKET-0 Dilim-4 — Dilim-3 §5'teki 5 "mesaj kaydedilmiyor" yolu + §10.4 (limit → quota_exceeded).
// GERÇEK webhook giriş kodu; Meta payload → whatsapp_conversations satırı.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { setupScenario, postWebhook, postRawMessage, userRows, sysRows, sent, processCalls, criticalLog } from "./webhook_harness.ts";

// Gerçek Meta Cloud API ses-mesajı (voice note) şekli.
const AUDIO_MSG = { type: "audio", audio: { mime_type: "audio/ogg; codecs=opus", sha256: "Yq1x2y3z==", id: "1234567890123456", voice: true } };
const POLITE = "yalnızca yazılı mesajları";

Deno.test("D4-1 desteklenmeyen tip (ses, gerçek Meta audio payload) → [ses mesajı] + unsupported_media + media_id; nazik cevap aynı", async () => {
  setupScenario({});
  const r = await postRawMessage(AUDIO_MSG);
  assertEquals(r.status, 200);
  assertEquals(sent.filter((m) => m.text.includes(POLITE)).length, 1, "müşteriye giden nazik cevap DEĞİŞMEZ");
  const rows = userRows();
  assertEquals(rows.length, 1, "ses mesajı role=user kaydedilmeli");
  assertEquals(rows[0].content, "[ses mesajı]");
  assertEquals(rows[0].metadata?.dropped_reason, "unsupported_media");
  assertEquals(rows[0].metadata?.media_type, "audio");
  assertEquals(rows[0].metadata?.media_id, "1234567890123456");
  assertEquals(processCalls.length, 0);
});

Deno.test("D4-1b diğer medya tipleri yer tutucuları (görsel/video/belge/konum/sticker) — caption'sız", async () => {
  const cases: Array<[Record<string, unknown>, string, string]> = [
    [{ type: "image", image: { mime_type: "image/jpeg", sha256: "x", id: "IMG1" } }, "[görsel]", "image"],
    [{ type: "video", video: { mime_type: "video/mp4", sha256: "x", id: "VID1" } }, "[video]", "video"],
    [{ type: "document", document: { mime_type: "application/pdf", sha256: "x", id: "DOC1", filename: "pasaport.pdf" } }, "[belge]", "document"],
    [{ type: "location", location: { latitude: 38.4, longitude: 27.1, name: "İzmir" } }, "[konum]", "location"],
    [{ type: "sticker", sticker: { mime_type: "image/webp", sha256: "x", id: "STK1", animated: false } }, "[çıkartma]", "sticker"],
  ];
  for (const [msg, placeholder, mt] of cases) {
    setupScenario({});
    await postRawMessage(msg);
    const rows = userRows();
    assertEquals(rows.length, 1, `${mt} kaydedilmeli`);
    assertEquals(rows[0].content, placeholder);
    assertEquals(rows[0].metadata?.dropped_reason, "unsupported_media");
    assertEquals(rows[0].metadata?.media_type, mt);
  }
});

Deno.test("D4-2 bağlantı bilgisi eksik acente (tespit edildi) → agency_not_configured satırı", async () => {
  setupScenario({ agency: { meta_phone_number_id: null, meta_access_token: null } });
  const r = await postWebhook("Merhaba, tur bilgisi alabilir miyim?");
  assertEquals(r.status, 200);
  const rows = userRows();
  assertEquals(rows.length, 1);
  assertEquals(rows[0].content, "Merhaba, tur bilgisi alabilir miyim?");
  assertEquals(rows[0].metadata?.dropped_reason, "agency_not_configured");
  assertEquals(sent.length, 0, "kimlik bilgisi yok → müşteriye mesaj gidemez (aynı)");
});

Deno.test("D4-2b acente tespit edilemedi → satır YOK (yazılacak yer yok), logCritical", async () => {
  setupScenario({ agencyNotFound: true });
  const r = await postWebhook("Merhaba");
  assertEquals(r.status, 200);
  assertEquals(userRows().length, 0);
  assert(criticalLog.some((c) => /AGENCY_NOT_FOUND/.test(c.event)), `logCritical (kayıtlar: ${criticalLog.map((c) => c.event).join(",") || "yok"})`);
});

Deno.test("D4-3 2000+ karakter → metnin TAMAMI kaydedilir + message_too_long; müşteri cevabı aynı", async () => {
  setupScenario({});
  const long = "Merhaba, ".repeat(250) + "SON";   // 2253 karakter
  assert(long.length > 2000);
  const r = await postWebhook(long);
  assertEquals(r.status, 200);
  const rows = userRows();
  assertEquals(rows.length, 1);
  assertEquals(rows[0].content.length, long.length, "kırpılmadan TAMAMI");
  assert(rows[0].content.endsWith("SON"));
  assertEquals(rows[0].metadata?.dropped_reason, "message_too_long");
  assertEquals(sent.filter((m) => m.text.includes("çok uzun")).length, 1);
  assertEquals(processCalls.length, 0, "işlenmiyor (dropped_reason bu yüzden var)");
});

Deno.test("D4-4 rate limit allowed=false → rate_limited satırı; 'çok hızlı' cevabı aynı", async () => {
  setupScenario({ rateLimit: { data: { allowed: false }, error: null } });
  const r = await postWebhook("Fiyat?");
  assertEquals(r.status, 200);
  const rows = userRows();
  assertEquals(rows.length, 1);
  assertEquals(rows[0].metadata?.dropped_reason, "rate_limited");
  assertEquals(sent.filter((m) => m.text.includes("Çok hızlı mesaj")).length, 1);
  assertEquals(processCalls.length, 0);
});

Deno.test("D4-5 tur verisi yüklenemedi → tours_unavailable satırı + logCritical; müşteri cevabı aynı", async () => {
  // Önbelleksiz acente id'si (getCachedTours modül-içi önbelleği başka testlerden dolu olmasın).
  setupScenario({ agency: { id: "ag-tours-down" }, toursDown: true });
  const r = await postWebhook("Kapadokya turu var mı?");
  assertEquals(r.status, 200);
  const rows = userRows();
  assertEquals(rows.length, 1);
  assertEquals(rows[0].metadata?.dropped_reason, "tours_unavailable");
  assert(criticalLog.some((c) => /TOURS_UNAVAILABLE/.test(c.event)), `logCritical (kayıtlar: ${criticalLog.map((c) => c.event).join(",") || "yok"})`);
  assertEquals(sent.filter((m) => m.text.includes("tur bilgilerini şu an yükleyemedim")).length, 1);
  assertEquals(processCalls.length, 0);
});

Deno.test("D4-§10.4 limit dolu → müşteri + [unavailable] satırı quota_exceeded", async () => {
  setupScenario({ planLimit: 10, agency: { monthly_message_count: 10 } });
  await postWebhook("Merhaba");
  assertEquals(userRows()[0].metadata?.dropped_reason, "quota_exceeded");
  assertEquals(sysRows()[0].metadata?.dropped_reason, "quota_exceeded");
});
