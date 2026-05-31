// Faz 2-C2 P1 düzeltme: timeBuckets.later → "İleride" (zorla override, eski
// "İleride / Geçmiş" değerini güncelle) + timeBuckets.past "Geçmiş" yeni ekle.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const T = {
  tr: { later: "İleride", past: "Geçmiş" },
  en: { later: "Later", past: "Past" },
  de: { later: "Später", past: "Vergangen" },
  fr: { later: "Plus tard", past: "Passé" },
  es: { later: "Más tarde", past: "Pasado" },
  ru: { later: "Позже", past: "Прошедшие" },
  ar: { later: "لاحقاً", past: "سابقاً" },
};

for (const lang of Object.keys(T)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.admin || typeof obj.admin !== "object") obj.admin = {};
  if (!obj.admin.registrations || typeof obj.admin.registrations !== "object") obj.admin.registrations = {};
  if (!obj.admin.registrations.timeBuckets || typeof obj.admin.registrations.timeBuckets !== "object") {
    obj.admin.registrations.timeBuckets = {};
  }
  // ZORLA override — eski "İleride / Geçmiş" değeri yeni "İleride"ye geçsin
  obj.admin.registrations.timeBuckets.later = T[lang].later;
  obj.admin.registrations.timeBuckets.past = T[lang].past;

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] later="${T[lang].later}" past="${T[lang].past}"`);
}
