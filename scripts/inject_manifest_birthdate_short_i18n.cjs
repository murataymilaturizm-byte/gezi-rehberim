// Manifest PDF tablo başlığında "Doğum Tarihi" 22mm sütunda iki satıra bölünüyordu.
// Yeni anahtar `admin.manifest.birthDateShort` — sütun başlığı için kısa varyant.
// 7 dile inject. İdempotent — sadece eksik/boşsa yazar.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const T = {
  tr: { birthDateShort: "Doğum" },
  en: { birthDateShort: "Birth" },
  de: { birthDateShort: "Geburt" },
  fr: { birthDateShort: "Naiss." },
  es: { birthDateShort: "Nac." },
  ru: { birthDateShort: "Рожд." },
  ar: { birthDateShort: "ميلاد" },
};

function deepInjectIfAbsent(target, source) {
  for (const k of Object.keys(source)) {
    if (typeof source[k] === "object" && source[k] !== null && !Array.isArray(source[k])) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepInjectIfAbsent(target[k], source[k]);
    } else if (target[k] == null || target[k] === "") {
      target[k] = source[k];
    }
  }
}

for (const lang of Object.keys(T)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.admin || typeof obj.admin !== "object") obj.admin = {};
  if (!obj.admin.manifest || typeof obj.admin.manifest !== "object") obj.admin.manifest = {};
  deepInjectIfAbsent(obj.admin.manifest, T[lang]);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] admin.manifest.birthDateShort = "${T[lang].birthDateShort}"`);
}
