// i18n sub-content fiyat geçişleri (alt-sayfa SEO/CTA/landing card vb.).
// Regex negative lookbehind ile 14.999 gibi Enterprise eski fiyatları KORUR.
// İdempotent — ana key'ler (pricing.*.price) zaten önceki script'te değişti.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");
const LANGS = ["tr", "en", "de", "fr", "es", "ru", "ar"];

// (?<!\d) → 2.999 önünde rakam YOKSA replace. 14.999 → korunur.
const RE_STARTER = /(?<!\d)2\.999/g;
const RE_PRO     = /(?<!\d)4\.999/g;

let total = 0;
for (const lang of LANGS) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const stripped = hasBom ? raw.slice(1) : raw;

  let count = 0;
  let out = stripped.replace(RE_STARTER, () => { count++; return "3.999"; });
  out = out.replace(RE_PRO, () => { count++; return "5.999"; });

  // BOM koru, sonek newline koru
  const final = (hasBom ? "﻿" : "") + out;
  fs.writeFileSync(file, final, "utf8");
  console.log(`[${lang}] sub-content price replacements: ${count}`);
  total += count;
}
console.log(`\nTotal sub-content replacements: ${total}`);
