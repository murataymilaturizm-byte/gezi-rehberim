// İş2: tourCompleteness (panel) ↔ helpers.ts (bot) kritik-alan senkron testi.
// İki kaynağı parse edip alan-setlerini diff'ler; drift varsa FAIL.
import { readFileSync } from "fs";
const ROOT = "C:/Users/LENOVO/Documents/Projeler/gezi-rehberim/";
let pass = 0, fail = 0;
const ck = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}: ${n}${d ? ` — ${d}` : ""}`); c ? pass++ : fail++; };

// 1) PANEL tarafı: tourCompleteness.ts BASE_FIELDS + OVERNIGHT + VISA key'leri
const tc = readFileSync(ROOT + "src/utils/tourCompleteness.ts", "utf8");
const panelKeys = new Set(
  [...tc.matchAll(/key:\s*"([a-z_]+)"/g)].map((m) => m[1]),
);
// visa_required panelde "visa_required"; bot tarafinda tour.visa_required/visa_notes
console.log("PANEL kritik alanlar:", [...panelKeys].sort().join(", "));

// 2) BOT tarafı: helpers.ts _track(tour.X, ...) çağrılarındaki alanlar
const hp = readFileSync(ROOT + "supabase/functions/shared/fsm/prompts/helpers.ts", "utf8");
const botTrack = new Set(
  [...hp.matchAll(/_track\(\s*tour\.([a-z_]+)/g)].map((m) => m[1]),
);
console.log("BOT _track alanlari:", [...botTrack].sort().join(", "));

// 3) Panel'in kritik-alan seti bot tarafından da "eksikse yönlendirme" yapılan
//    alanların ALT KÜMESİ olmalı (panel bir alanı kritik sayıp bot umursamıyorsa
//    yanlış "eksik" uyarısı; bot kritik sayıp panel görmüyorsa sessiz-boşluk).
//    Eşleme: panel key → bot alan adı (aynı isimler + visa eşlemesi).
const PANEL_TO_BOT = {
  hareket_noktasi: "hareket_noktasi",
  toplanma_saati: "toplanma_saati",
  tur_sure: "tur_sure",
  ulasim: "ulasim",
  gezilecek_yerler: "gezilecek_yerler",
  konaklama: "konaklama",
  visa_required: "visa_notes", // bot vize'yi visa_notes/visa_required üzerinden işler
};

// gezilecek_yerler bot tarafında _track ile değil placesText ile işleniyor olabilir
const botAll = hp; // ham metinde alan geçiyor mu (placesText/visa dahil)
for (const pk of panelKeys) {
  const botField = PANEL_TO_BOT[pk];
  if (!botField) { ck(`panel '${pk}' → bot eşlemesi tanımlı`, false, "PANEL_TO_BOT'a ekle"); continue; }
  // bot _track'te VEYA ham helpers metninde tour.<botField> geçiyor mu
  const inTrack = botTrack.has(botField);
  const inRaw = new RegExp(`tour\\.${botField}\\b`).test(botAll);
  ck(`panel '${pk}' ↔ bot '${botField}' senkron`, inTrack || inRaw,
    inTrack ? "_track" : inRaw ? "helpers-raw" : "BOT'ta YOK — drift!");
}

// 4) Ters yön: bot _track ettiği ama panel-kritik olmayan alanlar (bilgi amaçlı;
//    fail değil — bot ekstra alan gösterebilir, panel doluluk-skoruna katmayabilir)
const panelBotFields = new Set(Object.values(PANEL_TO_BOT));
const botExtra = [...botTrack].filter((b) => !panelBotFields.has(b));
console.log("BOT ekstra (_track ama panel-kritik değil):", botExtra.join(", ") || "(yok)");

console.log(`\n=== SONUÇ: ${pass}/${pass + fail} ===`);
process.exit(fail === 0 ? 0 : 1);
