// OperationsSection + StickyMobileCTA için i18n key'leri 7 dile inject. İdempotent.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const T = {
  tr: {
    operations: {
      eyebrow: "Operasyon Yönetimi",
      title: "Sadece Chatbot Değil — Acentenizi Komple Yönetin",
      subtitle: "Rezervasyon geldikten sonra: koltuk, manifesto, kayıt, bakiye — hepsi tek panelde, kayıpsız ve hızlı.",
      cards: {
        seatPlan: { title: "Otobüs Koltuk Planı", desc: "2+2 ve 2+1 düzen, sürükle-bırak atama, orta kapı boşluğu, PDF çıktı." },
        manifest: { title: "Yolcu Listesi & Manifesto", desc: "PDF ve Excel çıktı, grup renklendirme, koşullu pasaport, bakiye satırı." },
        registration: { title: "Kayıt & Sefer Yönetimi", desc: "3 görünüm (liste/tur/sefer), zaman çizelgesi, hızlı düzenleme, filtreleme." },
        balance: { title: "Bakiye Takibi", desc: "Otomatik hesap, snapshot + canlı fallback, ödeme özeti, audit korunur." },
      },
      mockup: {
        url: "turzzai.com/admin · koltuk planı",
        tag: "Sefer", tour: "Pamukkale Turu", date: "12 Haz 2026",
        occupancy: "Doluluk", frontLabel: "Ön",
        actions: { pdf: "PDF", excel: "Excel", seatPlan: "Koltuk" },
      },
      cta: { primary: "14 Gün Ücretsiz Dene", secondary: "Demoyu İzle" },
    },
    stickyMobileCTA: { label: "14 Gün Ücretsiz Başla" },
  },
  en: {
    operations: {
      eyebrow: "Operations Management",
      title: "Not Just a Chatbot — Run Your Entire Agency",
      subtitle: "After the reservation arrives: seats, manifest, records, balance — all in one panel, lossless and fast.",
      cards: {
        seatPlan: { title: "Bus Seat Plan", desc: "2+2 and 2+1 layouts, drag-drop assignment, mid-door gap, PDF export." },
        manifest: { title: "Passenger List & Manifest", desc: "PDF and Excel export, group colors, conditional passport column, balance line." },
        registration: { title: "Registration & Departure Management", desc: "3 views (list/tour/departure), timeline, quick edit, filtering." },
        balance: { title: "Balance Tracking", desc: "Auto calculation, snapshot + live fallback, payment summary, audit preserved." },
      },
      mockup: {
        url: "turzzai.com/admin · seat plan",
        tag: "Trip", tour: "Pamukkale Tour", date: "Jun 12, 2026",
        occupancy: "Occupancy", frontLabel: "Front",
        actions: { pdf: "PDF", excel: "Excel", seatPlan: "Seats" },
      },
      cta: { primary: "Try 14 Days Free", secondary: "Watch Demo" },
    },
    stickyMobileCTA: { label: "Start 14-Day Free Trial" },
  },
  de: {
    operations: {
      eyebrow: "Betriebsverwaltung",
      title: "Nicht nur ein Chatbot — Verwalten Sie Ihre gesamte Agentur",
      subtitle: "Nach der Buchung: Sitze, Manifest, Datensätze, Saldo — alles in einem Panel, verlustfrei und schnell.",
      cards: {
        seatPlan: { title: "Bus-Sitzplan", desc: "2+2 und 2+1 Layouts, Drag-and-Drop, Mitteltür-Lücke, PDF-Export." },
        manifest: { title: "Passagierliste & Manifest", desc: "PDF- und Excel-Export, Gruppenfarben, bedingte Passport-Spalte, Saldozeile." },
        registration: { title: "Buchungs- & Abfahrtsverwaltung", desc: "3 Ansichten (Liste/Tour/Abfahrt), Zeitleiste, schnelle Bearbeitung, Filter." },
        balance: { title: "Saldoverfolgung", desc: "Automatische Berechnung, Snapshot + Live-Fallback, Zahlungsübersicht, Audit erhalten." },
      },
      mockup: {
        url: "turzzai.com/admin · Sitzplan",
        tag: "Reise", tour: "Pamukkale-Tour", date: "12. Juni 2026",
        occupancy: "Belegung", frontLabel: "Vorn",
        actions: { pdf: "PDF", excel: "Excel", seatPlan: "Sitze" },
      },
      cta: { primary: "14 Tage kostenlos testen", secondary: "Demo ansehen" },
    },
    stickyMobileCTA: { label: "14 Tage kostenlos starten" },
  },
  fr: {
    operations: {
      eyebrow: "Gestion des opérations",
      title: "Pas qu'un chatbot — Gérez toute votre agence",
      subtitle: "Après la réservation : sièges, manifeste, dossiers, solde — tout dans un seul panneau, sans perte et rapidement.",
      cards: {
        seatPlan: { title: "Plan de sièges du bus", desc: "Configurations 2+2 et 2+1, glisser-déposer, porte centrale, export PDF." },
        manifest: { title: "Liste des passagers & manifeste", desc: "Export PDF et Excel, couleurs de groupe, colonne passeport conditionnelle, ligne solde." },
        registration: { title: "Gestion des inscriptions & départs", desc: "3 vues (liste/tour/départ), chronologie, édition rapide, filtres." },
        balance: { title: "Suivi des soldes", desc: "Calcul automatique, snapshot + repli live, résumé de paiement, audit préservé." },
      },
      mockup: {
        url: "turzzai.com/admin · plan de sièges",
        tag: "Voyage", tour: "Circuit Pamukkale", date: "12 juin 2026",
        occupancy: "Occupation", frontLabel: "Avant",
        actions: { pdf: "PDF", excel: "Excel", seatPlan: "Sièges" },
      },
      cta: { primary: "Essayer 14 jours gratuits", secondary: "Voir la démo" },
    },
    stickyMobileCTA: { label: "Démarrer l'essai gratuit de 14 jours" },
  },
  es: {
    operations: {
      eyebrow: "Gestión de operaciones",
      title: "No solo un chatbot — Gestione toda su agencia",
      subtitle: "Después de la reserva: asientos, manifiesto, registros, saldo — todo en un solo panel, sin pérdidas y rápido.",
      cards: {
        seatPlan: { title: "Plano de asientos del autobús", desc: "Disposiciones 2+2 y 2+1, asignación con arrastrar-soltar, espacio puerta central, exportación PDF." },
        manifest: { title: "Lista de pasajeros y manifiesto", desc: "Exportación PDF y Excel, colores por grupo, columna de pasaporte condicional, línea de saldo." },
        registration: { title: "Gestión de reservas y salidas", desc: "3 vistas (lista/tour/salida), cronología, edición rápida, filtrado." },
        balance: { title: "Seguimiento de saldos", desc: "Cálculo automático, snapshot + respaldo en vivo, resumen de pago, auditoría preservada." },
      },
      mockup: {
        url: "turzzai.com/admin · plano de asientos",
        tag: "Viaje", tour: "Tour Pamukkale", date: "12 jun 2026",
        occupancy: "Ocupación", frontLabel: "Frente",
        actions: { pdf: "PDF", excel: "Excel", seatPlan: "Asientos" },
      },
      cta: { primary: "Probar 14 días gratis", secondary: "Ver demo" },
    },
    stickyMobileCTA: { label: "Comenzar prueba gratuita de 14 días" },
  },
  ru: {
    operations: {
      eyebrow: "Управление операциями",
      title: "Не просто чат-бот — управляйте всем агентством",
      subtitle: "После бронирования: места, манифест, записи, баланс — всё на одной панели, без потерь и быстро.",
      cards: {
        seatPlan: { title: "План мест автобуса", desc: "Раскладки 2+2 и 2+1, назначение перетаскиванием, средняя дверь, экспорт PDF." },
        manifest: { title: "Список пассажиров и манифест", desc: "Экспорт PDF и Excel, цвета групп, условный паспорт, строка баланса." },
        registration: { title: "Управление бронированиями и рейсами", desc: "3 представления (список/тур/рейс), хронология, быстрое редактирование, фильтры." },
        balance: { title: "Учёт остатков", desc: "Авторасчёт, снимок + живой резерв, сводка платежей, аудит сохранён." },
      },
      mockup: {
        url: "turzzai.com/admin · план мест",
        tag: "Рейс", tour: "Тур в Памуккале", date: "12 июн 2026",
        occupancy: "Заполнение", frontLabel: "Перед",
        actions: { pdf: "PDF", excel: "Excel", seatPlan: "Места" },
      },
      cta: { primary: "Попробовать 14 дней бесплатно", secondary: "Смотреть демо" },
    },
    stickyMobileCTA: { label: "Начать 14-дневный пробный период" },
  },
  ar: {
    operations: {
      eyebrow: "إدارة العمليات",
      title: "ليس مجرد روبوت دردشة — أدر وكالتك بالكامل",
      subtitle: "بعد الحجز: المقاعد، البيان، السجلات، الرصيد — كل ذلك في لوحة واحدة، بدون فقدان وبسرعة.",
      cards: {
        seatPlan: { title: "مخطط مقاعد الحافلة", desc: "تخطيط 2+2 و 2+1، تعيين بالسحب والإفلات، فجوة الباب الأوسط، تصدير PDF." },
        manifest: { title: "قائمة الركاب والبيان", desc: "تصدير PDF و Excel، ألوان المجموعات، عمود جواز سفر شرطي، سطر الرصيد." },
        registration: { title: "إدارة الحجوزات والرحلات", desc: "3 طرق عرض (قائمة/جولة/رحلة)، جدول زمني، تحرير سريع، تصفية." },
        balance: { title: "تتبع الأرصدة", desc: "حساب تلقائي، لقطة + بديل حي، ملخص الدفع، التدقيق محفوظ." },
      },
      mockup: {
        url: "turzzai.com/admin · مخطط المقاعد",
        tag: "رحلة", tour: "جولة باموكالي", date: "١٢ يونيو ٢٠٢٦",
        occupancy: "الإشغال", frontLabel: "الأمام",
        actions: { pdf: "PDF", excel: "Excel", seatPlan: "المقاعد" },
      },
      cta: { primary: "جرب 14 يوماً مجاناً", secondary: "شاهد العرض التوضيحي" },
    },
    stickyMobileCTA: { label: "ابدأ النسخة التجريبية المجانية 14 يوماً" },
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

for (const lang of Object.keys(T)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);
  deepInjectIfAbsent(obj, T[lang]);
  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] operations + stickyMobileCTA injected`);
}
