// One-shot: 7 dile nav.callSupport + whatsapp.supportBlock.{title,subtitle} inject.
// İdempotent — mevcut değer varsa override etmez.

const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const TRANSLATIONS = {
  tr: {
    callSupport: "Destek Hattı",
    supportTitle: "Desteğe mi ihtiyacınız var?",
    supportSubtitle: "WhatsApp bağlantısı veya başka bir konuda hemen arayın.",
  },
  en: {
    callSupport: "Support Line",
    supportTitle: "Need help?",
    supportSubtitle: "Call us now for WhatsApp connection or any other issue.",
  },
  de: {
    callSupport: "Support-Hotline",
    supportTitle: "Brauchen Sie Hilfe?",
    supportSubtitle: "Rufen Sie uns sofort an — WhatsApp-Verbindung oder andere Anliegen.",
  },
  fr: {
    callSupport: "Ligne d'assistance",
    supportTitle: "Besoin d'aide ?",
    supportSubtitle: "Appelez-nous pour la connexion WhatsApp ou tout autre sujet.",
  },
  es: {
    callSupport: "Línea de soporte",
    supportTitle: "¿Necesita ayuda?",
    supportSubtitle: "Llámenos ahora para conexión WhatsApp u otro tema.",
  },
  ru: {
    callSupport: "Линия поддержки",
    supportTitle: "Нужна помощь?",
    supportSubtitle: "Позвоните нам по вопросам подключения WhatsApp или любым другим.",
  },
  ar: {
    callSupport: "خط الدعم",
    supportTitle: "هل تحتاج إلى مساعدة؟",
    supportSubtitle: "اتصل بنا الآن لربط WhatsApp أو أي مسألة أخرى.",
  },
};

function inject(lang) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const data = hasBom ? raw.slice(1) : raw;
  const obj = JSON.parse(data);
  const tr = TRANSLATIONS[lang];

  // nav.callSupport
  if (obj.nav && typeof obj.nav === "object") {
    if (!obj.nav.callSupport) obj.nav.callSupport = tr.callSupport;
  } else {
    obj.nav = { callSupport: tr.callSupport };
  }

  // whatsapp.supportBlock.{title, subtitle}
  if (!obj.whatsapp || typeof obj.whatsapp !== "object") obj.whatsapp = {};
  if (!obj.whatsapp.supportBlock || typeof obj.whatsapp.supportBlock !== "object") {
    obj.whatsapp.supportBlock = {};
  }
  if (!obj.whatsapp.supportBlock.title)    obj.whatsapp.supportBlock.title    = tr.supportTitle;
  if (!obj.whatsapp.supportBlock.subtitle) obj.whatsapp.supportBlock.subtitle = tr.supportSubtitle;

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] injected nav.callSupport + whatsapp.supportBlock`);
}

for (const lang of Object.keys(TRANSLATIONS)) {
  try { inject(lang); }
  catch (e) { console.error(`[${lang}] FAILED:`, e.message); process.exitCode = 1; }
}
