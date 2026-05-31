// Faz 2-D i18n anahtarları 7 dile inject. İdempotent.
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const T = {
  tr: {
    seatPlan: {
      doorRow: "Kapı sırası",
      doorRowHint: "sıradan sonra",
      doorRowPlaceholder: "boş = kapı yok",
      door: "Giriş",
      front: "ÖN",
      tourLeaderName: "Tur Lideri",
      captainName: "Kaptan"
    },
    manifest: {
      balance: "Bakiye",
      paid: "Tamamı ödendi",
      tourLeader: "Tur Lideri",
      captain: "Kaptan"
    }
  },
  en: {
    seatPlan: {
      doorRow: "Door row",
      doorRowHint: "after row",
      doorRowPlaceholder: "empty = no door",
      door: "Door",
      front: "FRONT",
      tourLeaderName: "Tour Leader",
      captainName: "Captain"
    },
    manifest: {
      balance: "Balance",
      paid: "Fully paid",
      tourLeader: "Tour Leader",
      captain: "Captain"
    }
  },
  de: {
    seatPlan: {
      doorRow: "Türreihe",
      doorRowHint: "nach Reihe",
      doorRowPlaceholder: "leer = keine Tür",
      door: "Eingang",
      front: "VORN",
      tourLeaderName: "Reiseleiter",
      captainName: "Fahrer"
    },
    manifest: {
      balance: "Restbetrag",
      paid: "Vollständig bezahlt",
      tourLeader: "Reiseleiter",
      captain: "Fahrer"
    }
  },
  fr: {
    seatPlan: {
      doorRow: "Rangée de la porte",
      doorRowHint: "après la rangée",
      doorRowPlaceholder: "vide = pas de porte",
      door: "Entrée",
      front: "AVANT",
      tourLeaderName: "Chef de groupe",
      captainName: "Chauffeur"
    },
    manifest: {
      balance: "Solde",
      paid: "Entièrement payé",
      tourLeader: "Chef de groupe",
      captain: "Chauffeur"
    }
  },
  es: {
    seatPlan: {
      doorRow: "Fila de la puerta",
      doorRowHint: "después de la fila",
      doorRowPlaceholder: "vacío = sin puerta",
      door: "Entrada",
      front: "FRENTE",
      tourLeaderName: "Líder del tour",
      captainName: "Conductor"
    },
    manifest: {
      balance: "Saldo",
      paid: "Totalmente pagado",
      tourLeader: "Líder del tour",
      captain: "Conductor"
    }
  },
  ru: {
    seatPlan: {
      doorRow: "Ряд двери",
      doorRowHint: "после ряда",
      doorRowPlaceholder: "пусто = без двери",
      door: "Вход",
      front: "ПЕРЕД",
      tourLeaderName: "Руководитель тура",
      captainName: "Водитель"
    },
    manifest: {
      balance: "Остаток",
      paid: "Полностью оплачено",
      tourLeader: "Руководитель тура",
      captain: "Водитель"
    }
  },
  ar: {
    seatPlan: {
      doorRow: "صف الباب",
      doorRowHint: "بعد الصف",
      doorRowPlaceholder: "فارغ = بدون باب",
      door: "المدخل",
      front: "أمام",
      tourLeaderName: "قائد الجولة",
      captainName: "السائق"
    },
    manifest: {
      balance: "الرصيد",
      paid: "مدفوع بالكامل",
      tourLeader: "قائد الجولة",
      captain: "السائق"
    }
  }
};

function deepInjectIfAbsent(target, source) {
  for (const k of Object.keys(source)) {
    if (typeof source[k] === "object" && source[k] !== null && !Array.isArray(source[k])) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepInjectIfAbsent(target[k], source[k]);
    } else {
      if (!target[k]) target[k] = source[k];
    }
  }
}

for (const lang of Object.keys(T)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.admin || typeof obj.admin !== "object") obj.admin = {};
  if (!obj.admin.seatPlan || typeof obj.admin.seatPlan !== "object") obj.admin.seatPlan = {};
  if (!obj.admin.manifest || typeof obj.admin.manifest !== "object") obj.admin.manifest = {};
  deepInjectIfAbsent(obj.admin.seatPlan, T[lang].seatPlan);
  deepInjectIfAbsent(obj.admin.manifest, T[lang].manifest);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] Faz 2-D keys injected`);
}
