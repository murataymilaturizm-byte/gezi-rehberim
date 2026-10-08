// Dilim-8 (denetim F4 + F5) — GERÇEK whatsapp-webhook/index.ts.
//  F4: aylık sayaç her yolda atomik RPC → eşzamanlı iki mesaj sayacı +2 artırır.
//  F5: "bugün" Europe/Istanbul → İstanbul 01:30 (UTC 22:30, önceki gün) anında DÜN
//      kalkmış tur handler'a giden tur listesinde YOK; bugünkü/yarınki var.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { setupScenario, postWebhook, processCalls, db } from "./webhook_harness.ts";
import { withFakeNow } from "../fake-now.ts";

Deno.test("F4 eşzamanlı iki mesaj → monthly_message_count +2 (okuma-değiştir-yazma kaybı yok)", async () => {
  setupScenario({ agency: { monthly_message_count: 7 } });
  const [a, b] = await Promise.all([
    postWebhook("Kapadokya balon turu için tarih var mı acaba", "905551110001"),
    postWebhook("Pamukkale turunun programı nasıl", "905551110002"),
  ]);
  assertEquals([a.status, b.status], [200, 200]);
  assertEquals(processCalls.length, 2, "iki mesaj da ana akıştan geçti");
  assertEquals(db.agencyCount, 9, `sayaç 7 → 9 olmalı (bulunan ${db.agencyCount})`);
  assert(!db.updates.some((u) => u.table === "agencies" && typeof u.payload?.monthly_message_count === "number" && u.payload.monthly_message_count > 0),
    "agencies'e +1 hesaplı UPDATE yazılmamalı (yalnız RPC)");
  assertEquals(db.rpcCalls.filter((c) => c.name === "increment_agency_message_count").length, 2);
});

Deno.test("F4 ay sıfırlaması: geçen ay limiti dolan acentenin yeni aydaki ilk mesajı işlenir", async () => {
  setupScenario({ planLimit: 100, agency: { monthly_message_count: 100, last_message_reset_date: "2000-01-15T10:00:00Z" } });
  const r = await postWebhook("Kapadokya balon turu için tarih var mı acaba");
  assertEquals(r.status, 200);
  assertEquals(processCalls.length, 1, "limit doldu sayılmamalı — sayaç bu ay 0");
  assertEquals(db.agencyCount, 1, "sıfırlama + 1");
});

const RAW_TOURS = [{
  id: "t-f5", title: "Pamukkale Turu", destination: "Pamukkale", type: "DAYTRIP", currency: "TRY", is_active: true,
  dates: [
    { id: "d-0310", departure_date: "2027-03-10", price_adult: 1000, price_child: null, quota: 20 },
    { id: "d-0311", departure_date: "2027-03-11", price_adult: 1000, price_child: null, quota: 20 },
    { id: "d-0312", departure_date: "2027-03-12", price_adult: 1000, price_child: null, quota: 20 },
  ],
}];

Deno.test("F5 İstanbul 01:30 (UTC 2027-03-10 22:30) → dün (10.03) kalkmış tarih handler'a GİTMEZ; 11.03 ve 12.03 gider", async () => {
  await withFakeNow("2027-03-10T22:30:00Z", async () => {
    setupScenario({ agency: { id: "ag-f5-webhook" }, tours: RAW_TOURS });
    const r = await postWebhook("Pamukkale turu tarihleri neler");
    assertEquals(r.status, 200);
    assertEquals(processCalls.length, 1);
    const ids = (processCalls[0].tours ?? []).flatMap((t: any) => (t.dates ?? []).map((d: any) => d.id));
    assert(!ids.includes("d-0310"), `dünkü tarih listede olmamalı → ${ids}`);
    assert(ids.includes("d-0311") && ids.includes("d-0312"), `bugün/yarın listede olmalı → ${ids}`);
  });
});
