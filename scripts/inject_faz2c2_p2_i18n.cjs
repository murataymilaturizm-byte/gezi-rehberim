// Faz 2-C2 PARÇA 2 — i18n anahtarları 7 dile inject. İdempotent.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const T = {
  tr: {
    registrations: {
      timeline: "Sefer Zaman Çizelgesi",
      avgOccupancy: "ort. dolu",
      searchPlaceholder: "İsim, telefon veya tur ara…",
      clearSearch: "Aramayı temizle",
      match: "eşleşme",
      noSearchResults: "Eşleşme bulunamadı",
      noSearchResultsDesc: "Farklı bir kelime deneyin veya aramayı temizleyin.",
    },
    seatPlan: {
      edit: "Düzenle",
      assignHint: "Atamak için bir koltuk seçin (boş koltuğa tıkla → yolcuyu listeden seç)",
    },
  },
  en: {
    registrations: {
      timeline: "Trip Timeline",
      avgOccupancy: "avg. full",
      searchPlaceholder: "Search name, phone or tour…",
      clearSearch: "Clear search",
      match: "matches",
      noSearchResults: "No matches found",
      noSearchResultsDesc: "Try a different keyword or clear the search.",
    },
    seatPlan: {
      edit: "Edit",
      assignHint: "Click an empty seat to assign a passenger",
    },
  },
  de: {
    registrations: {
      timeline: "Reisezeitplan",
      avgOccupancy: "Ø voll",
      searchPlaceholder: "Name, Telefon oder Tour suchen…",
      clearSearch: "Suche löschen",
      match: "Treffer",
      noSearchResults: "Keine Treffer gefunden",
      noSearchResultsDesc: "Versuchen Sie ein anderes Wort oder löschen Sie die Suche.",
    },
    seatPlan: {
      edit: "Bearbeiten",
      assignHint: "Klicken Sie auf einen leeren Sitz, um einen Passagier zuzuweisen",
    },
  },
  fr: {
    registrations: {
      timeline: "Chronologie des voyages",
      avgOccupancy: "rempl. moy.",
      searchPlaceholder: "Rechercher nom, téléphone ou circuit…",
      clearSearch: "Effacer la recherche",
      match: "résultats",
      noSearchResults: "Aucun résultat",
      noSearchResultsDesc: "Essayez un autre mot ou effacez la recherche.",
    },
    seatPlan: {
      edit: "Modifier",
      assignHint: "Cliquez sur un siège vide pour attribuer un passager",
    },
  },
  es: {
    registrations: {
      timeline: "Línea de tiempo del viaje",
      avgOccupancy: "ocup. media",
      searchPlaceholder: "Buscar nombre, teléfono o tour…",
      clearSearch: "Limpiar búsqueda",
      match: "coincidencias",
      noSearchResults: "Sin coincidencias",
      noSearchResultsDesc: "Pruebe otra palabra o limpie la búsqueda.",
    },
    seatPlan: {
      edit: "Editar",
      assignHint: "Haga clic en un asiento vacío para asignar un pasajero",
    },
  },
  ru: {
    registrations: {
      timeline: "Хронология рейсов",
      avgOccupancy: "ср. заполн.",
      searchPlaceholder: "Поиск по имени, телефону или туру…",
      clearSearch: "Очистить поиск",
      match: "совпадений",
      noSearchResults: "Совпадений не найдено",
      noSearchResultsDesc: "Попробуйте другое слово или очистите поиск.",
    },
    seatPlan: {
      edit: "Изменить",
      assignHint: "Нажмите на пустое место, чтобы назначить пассажира",
    },
  },
  ar: {
    registrations: {
      timeline: "الجدول الزمني للرحلات",
      avgOccupancy: "متوسط الإشغال",
      searchPlaceholder: "ابحث بالاسم أو الهاتف أو الجولة…",
      clearSearch: "مسح البحث",
      match: "نتيجة",
      noSearchResults: "لا توجد نتائج",
      noSearchResultsDesc: "جرب كلمة أخرى أو امسح البحث.",
    },
    seatPlan: {
      edit: "تعديل",
      assignHint: "انقر على مقعد فارغ لتعيين مسافر",
    },
  },
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
  if (!obj.admin.registrations || typeof obj.admin.registrations !== "object") obj.admin.registrations = {};
  if (!obj.admin.seatPlan || typeof obj.admin.seatPlan !== "object") obj.admin.seatPlan = {};
  deepInjectIfAbsent(obj.admin.registrations, T[lang].registrations);
  deepInjectIfAbsent(obj.admin.seatPlan, T[lang].seatPlan);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] Faz 2-C2 P2 keys injected`);
}
