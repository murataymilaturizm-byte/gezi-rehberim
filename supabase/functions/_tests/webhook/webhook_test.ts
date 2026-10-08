// PAKET-0 Dilim-3 — F1 (limit/abonelik dalında müşteri mesajı kayboluyordu) +
// F2 (rate-limit RPC hatasında mesaj sessizce düşüyordu) + :426 (.catch'siz insert).
// GERÇEK webhook giriş kodu; Meta payload → DB satırı / gönderilen mesaj / logCritical.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { setupScenario, postWebhook, userRows, sysRows, sent, processCalls, criticalLog } from "./webhook_harness.ts";

const NOTICE = "geçici olarak kullanılamıyor";   // K2 7-dil bildiriminin TR metni (değişmedi)
const TECH_ERR = "teknik bir sorun";              // dış catch'in genel hata mesajı
const notices = () => sent.filter((m) => m.text.includes(NOTICE)).length;

for (const [label, scen, reason] of [
  ["aylık mesaj limiti dolu", { planLimit: 10, agency: { monthly_message_count: 10 } }, "quota_exceeded"],   // Dilim-3 §10.4 kararı: panelin okuduğu ad
  ["abonelik pasif (expired)", { agency: { subscription_status: "expired" } }, "subscription_expired"],   // panelin okuduğu eski ad (karar 2)
] as const) {
  Deno.test(`F1 ${label}: her mesaj role=user + dropped_reason=${reason} kaydedilir; bildirim 24 saatte 1`, async () => {
    setupScenario(scen as any);
    const r1 = await postWebhook("Merhaba, Kapadokya turu var mı?");
    assertEquals(r1.status, 200);
    let rows = userRows();
    assertEquals(rows.length, 1, "1. mesaj whatsapp_conversations'a role=user yazılmalı");
    assertEquals(rows[0].content, "Merhaba, Kapadokya turu var mı?");
    assertEquals(rows[0].metadata?.dropped_reason, reason);
    assertEquals(notices(), 1, "ilk mesajda müşteriye bildirim gider");
    // Karar 2: müşteri satırı ve [unavailable] satırı AYNI sebep adını yazar (tek sabit).
    const sys = sysRows();
    assertEquals(sys.length, 1, "[unavailable] soğuma satırı yazılmalı");
    assertEquals(sys[0].metadata?.dropped_reason, reason, "system satırı da aynı ad");
    assertEquals(sent.filter((m) => m.text.includes(TECH_ERR)).length, 0, "ek 'teknik sorun' mesajı GİTMEMELİ");
    assertEquals(processCalls.length, 0, "bot işlemez");

    const r2 = await postWebhook("Fiyat nedir?");
    assertEquals(r2.status, 200);
    rows = userRows();
    assertEquals(rows.length, 2, "2. mesaj da kaydedilmeli");
    assertEquals(rows[1].metadata?.dropped_reason, reason);
    assertEquals(notices(), 1, "24 saat içindeki 2. mesajda bildirim GİTMEMELİ");
  });
}

Deno.test("F1/:426 [unavailable] insert hata verince logCritical + 200, teknik-hata mesajı yok", async () => {
  setupScenario({ planLimit: 10, agency: { monthly_message_count: 10 }, unavailableInsertFails: true });
  const r = await postWebhook("Merhaba");
  assertEquals(r.status, 200);
  assert(criticalLog.some((c) => /UNAVAILABLE/.test(c.event)), `logCritical çağrılmalı (kayıtlar: ${criticalLog.map((c) => c.event).join(",") || "yok"})`);
  assertEquals(sent.filter((m) => m.text.includes(TECH_ERR)).length, 0, "dış catch'e düşmemeli");
  assertEquals(userRows().length, 1, "müşteri mesajı yine kaydedilmeli");
});

Deno.test("F2 check_rate_limit RPC hatası → fail-open: mesaj işlenir + logCritical", async () => {
  setupScenario({ rateLimit: { data: null, error: { message: "simulated rpc failure" } } });
  const r = await postWebhook("Pamukkale turu fiyatı?");
  assertEquals(r.status, 200);
  assertEquals(processCalls.length, 1, "processChatMessage çağrılmalı");
  assert(criticalLog.some((c) => /RATE_LIMIT/.test(c.event)), `logCritical çağrılmalı (kayıtlar: ${criticalLog.map((c) => c.event).join(",") || "yok"})`);
});

Deno.test("F2 regresyon: allowed=false → eski davranış (yavaşla mesajı, işlenmez)", async () => {
  setupScenario({ rateLimit: { data: { allowed: false }, error: null } });
  const r = await postWebhook("mesaj");
  assertEquals(r.status, 200);
  assertEquals(processCalls.length, 0);
  assertEquals(sent.filter((m) => m.text.includes("Çok hızlı mesaj")).length, 1);
});

Deno.test("Regresyon: bot-pause yolu mesajı role=user kaydeder (metadata'sız, eski şekil)", async () => {
  setupScenario({ botPaused: true });
  await postWebhook("Acenteyle görüşmek istiyorum");
  const rows = userRows();
  assertEquals(rows.length, 1);
  assertEquals(rows[0].content, "Acenteyle görüşmek istiyorum");
  assertEquals(rows[0].metadata?.dropped_reason, undefined);
  assertEquals(processCalls.length, 0);
});

Deno.test("Regresyon: normal akış — mesaj kaydedilir + işlenir", async () => {
  setupScenario({});
  await postWebhook("Merhaba");
  assertEquals(processCalls.length, 1);
  assertEquals(userRows().length, 1);
  assertEquals(userRows()[0].metadata?.dropped_reason, undefined);
});
