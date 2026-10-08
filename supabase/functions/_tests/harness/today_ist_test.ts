// Dilim-8 (denetim F5) — process-message: "bugün" Europe/Istanbul.
// İstanbul 01:30 = UTC 22:30 (önceki gün). DÜN (İstanbul) kalkmış tarih seçiliyken onay
// gelirse rezervasyon RPC'si ÇAĞRILMAZ (L3 erken revalidation tarihi geçmiş sayar);
// LLM'e verilen "CURRENT DATE" başlığı da İstanbul günü.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runTurn, mkSupabase, mkTour, mkDate, mkContext, dumpTurn, setNluMode, setAiMode } from "./harness.ts";
import { formatDateHeader } from "../../shared/fsm/prompts/helpers.ts";
import { withFakeNow } from "../fake-now.ts";

setAiMode({ kind: "fail" });
const YES: Record<string, string> = { tr: "evet", en: "yes", ru: "да", ar: "نعم" };
const NOW = "2027-03-10T22:30:00Z"; // İstanbul 2027-03-11 01:30

for (const lang of ["tr", "en", "ru", "ar"]) {
  Deno.test(`F5 [${lang}] İstanbul 01:30 — dün (10.03) kalkmış tarih + "${YES[lang]}" → RPC YOK, tarih yeniden sorulur`, async () => {
    await withFakeNow(NOW, async () => {
      setNluMode({ kind: "fixed", fn: () => ({ intent: "confirm_reservation", language: lang }) });
      const tour = mkTour({ dates: [mkDate("d-0310", "2027-03-10", 10), mkDate("d-0312", "2027-03-12", 10)] });
      const sb = mkSupabase({ rpc: { create_reservation_with_quota_check: () => ({ data: { success: true }, error: null }) } });
      const ctx = mkContext(tour, {
        language: lang, stage: "CONFIRMING", collectionStep: "ready_for_confirmation",
        reservationInfo: { tourId: tour.id, tourTitle: tour.title, dateId: "d-0310", selectedDate: "2027-03-10", paxAdult: 2, fullName: "Ali Veli", phone: "05551112233" },
      });
      const t = await runTurn({ ctx, message: YES[lang], tours: [tour], supabase: sb });
      dumpTurn(`F5 [${lang}]`, t);
      assert(!t.rpcCalls.some((c) => c.name === "create_reservation_with_quota_check"), "dünkü tura rezervasyon RPC'si çağrılmamalı");
      assert(t.stateOut.stage !== "COMPLETED", "rezervasyon tamamlanmamalı");
      assertEquals(t.stateOut.reservationInfo.dateId, undefined, "geçmiş tarih temizlenmeli");
    });
  });
}

Deno.test("F5 LLM 'CURRENT DATE' başlığı İstanbul günü (11.03.2027, Perşembe)", async () => {
  await withFakeNow(NOW, () => {
    const h = formatDateHeader("tr");
    assert(h.includes("11.03.2027"), h);
    assert(h.includes("Perşembe"), h);
  });
});
