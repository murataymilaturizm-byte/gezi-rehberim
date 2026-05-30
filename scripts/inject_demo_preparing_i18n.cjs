// One-shot: 7 dile demo.preparing key inject. İdempotent.
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const PREPARING = {
  tr: "Yanıt hazırlanıyor...",
  en: "Preparing response...",
  de: "Antwort wird vorbereitet...",
  fr: "Préparation de la réponse...",
  es: "Preparando respuesta...",
  ru: "Готовлю ответ...",
  ar: "جارٍ تحضير الرد...",
};

for (const lang of Object.keys(PREPARING)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.demo || typeof obj.demo !== "object") obj.demo = {};
  if (!obj.demo.preparing) {
    obj.demo.preparing = PREPARING[lang];
  }

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] demo.preparing = "${obj.demo.preparing}"`);
}
