// Faz 2-D bug fix: "Kapı sırası" → "Orta Kapı Boşluğu" güncelle (zorla override)
// + doorRowHelp (yeni) + middleDoor (yeni) 7 dile inject.
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

// Bu paket için ZORLA override: doorRow değeri eski "Kapı sırası" idi, yeni etikete geç.
// doorRowHelp ve middleDoor yeni — IF NOT EXISTS yerine zorla ekle (güvenli, kullanıcı override etmemiş).
const UPDATES = {
  tr: {
    doorRow: "Orta Kapı Boşluğu",
    doorRowHelp: "Kapının hangi sıradan sonra olduğunu girin",
    middleDoor: "Orta Kapı",
  },
  en: {
    doorRow: "Middle Door Gap",
    doorRowHelp: "Enter after which row the door is located",
    middleDoor: "Middle Door",
  },
  de: {
    doorRow: "Mittlere Türöffnung",
    doorRowHelp: "Geben Sie an, nach welcher Reihe die Tür sich befindet",
    middleDoor: "Mittlere Tür",
  },
  fr: {
    doorRow: "Espace de porte centrale",
    doorRowHelp: "Indiquez après quelle rangée se trouve la porte",
    middleDoor: "Porte centrale",
  },
  es: {
    doorRow: "Espacio de puerta central",
    doorRowHelp: "Indique después de qué fila se ubica la puerta",
    middleDoor: "Puerta central",
  },
  ru: {
    doorRow: "Проём центральной двери",
    doorRowHelp: "Укажите, после какого ряда находится дверь",
    middleDoor: "Центральная дверь",
  },
  ar: {
    doorRow: "فجوة الباب الأوسط",
    doorRowHelp: "أدخل بعد أي صف يقع الباب",
    middleDoor: "الباب الأوسط",
  },
};

for (const lang of Object.keys(UPDATES)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.admin || typeof obj.admin !== "object") obj.admin = {};
  if (!obj.admin.seatPlan || typeof obj.admin.seatPlan !== "object") obj.admin.seatPlan = {};

  // ZORLA override (eski "Kapı sırası" etiketi yeni "Orta Kapı Boşluğu"na geçsin)
  obj.admin.seatPlan.doorRow = UPDATES[lang].doorRow;
  obj.admin.seatPlan.doorRowHelp = UPDATES[lang].doorRowHelp;
  obj.admin.seatPlan.middleDoor = UPDATES[lang].middleDoor;

  // doorRowHint eski idi (artık kullanılmıyor), bırak (kırılma yok); sadece etiket güncellendi.

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] doorRow + doorRowHelp + middleDoor updated`);
}
