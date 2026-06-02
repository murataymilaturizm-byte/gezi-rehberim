// Paket fiyat güncelleme + Enterprise "+1 üslup" kaldırma — 7 dil tek pas.
// İdempotent: değerler zaten yeniyse no-op. JSON parse + manipulate + stringify.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

// Per-locale sub-content price string replacement (substring sonrasında JSON parse).
// Ana key'ler (pricing.starter.price, pricing.professional.price) JSON parse sonrası ayrıca güncellenir.
const SUB_CONTENT_REPLACEMENTS = {
  tr: [
    ['"2.999₺"', '"3.999₺"'],
  ],
  en: [
    ['"₺2,999"', '"₺3,999"'],
  ],
  de: [
    ['"₺2.999"', '"₺3.999"'],
    ['Professional-Plan (₺4.999/Monat)', 'Professional-Plan (₺5.999/Monat)'],
    ['Pakete ab ₺2.999/Monat', 'Pakete ab ₺3.999/Monat'],
    ['Ab ₺2.999 starten', 'Ab ₺3.999 starten'],
  ],
  fr: [
    ['"₺2 999"', '"₺3 999"'],
  ],
  es: [
    ['"₺2.999"', '"₺3.999"'],
  ],
  ru: [
    ['"₺2 999"', '"₺3 999"'],
  ],
  ar: [
    ['"₺2.999"', '"₺3.999"'],
    ['ابدأ من ₺2.999', 'ابدأ من ₺3.999'],
  ],
};

// "+ Özel üslup" kaldırma — admin.usageStats.dynamicFeatures.allStyles
const ALLSTYLES_NEW = {
  tr: "Tüm konuşma üslupları",
  en: "All conversation styles",
  de: "Alle Gesprächsstile",
  fr: "Tous les styles de conversation",
  es: "Todos los estilos de conversación",
  ru: "Все стили общения",
  ar: "جميع أنماط المحادثة",
};

function applySubReplacements(raw, replacements) {
  let out = raw;
  for (const [from, to] of replacements) {
    out = out.split(from).join(to);
  }
  return out;
}

let totalChanges = 0;
for (const lang of Object.keys(ALLSTYLES_NEW)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const stripped = hasBom ? raw.slice(1) : raw;

  // 1) Sub-content string replacements (yapılandırılmamış geçişler için)
  const replaced = applySubReplacements(stripped, SUB_CONTENT_REPLACEMENTS[lang] || []);

  // 2) JSON parse + structured update
  const obj = JSON.parse(replaced);

  // 2a) pricing.starter.price + pricing.professional.price güncelle
  // (Enterprise pricing.enterprise.price'a DOKUNULMAZ)
  if (obj.pricing?.starter?.price !== undefined) {
    const before = obj.pricing.starter.price;
    if (before === "2.999") {
      obj.pricing.starter.price = "3.999";
      console.log(`[${lang}] pricing.starter.price: 2.999 → 3.999`);
      totalChanges++;
    }
  }
  if (obj.pricing?.professional?.price !== undefined) {
    const before = obj.pricing.professional.price;
    if (before === "4.999") {
      obj.pricing.professional.price = "5.999";
      console.log(`[${lang}] pricing.professional.price: 4.999 → 5.999`);
      totalChanges++;
    }
  }

  // 2b) pricing.enterprise.features.customStyles SİL (artık kullanılmıyor — PricingSection'dan da çıkarıldı)
  if (obj.pricing?.enterprise?.features?.customStyles !== undefined) {
    delete obj.pricing.enterprise.features.customStyles;
    console.log(`[${lang}] pricing.enterprise.features.customStyles → DELETED`);
    totalChanges++;
  }

  // 2c) admin.usageStats.dynamicFeatures.allStyles "+ Özel üslup" → "Tüm konuşma üslupları"
  // UsageStats.tsx Pro+Enterprise için aynı text gösteriyordu (her ikisi length>=4) — "+Özel üslup" yalanı kaldırıldı.
  if (obj.admin?.usageStats?.dynamicFeatures?.allStyles !== undefined) {
    const before = obj.admin.usageStats.dynamicFeatures.allStyles;
    const newVal = ALLSTYLES_NEW[lang];
    if (before !== newVal) {
      obj.admin.usageStats.dynamicFeatures.allStyles = newVal;
      console.log(`[${lang}] admin.usageStats.dynamicFeatures.allStyles: "${before}" → "${newVal}"`);
      totalChanges++;
    }
  }

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
}

console.log(`\nTotal structural changes: ${totalChanges}`);
