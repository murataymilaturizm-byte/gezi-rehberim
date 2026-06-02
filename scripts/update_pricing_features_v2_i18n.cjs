// Pricing özellik listesi sadeleştirme/güçlendirme — 7 dil tek pas.
//   • Starter: 3 yeni key (manualReservation, bulkImport, supportChat),
//             basicFeatures SİL (operasyon araçlarıyla zaten kapsanıyor)
//   • Professional: 4 yeni key (includesStarter, smartCrm, automatedNotifications,
//                  advancedAnalytics), tours metni "50→30", userProfiles+reminders+
//                  analytics ESKİ key'leri SİL (yenilerle değiştirildi),
//                  seatPlan/passengerList/registrationMgmt/balanceTracking de SİL
//                  (artık includesStarter altında dolaylı kapsanıyor)
//   • Enterprise: 2 yeni key (includesProfessional, customDev), messages metni
//                "50.000 (yüksek hacim)", allProFeatures+feedback+multiAgency+
//                apiAccess+paymentCollection SİL (vaad edilen ama olmayan / Pro içinde)
//
// İdempotent — eksik/yanlış değerleri günceller, doğru olanları korur.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

// ──────────────────────────────────────────────────────────────────────────
// Yeni / güncellenmiş değerler (7 dil)
// ──────────────────────────────────────────────────────────────────────────
const NEW_VALUES = {
  tr: {
    starter: {
      languages: "💬 Tek dilde WhatsApp chatbot (7 dilden seçim)",
      style: "🎨 Kurumsal konuşma üslubu",
      manualReservation: "📝 Manuel rezervasyon ekleme",
      bulkImport: "📂 Excel'den toplu tur yükleme",
      supportChat: "🤖 7/24 AI destek asistanı",
    },
    professional: {
      includesStarter: "✨ Başlangıç paketindeki her şey, artı:",
      tours: "🗂️ 30 tura kadar",
      smartCrm: "👥 Akıllı CRM — Otomatik etiketleme (VIP/sürekli/potansiyel), tercih & harcama takibi, konuşma arşivi",
      automatedNotifications: "🔔 Otomatik tur hatırlatma + memnuniyet anketi (kendi şablonunuz, kendi zamanlamanız)",
      advancedAnalytics: "📊 Detaylı analitik — gelir, destinasyon ve dil bazlı performans",
    },
    enterprise: {
      includesProfessional: "✨ Profesyonel paketindeki her şey, artı:",
      messages: "💬 Aylık 50.000 mesaj (yüksek hacim)",
      customDev: "🛠️ Firmaya özel geliştirme",
    },
  },
  en: {
    starter: {
      languages: "💬 Single-language WhatsApp chatbot (choose 1 of 7)",
      style: "🎨 Corporate conversation style",
      manualReservation: "📝 Manual reservation entry",
      bulkImport: "📂 Bulk tour import from Excel",
      supportChat: "🤖 24/7 AI support assistant",
    },
    professional: {
      includesStarter: "✨ Everything in Starter, plus:",
      tours: "🗂️ Up to 30 tours",
      smartCrm: "👥 Smart CRM — Auto-tagging (VIP/regular/potential), preference & spending tracking, conversation archive",
      automatedNotifications: "🔔 Automated tour reminder + feedback survey (your template, your timing)",
      advancedAnalytics: "📊 Advanced analytics — revenue, destination and language performance",
    },
    enterprise: {
      includesProfessional: "✨ Everything in Professional, plus:",
      messages: "💬 50,000 messages/month (high volume)",
      customDev: "🛠️ Custom development for your company",
    },
  },
  de: {
    starter: {
      languages: "💬 Einsprachiger WhatsApp-Chatbot (1 von 7 Sprachen)",
      style: "🎨 Korporativer Gesprächsstil",
      manualReservation: "📝 Manuelle Reservierungseingabe",
      bulkImport: "📂 Massentour-Import aus Excel",
      supportChat: "🤖 24/7 KI-Support-Assistent",
    },
    professional: {
      includesStarter: "✨ Alles aus Starter, plus:",
      tours: "🗂️ Bis zu 30 Touren",
      smartCrm: "👥 Smart CRM — Auto-Tagging (VIP/regulär/potenziell), Präferenz- & Ausgabentracking, Gesprächsarchiv",
      automatedNotifications: "🔔 Automatische Tour-Erinnerung + Zufriedenheitsumfrage (Ihre Vorlage, Ihre Zeitplanung)",
      advancedAnalytics: "📊 Erweiterte Analysen — Umsatz, Ziel- und Sprachleistung",
    },
    enterprise: {
      includesProfessional: "✨ Alles aus Professional, plus:",
      messages: "💬 50.000 Nachrichten/Monat (hohes Volumen)",
      customDev: "🛠️ Maßgeschneiderte Entwicklung für Ihr Unternehmen",
    },
  },
  fr: {
    starter: {
      languages: "💬 Chatbot WhatsApp monolingue (1 langue parmi 7)",
      style: "🎨 Style de conversation corporatif",
      manualReservation: "📝 Saisie manuelle de réservation",
      bulkImport: "📂 Import groupé de circuits depuis Excel",
      supportChat: "🤖 Assistant support IA 24/7",
    },
    professional: {
      includesStarter: "✨ Tout dans Starter, plus :",
      tours: "🗂️ Jusqu'à 30 circuits",
      smartCrm: "👥 CRM intelligent — Étiquetage automatique (VIP/régulier/potentiel), suivi des préférences et dépenses, archive des conversations",
      automatedNotifications: "🔔 Rappel de circuit automatique + enquête de satisfaction (votre modèle, votre calendrier)",
      advancedAnalytics: "📊 Analyses avancées — revenus, destination et performance linguistique",
    },
    enterprise: {
      includesProfessional: "✨ Tout dans Professional, plus :",
      messages: "💬 50 000 messages/mois (volume élevé)",
      customDev: "🛠️ Développement sur mesure pour votre entreprise",
    },
  },
  es: {
    starter: {
      languages: "💬 Chatbot WhatsApp en un solo idioma (1 de 7)",
      style: "🎨 Estilo de conversación corporativo",
      manualReservation: "📝 Reserva manual",
      bulkImport: "📂 Importación masiva de tours desde Excel",
      supportChat: "🤖 Asistente de soporte IA 24/7",
    },
    professional: {
      includesStarter: "✨ Todo en Starter, más:",
      tours: "🗂️ Hasta 30 tours",
      smartCrm: "👥 CRM inteligente — Etiquetado automático (VIP/habitual/potencial), seguimiento de preferencias y gastos, archivo de conversaciones",
      automatedNotifications: "🔔 Recordatorio automático de tour + encuesta de satisfacción (tu plantilla, tu programación)",
      advancedAnalytics: "📊 Análisis avanzado — ingresos, destino y rendimiento por idioma",
    },
    enterprise: {
      includesProfessional: "✨ Todo en Professional, más:",
      messages: "💬 50.000 mensajes/mes (alto volumen)",
      customDev: "🛠️ Desarrollo personalizado para tu empresa",
    },
  },
  ru: {
    starter: {
      languages: "💬 Одноязычный WhatsApp-чатбот (1 из 7)",
      style: "🎨 Корпоративный стиль общения",
      manualReservation: "📝 Ручное добавление бронирования",
      bulkImport: "📂 Массовый импорт туров из Excel",
      supportChat: "🤖 ИИ-помощник поддержки 24/7",
    },
    professional: {
      includesStarter: "✨ Всё из Starter, плюс:",
      tours: "🗂️ До 30 туров",
      smartCrm: "👥 Умная CRM — Авто-теги (VIP/постоянный/потенциальный), отслеживание предпочтений и расходов, архив переписки",
      automatedNotifications: "🔔 Автоматическое напоминание о туре + опрос удовлетворённости (ваш шаблон, ваше расписание)",
      advancedAnalytics: "📊 Расширенная аналитика — доход, направление и языковая производительность",
    },
    enterprise: {
      includesProfessional: "✨ Всё из Professional, плюс:",
      messages: "💬 50 000 сообщений/мес (высокий объём)",
      customDev: "🛠️ Индивидуальная разработка для вашей компании",
    },
  },
  ar: {
    starter: {
      languages: "💬 روبوت WhatsApp بلغة واحدة (1 من 7)",
      style: "🎨 أسلوب محادثة مؤسسي",
      manualReservation: "📝 إضافة حجز يدوي",
      bulkImport: "📂 استيراد جولات بالجملة من Excel",
      supportChat: "🤖 مساعد دعم بالذكاء الاصطناعي 24/7",
    },
    professional: {
      includesStarter: "✨ كل ما في الباقة الأساسية، بالإضافة إلى:",
      tours: "🗂️ حتى 30 جولة",
      smartCrm: "👥 CRM ذكي — وسم تلقائي (VIP/منتظم/محتمل)، تتبع التفضيلات والإنفاق، أرشيف المحادثات",
      automatedNotifications: "🔔 تذكير تلقائي بالجولة + استطلاع رضا (قالبك الخاص، توقيتك)",
      advancedAnalytics: "📊 تحليلات متقدمة — الإيرادات والوجهة والأداء حسب اللغة",
    },
    enterprise: {
      includesProfessional: "✨ كل ما في Professional، بالإضافة إلى:",
      messages: "💬 50,000 رسالة/شهر (حجم عالٍ)",
      customDev: "🛠️ تطوير مخصص لشركتك",
    },
  },
};

// SİLİNECEK key'ler (artık kullanılmıyor)
const DELETE_KEYS = {
  starter: ["basicFeatures"],
  professional: ["userProfiles", "reminders", "analytics", "seatPlan", "passengerList", "registrationMgmt", "balanceTracking"],
  enterprise: ["allProFeatures", "feedback", "multiAgency", "apiAccess", "paymentCollection", "customStyles"],
};

let totalChanges = 0;
for (const lang of Object.keys(NEW_VALUES)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  // Pricing namespace güvenli kontrol
  if (!obj.pricing) obj.pricing = {};
  for (const plan of ["starter", "professional", "enterprise"]) {
    if (!obj.pricing[plan]) obj.pricing[plan] = {};
    if (!obj.pricing[plan].features) obj.pricing[plan].features = {};

    // YENİ / GÜNCELLENEN değerleri yaz (her durumda override — yenisi doğru)
    const newVals = NEW_VALUES[lang][plan] || {};
    for (const [k, v] of Object.entries(newVals)) {
      if (obj.pricing[plan].features[k] !== v) {
        obj.pricing[plan].features[k] = v;
        console.log(`[${lang}] pricing.${plan}.features.${k} ← updated`);
        totalChanges++;
      }
    }

    // SİL — eski kullanılmayan key'ler
    for (const delKey of DELETE_KEYS[plan]) {
      if (obj.pricing[plan].features[delKey] !== undefined) {
        delete obj.pricing[plan].features[delKey];
        console.log(`[${lang}] pricing.${plan}.features.${delKey} → DELETED`);
        totalChanges++;
      }
    }
  }

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
}

console.log(`\nTotal i18n structural changes: ${totalChanges}`);
