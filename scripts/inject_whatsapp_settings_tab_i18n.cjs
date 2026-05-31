// WhatsApp alt-tab "Bildirim Ayarları" → "Ayarlar" yeniden adlandırması için
// `whatsapp.tabs.settings` anahtarını 7 dile inject eder. İdempotent.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const T = {
  tr: { settings: "Ayarlar" },
  en: { settings: "Settings" },
  de: { settings: "Einstellungen" },
  fr: { settings: "Paramètres" },
  es: { settings: "Ajustes" },
  ru: { settings: "Настройки" },
  ar: { settings: "الإعدادات" },
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

  if (!obj.whatsapp || typeof obj.whatsapp !== "object") obj.whatsapp = {};
  if (!obj.whatsapp.tabs || typeof obj.whatsapp.tabs !== "object") obj.whatsapp.tabs = {};
  deepInjectIfAbsent(obj.whatsapp.tabs, T[lang]);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] whatsapp.tabs.settings injected`);
}
