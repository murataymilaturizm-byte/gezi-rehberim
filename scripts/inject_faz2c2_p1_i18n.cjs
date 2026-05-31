// Faz 2-C2 PARÇA 1 — i18n anahtarları 7 dile inject. İdempotent (mevcut override etmez).
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const T = {
  tr: {
    timeBuckets: { today: "Bugün", thisWeek: "Bu Hafta", upcoming: "Yaklaşan", later: "İleride / Geçmiş" },
    tripsShort: "sefer",
    countAvailable: "müsait",
    countFull: "dolu",
    badgeToday: "Bugün",
    badgeTomorrow: "Yarın",
    remainingShort: "kalan koltuk",
    remainingSeats: "{{count}} koltuk boş",
    passengersHeader: "Yolcular",
    statusPanel: "Durum",
    shortcutsPanel: "Kısa Yol",
    teamPanel: "Ekip",
    paymentSummary: {
      title: "Ödeme Özeti",
      total: "Toplam",
      paid: "Ödenmiş",
      remaining: "Kalan",
    },
  },
  en: {
    timeBuckets: { today: "Today", thisWeek: "This Week", upcoming: "Upcoming", later: "Later / Past" },
    tripsShort: "trips",
    countAvailable: "available",
    countFull: "full",
    badgeToday: "Today",
    badgeTomorrow: "Tomorrow",
    remainingShort: "seats left",
    remainingSeats: "{{count}} seats available",
    passengersHeader: "Passengers",
    statusPanel: "Status",
    shortcutsPanel: "Shortcuts",
    teamPanel: "Team",
    paymentSummary: {
      title: "Payment Summary",
      total: "Total",
      paid: "Paid",
      remaining: "Remaining",
    },
  },
  de: {
    timeBuckets: { today: "Heute", thisWeek: "Diese Woche", upcoming: "Bevorstehend", later: "Später / Vergangen" },
    tripsShort: "Fahrten",
    countAvailable: "verfügbar",
    countFull: "voll",
    badgeToday: "Heute",
    badgeTomorrow: "Morgen",
    remainingShort: "freie Plätze",
    remainingSeats: "{{count}} freie Plätze",
    passengersHeader: "Passagiere",
    statusPanel: "Status",
    shortcutsPanel: "Verknüpfungen",
    teamPanel: "Team",
    paymentSummary: {
      title: "Zahlungsübersicht",
      total: "Gesamt",
      paid: "Bezahlt",
      remaining: "Restbetrag",
    },
  },
  fr: {
    timeBuckets: { today: "Aujourd'hui", thisWeek: "Cette semaine", upcoming: "À venir", later: "Plus tard / Passé" },
    tripsShort: "voyages",
    countAvailable: "disponibles",
    countFull: "complet",
    badgeToday: "Aujourd'hui",
    badgeTomorrow: "Demain",
    remainingShort: "sièges restants",
    remainingSeats: "{{count}} sièges disponibles",
    passengersHeader: "Passagers",
    statusPanel: "État",
    shortcutsPanel: "Raccourcis",
    teamPanel: "Équipe",
    paymentSummary: {
      title: "Récapitulatif de paiement",
      total: "Total",
      paid: "Payé",
      remaining: "Solde",
    },
  },
  es: {
    timeBuckets: { today: "Hoy", thisWeek: "Esta semana", upcoming: "Próximos", later: "Más tarde / Pasado" },
    tripsShort: "viajes",
    countAvailable: "disponibles",
    countFull: "lleno",
    badgeToday: "Hoy",
    badgeTomorrow: "Mañana",
    remainingShort: "asientos libres",
    remainingSeats: "{{count}} asientos disponibles",
    passengersHeader: "Pasajeros",
    statusPanel: "Estado",
    shortcutsPanel: "Accesos",
    teamPanel: "Equipo",
    paymentSummary: {
      title: "Resumen de pago",
      total: "Total",
      paid: "Pagado",
      remaining: "Saldo",
    },
  },
  ru: {
    timeBuckets: { today: "Сегодня", thisWeek: "На этой неделе", upcoming: "Предстоящие", later: "Позже / Прошедшие" },
    tripsShort: "рейсов",
    countAvailable: "доступно",
    countFull: "заполнено",
    badgeToday: "Сегодня",
    badgeTomorrow: "Завтра",
    remainingShort: "свободных мест",
    remainingSeats: "{{count}} свободных мест",
    passengersHeader: "Пассажиры",
    statusPanel: "Статус",
    shortcutsPanel: "Быстрый доступ",
    teamPanel: "Команда",
    paymentSummary: {
      title: "Сводка оплаты",
      total: "Итого",
      paid: "Оплачено",
      remaining: "Остаток",
    },
  },
  ar: {
    timeBuckets: { today: "اليوم", thisWeek: "هذا الأسبوع", upcoming: "قادم", later: "لاحقاً / سابقاً" },
    tripsShort: "رحلة",
    countAvailable: "متاح",
    countFull: "ممتلئ",
    badgeToday: "اليوم",
    badgeTomorrow: "غداً",
    remainingShort: "مقعد متاح",
    remainingSeats: "{{count}} مقاعد متاحة",
    passengersHeader: "الركاب",
    statusPanel: "الحالة",
    shortcutsPanel: "اختصارات",
    teamPanel: "الفريق",
    paymentSummary: {
      title: "ملخص الدفع",
      total: "الإجمالي",
      paid: "المدفوع",
      remaining: "المتبقي",
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
  deepInjectIfAbsent(obj.admin.registrations, T[lang]);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] Faz 2-C2 P1 keys injected`);
}
