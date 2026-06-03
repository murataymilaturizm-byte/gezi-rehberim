// CRM TUR 1 — yeni i18n key'leri 7 dile derin-enjekte et (idempotent).
// admin.whatsapp.userProfiles namespace altına:
//   metrics.{total,vip,active,avgSpending,avgSpendingSub}
//   searchPlaceholder
//   filter.{all,vip,customer,prospect,active,inactive}
//   sort.{lastActivity,spending,bookings,name}
//   autoTags.{vip,customer,prospect,active,inactive,heading,description,empty,autoTagTooltip}
//   noMatch
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const TR = {
  metrics: {
    total: "Toplam Müşteri",
    vip: "VIP",
    active: "Aktif (7 gün)",
    avgSpending: "Ortalama Harcama",
    avgSpendingSub: "rezervasyon yapan müşteri başına",
  },
  searchPlaceholder: "İsim veya telefonla ara…",
  filter: {
    all: "Tümü",
    vip: "VIP",
    customer: "Müşteri",
    prospect: "Potansiyel",
    active: "Aktif",
    inactive: "İnaktif",
  },
  sort: {
    lastActivity: "Son etkileşim",
    spending: "Harcamaya göre",
    bookings: "Rezervasyon sayısına göre",
    name: "İsme göre",
  },
  autoTags: {
    vip: "VIP",
    customer: "Müşteri",
    prospect: "Potansiyel",
    active: "Aktif",
    inactive: "İnaktif",
    heading: "Otomatik Etiketler",
    description: "Sistem rezervasyon, harcama ve aktivite verisinden hesaplar.",
    empty: "Henüz yeterli aktivite yok.",
    autoTagTooltip: "Otomatik etiket (sistem tarafından atandı)",
  },
  noMatch: "Sonuç yok",
};

const EN = {
  metrics: {
    total: "Total Customers",
    vip: "VIP",
    active: "Active (7d)",
    avgSpending: "Avg. Spending",
    avgSpendingSub: "per paying customer",
  },
  searchPlaceholder: "Search by name or phone…",
  filter: {
    all: "All",
    vip: "VIP",
    customer: "Customer",
    prospect: "Prospect",
    active: "Active",
    inactive: "Inactive",
  },
  sort: {
    lastActivity: "Last interaction",
    spending: "By spending",
    bookings: "By bookings",
    name: "By name",
  },
  autoTags: {
    vip: "VIP",
    customer: "Customer",
    prospect: "Prospect",
    active: "Active",
    inactive: "Inactive",
    heading: "Automatic Tags",
    description: "Computed by the system from bookings, spending and activity.",
    empty: "Not enough activity yet.",
    autoTagTooltip: "Automatic tag (assigned by the system)",
  },
  noMatch: "No results",
};

const DE = {
  metrics: {
    total: "Kunden gesamt",
    vip: "VIP",
    active: "Aktiv (7 Tg.)",
    avgSpending: "Ø Ausgaben",
    avgSpendingSub: "pro zahlendem Kunden",
  },
  searchPlaceholder: "Nach Name oder Telefon suchen…",
  filter: {
    all: "Alle",
    vip: "VIP",
    customer: "Kunde",
    prospect: "Interessent",
    active: "Aktiv",
    inactive: "Inaktiv",
  },
  sort: {
    lastActivity: "Letzte Interaktion",
    spending: "Nach Ausgaben",
    bookings: "Nach Buchungen",
    name: "Nach Name",
  },
  autoTags: {
    vip: "VIP",
    customer: "Kunde",
    prospect: "Interessent",
    active: "Aktiv",
    inactive: "Inaktiv",
    heading: "Automatische Tags",
    description: "Vom System aus Buchungen, Ausgaben und Aktivität berechnet.",
    empty: "Noch nicht genügend Aktivität.",
    autoTagTooltip: "Automatischer Tag (vom System zugewiesen)",
  },
  noMatch: "Keine Ergebnisse",
};

const FR = {
  metrics: {
    total: "Clients au total",
    vip: "VIP",
    active: "Actifs (7j)",
    avgSpending: "Dépense moyenne",
    avgSpendingSub: "par client payant",
  },
  searchPlaceholder: "Rechercher par nom ou téléphone…",
  filter: {
    all: "Tous",
    vip: "VIP",
    customer: "Client",
    prospect: "Prospect",
    active: "Actif",
    inactive: "Inactif",
  },
  sort: {
    lastActivity: "Dernière interaction",
    spending: "Par dépenses",
    bookings: "Par réservations",
    name: "Par nom",
  },
  autoTags: {
    vip: "VIP",
    customer: "Client",
    prospect: "Prospect",
    active: "Actif",
    inactive: "Inactif",
    heading: "Étiquettes automatiques",
    description: "Calculées par le système à partir des réservations, dépenses et activité.",
    empty: "Pas encore assez d'activité.",
    autoTagTooltip: "Étiquette automatique (attribuée par le système)",
  },
  noMatch: "Aucun résultat",
};

const ES = {
  metrics: {
    total: "Clientes totales",
    vip: "VIP",
    active: "Activos (7d)",
    avgSpending: "Gasto medio",
    avgSpendingSub: "por cliente que paga",
  },
  searchPlaceholder: "Buscar por nombre o teléfono…",
  filter: {
    all: "Todos",
    vip: "VIP",
    customer: "Cliente",
    prospect: "Potencial",
    active: "Activo",
    inactive: "Inactivo",
  },
  sort: {
    lastActivity: "Última interacción",
    spending: "Por gasto",
    bookings: "Por reservas",
    name: "Por nombre",
  },
  autoTags: {
    vip: "VIP",
    customer: "Cliente",
    prospect: "Potencial",
    active: "Activo",
    inactive: "Inactivo",
    heading: "Etiquetas automáticas",
    description: "El sistema las calcula a partir de reservas, gasto y actividad.",
    empty: "Aún no hay suficiente actividad.",
    autoTagTooltip: "Etiqueta automática (asignada por el sistema)",
  },
  noMatch: "Sin resultados",
};

const RU = {
  metrics: {
    total: "Всего клиентов",
    vip: "VIP",
    active: "Активные (7 дн.)",
    avgSpending: "Ср. расход",
    avgSpendingSub: "на платящего клиента",
  },
  searchPlaceholder: "Поиск по имени или телефону…",
  filter: {
    all: "Все",
    vip: "VIP",
    customer: "Клиент",
    prospect: "Потенциальный",
    active: "Активный",
    inactive: "Неактивный",
  },
  sort: {
    lastActivity: "Последнее взаимодействие",
    spending: "По расходам",
    bookings: "По бронированиям",
    name: "По имени",
  },
  autoTags: {
    vip: "VIP",
    customer: "Клиент",
    prospect: "Потенциальный",
    active: "Активный",
    inactive: "Неактивный",
    heading: "Автоматические теги",
    description: "Система рассчитывает по бронированиям, расходам и активности.",
    empty: "Пока недостаточно активности.",
    autoTagTooltip: "Автоматический тег (назначен системой)",
  },
  noMatch: "Нет результатов",
};

const AR = {
  metrics: {
    total: "إجمالي العملاء",
    vip: "VIP",
    active: "نشط (7 أيام)",
    avgSpending: "متوسط الإنفاق",
    avgSpendingSub: "لكل عميل دافع",
  },
  searchPlaceholder: "ابحث بالاسم أو الهاتف…",
  filter: {
    all: "الكل",
    vip: "VIP",
    customer: "عميل",
    prospect: "محتمل",
    active: "نشط",
    inactive: "غير نشط",
  },
  sort: {
    lastActivity: "آخر تفاعل",
    spending: "حسب الإنفاق",
    bookings: "حسب الحجوزات",
    name: "حسب الاسم",
  },
  autoTags: {
    vip: "VIP",
    customer: "عميل",
    prospect: "محتمل",
    active: "نشط",
    inactive: "غير نشط",
    heading: "الوسوم التلقائية",
    description: "يحسبها النظام من الحجوزات والإنفاق والنشاط.",
    empty: "لا يوجد نشاط كافٍ بعد.",
    autoTagTooltip: "وسم تلقائي (يعينه النظام)",
  },
  noMatch: "لا توجد نتائج",
};

const LANG_VALUES = { tr: TR, en: EN, de: DE, fr: FR, es: ES, ru: RU, ar: AR };

let totalAdded = 0;
for (const [lang, values] of Object.entries(LANG_VALUES)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.admin) obj.admin = {};
  if (!obj.admin.whatsapp) obj.admin.whatsapp = {};
  if (!obj.admin.whatsapp.userProfiles) obj.admin.whatsapp.userProfiles = {};
  const up = obj.admin.whatsapp.userProfiles;

  function ensure(parentKey, target) {
    if (!up[parentKey] || typeof up[parentKey] !== "object") up[parentKey] = {};
    for (const [k, v] of Object.entries(target)) {
      if (up[parentKey][k] !== v) {
        up[parentKey][k] = v;
        console.log(`[${lang}] admin.whatsapp.userProfiles.${parentKey}.${k} ← set`);
        totalAdded++;
      }
    }
  }

  // Düz key'ler
  for (const flatKey of ["searchPlaceholder", "noMatch"]) {
    if (up[flatKey] !== values[flatKey]) {
      up[flatKey] = values[flatKey];
      console.log(`[${lang}] admin.whatsapp.userProfiles.${flatKey} ← set`);
      totalAdded++;
    }
  }

  ensure("metrics", values.metrics);
  ensure("filter", values.filter);
  ensure("sort", values.sort);
  ensure("autoTags", values.autoTags);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
}

console.log(`\nTotal i18n structural changes: ${totalAdded}`);
