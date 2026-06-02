// Pricing paket özellik listesine eklenen operasyon araçları için i18n key'leri
// 7 dile inject. İdempotent — sadece eksik/boşsa yazar. Mevcut çevirileri ezmez.
//
// 4 özellik × 2 paket (starter + professional) × 7 dil = 56 entry
// Enterprise allProFeatures ile zaten kapsıyor, ona dokunulmadı.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  tr: {
    seatPlan: "Otobüs koltuk planı",
    passengerList: "Yolcu listesi & manifesto (PDF/Excel)",
    registrationMgmt: "Kayıt ve sefer yönetimi",
    balanceTracking: "Bakiye takibi",
  },
  en: {
    seatPlan: "Bus seat plan",
    passengerList: "Passenger list & manifest (PDF/Excel)",
    registrationMgmt: "Registration & departure management",
    balanceTracking: "Balance tracking",
  },
  de: {
    seatPlan: "Bus-Sitzplan",
    passengerList: "Passagierliste & Manifest (PDF/Excel)",
    registrationMgmt: "Buchungs- & Abfahrtsverwaltung",
    balanceTracking: "Saldoverfolgung",
  },
  fr: {
    seatPlan: "Plan de sièges du bus",
    passengerList: "Liste des passagers & manifeste (PDF/Excel)",
    registrationMgmt: "Gestion des inscriptions & départs",
    balanceTracking: "Suivi des soldes",
  },
  es: {
    seatPlan: "Plano de asientos del autobús",
    passengerList: "Lista de pasajeros y manifiesto (PDF/Excel)",
    registrationMgmt: "Gestión de reservas y salidas",
    balanceTracking: "Seguimiento de saldos",
  },
  ru: {
    seatPlan: "План мест автобуса",
    passengerList: "Список пассажиров и манифест (PDF/Excel)",
    registrationMgmt: "Управление бронированиями и рейсами",
    balanceTracking: "Учёт остатков",
  },
  ar: {
    seatPlan: "مخطط مقاعد الحافلة",
    passengerList: "قائمة الركاب والبيان (PDF/Excel)",
    registrationMgmt: "إدارة الحجوزات والرحلات",
    balanceTracking: "تتبع الأرصدة",
  },
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

for (const lang of Object.keys(KEYS)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.pricing) obj.pricing = {};
  if (!obj.pricing.starter) obj.pricing.starter = {};
  if (!obj.pricing.starter.features) obj.pricing.starter.features = {};
  if (!obj.pricing.professional) obj.pricing.professional = {};
  if (!obj.pricing.professional.features) obj.pricing.professional.features = {};

  // Starter + Professional aynı 4 değeri alır
  deepInjectIfAbsent(obj.pricing.starter.features, KEYS[lang]);
  deepInjectIfAbsent(obj.pricing.professional.features, KEYS[lang]);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] pricing operations features injected (starter + professional)`);
}
