// PAKET-0 Dilim-4 çift-kayıt düzeltmesi — Meta aynı wamid'i İKİ KEZ teslim eder (yavaş 200,
// ağ kopması vb.). Beklenen: whatsapp_conversations'ta TEK satır, müşteriye TEK cevap.
// Dedup sözleşmesi harness'te gerçek RPC ile aynı: UNIQUE(message_id, agency_id).
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { setupScenario, postWebhook, postRawMessage, userRows, sent, processCalls } from "./webhook_harness.ts";

const AUDIO_MSG = { type: "audio", audio: { mime_type: "audio/ogg; codecs=opus", sha256: "Yq1x2y3z==", id: "1234567890123456", voice: true } };

Deno.test("DEDUP medya (ses) — aynı wamid 2 kez → 1 satır, 1 nazik cevap", async () => {
  setupScenario({});
  await postRawMessage(AUDIO_MSG, undefined, "wamid.DUP.media");
  await postRawMessage(AUDIO_MSG, undefined, "wamid.DUP.media");
  assertEquals(userRows().length, 1, "tek satır");
  assertEquals(sent.filter((m) => m.text.includes("yalnızca yazılı mesajları")).length, 1, "tek cevap");
});

Deno.test("DEDUP kimlik bilgisi eksik acente — aynı wamid 2 kez → 1 satır", async () => {
  setupScenario({ agency: { meta_phone_number_id: null, meta_access_token: null } });
  await postWebhook("Merhaba", undefined, "wamid.DUP.nocreds");
  await postWebhook("Merhaba", undefined, "wamid.DUP.nocreds");
  assertEquals(userRows().length, 1, "tek satır");
  assertEquals(sent.length, 0, "kimlik yok → cevap yok (aynı)");
});

Deno.test("DEDUP 2000+ karakter — aynı wamid 2 kez → 1 satır, 1 'çok uzun' cevabı", async () => {
  setupScenario({});
  const long = "Merhaba, ".repeat(250) + "SON";
  await postWebhook(long, undefined, "wamid.DUP.long");
  await postWebhook(long, undefined, "wamid.DUP.long");
  assertEquals(userRows().length, 1, "tek satır");
  assertEquals(sent.filter((m) => m.text.includes("çok uzun")).length, 1, "tek cevap");
});

Deno.test("DEDUP normal akış — aynı wamid 2 kez → 1 satır, 1 işleme", async () => {
  setupScenario({});
  await postWebhook("Kapadokya turu var mı?", undefined, "wamid.DUP.normal");
  await postWebhook("Kapadokya turu var mı?", undefined, "wamid.DUP.normal");
  assertEquals(userRows().length, 1, "tek satır");
  assertEquals(processCalls.length, 1, "tek işleme (tek bot cevabı)");
});

Deno.test("DEDUP regresyon — farklı wamid'li iki mesaj → 2 satır (dedup yalnız aynı id'yi yutar)", async () => {
  setupScenario({});
  await postRawMessage(AUDIO_MSG, undefined, "wamid.A");
  await postRawMessage(AUDIO_MSG, undefined, "wamid.B");
  assertEquals(userRows().length, 2);
});
