// CRM TUR 2 — yeni i18n key'leri 7 dile derin-enjekte et (idempotent).
// admin.whatsapp.userProfiles namespace altına:
//   tabs.activity, subTabs.{summary,messages}
//   summary.{loading, empty, emptyHint, dominantSentiment, totalDays,
//            messages, topics, mentionedTours, dailyBreakdown, sentiment.{positive,neutral,negative}}
//   activity.{title, description, empty, pax, feedbackSentDesc,
//             events.{message, registration, feedback_sent, feedback_received}}
//   actions.{menuLabel, pauseBot, resumeBot, botPausedToast, botResumedToast,
//            botPausedDesc, openWhatsApp, callPhone, copyContact, openTemplates,
//            copied, copyFailed, invalidPhone}
//   notes.{title, hint, placeholder, save, saved, savedToast}
//   contactTracking, emailLabel, marketingOptIn, marketingOptOut, emailNotCollected,
//   lastFeedbackSent, neverSent, botStatus, botActive, botPaused, botPausedUntil, until
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const TR = {
  tabs: { activity: "Aktivite" },
  subTabs: { summary: "AI Özeti", messages: "Tüm Mesajlar" },
  summary: {
    loading: "Özetler yükleniyor…",
    empty: "Henüz AI özeti yok.",
    emptyHint: "AI özetleri konuşma bittikten sonra otomatik üretilir.",
    dominantSentiment: "Genel Duygu",
    totalDays: "Özet günü",
    messages: "mesaj",
    topics: "Konular",
    mentionedTours: "Bahsedilen Turlar",
    dailyBreakdown: "Günlük Özetler",
    sentiment: { positive: "Olumlu", neutral: "Nötr", negative: "Olumsuz" },
  },
  activity: {
    title: "Aktivite Zaman Çizelgesi",
    description: "Mesajlar, rezervasyonlar ve anket olayları — tek kronolojik akış.",
    empty: "Henüz aktivite yok.",
    pax: "kişi",
    feedbackSentDesc: "Memnuniyet anketi gönderildi.",
    events: {
      message: "Mesaj",
      registration: "Rezervasyon",
      feedback_sent: "Anket Gönderildi",
      feedback_received: "Geri Bildirim Alındı",
    },
  },
  actions: {
    menuLabel: "Hızlı aksiyonlar",
    pauseBot: "Botu duraklat",
    resumeBot: "Botu başlat",
    botPausedToast: "Bot duraklatıldı",
    botResumedToast: "Bot başlatıldı",
    botPausedDesc: "Bot 24 saat boyunca bu müşteriye yanıt vermeyecek.",
    openWhatsApp: "WhatsApp'ta aç",
    callPhone: "Telefonu ara",
    copyContact: "İletişimi kopyala",
    openTemplates: "Şablonlar sayfasına git",
    copied: "Kopyalandı",
    copyFailed: "Kopyalanamadı.",
    invalidPhone: "Geçersiz telefon numarası.",
  },
  notes: {
    title: "Müşteri Notu",
    hint: "Yalnızca acentenize görünür — müşteri görmez.",
    placeholder: "Bu müşteri hakkında özel not… (örn. tercih, geçmiş anlaşma, dikkat edilecek konu)",
    save: "Kaydet",
    saved: "Kaydedildi",
    savedToast: "Not kaydedildi",
  },
  contactTracking: "İletişim & Takip",
  emailLabel: "E-posta",
  marketingOptIn: "Pazarlama izinli",
  marketingOptOut: "Pazarlama izni yok",
  emailNotCollected: "Henüz toplanmamış",
  lastFeedbackSent: "Son anket",
  neverSent: "Henüz gönderilmedi",
  botStatus: "Bot durumu",
  botActive: "Aktif",
  botPaused: "Duraklatıldı",
  botPausedUntil: "Bot duraklatıldı",
  until: "Kadar:",
};

const EN = {
  tabs: { activity: "Activity" },
  subTabs: { summary: "AI Summary", messages: "All Messages" },
  summary: {
    loading: "Loading summaries…",
    empty: "No AI summaries yet.",
    emptyHint: "AI summaries are generated automatically after conversations.",
    dominantSentiment: "Overall Sentiment",
    totalDays: "Summary days",
    messages: "messages",
    topics: "Topics",
    mentionedTours: "Mentioned Tours",
    dailyBreakdown: "Daily Breakdown",
    sentiment: { positive: "Positive", neutral: "Neutral", negative: "Negative" },
  },
  activity: {
    title: "Activity Timeline",
    description: "Messages, bookings and survey events — single chronological feed.",
    empty: "No activity yet.",
    pax: "pax",
    feedbackSentDesc: "Satisfaction survey was sent.",
    events: {
      message: "Message",
      registration: "Booking",
      feedback_sent: "Survey Sent",
      feedback_received: "Feedback Received",
    },
  },
  actions: {
    menuLabel: "Quick actions",
    pauseBot: "Pause bot",
    resumeBot: "Resume bot",
    botPausedToast: "Bot paused",
    botResumedToast: "Bot resumed",
    botPausedDesc: "The bot will not reply to this customer for 24 hours.",
    openWhatsApp: "Open in WhatsApp",
    callPhone: "Call phone",
    copyContact: "Copy contact",
    openTemplates: "Go to templates",
    copied: "Copied",
    copyFailed: "Copy failed.",
    invalidPhone: "Invalid phone number.",
  },
  notes: {
    title: "Customer Note",
    hint: "Visible only to your agency — the customer cannot see this.",
    placeholder: "Private note about this customer… (e.g. preferences, past deals, things to watch)",
    save: "Save",
    saved: "Saved",
    savedToast: "Note saved",
  },
  contactTracking: "Contact & Tracking",
  emailLabel: "Email",
  marketingOptIn: "Marketing opt-in",
  marketingOptOut: "No marketing consent",
  emailNotCollected: "Not collected yet",
  lastFeedbackSent: "Last survey",
  neverSent: "Never sent",
  botStatus: "Bot status",
  botActive: "Active",
  botPaused: "Paused",
  botPausedUntil: "Bot paused",
  until: "Until:",
};

const DE = {
  tabs: { activity: "Aktivität" },
  subTabs: { summary: "KI-Zusammenfassung", messages: "Alle Nachrichten" },
  summary: {
    loading: "Zusammenfassungen werden geladen…",
    empty: "Noch keine KI-Zusammenfassungen.",
    emptyHint: "KI-Zusammenfassungen werden nach Gesprächen automatisch erstellt.",
    dominantSentiment: "Gesamtstimmung",
    totalDays: "Zusammenfassungstage",
    messages: "Nachrichten",
    topics: "Themen",
    mentionedTours: "Erwähnte Touren",
    dailyBreakdown: "Tägliche Zusammenfassung",
    sentiment: { positive: "Positiv", neutral: "Neutral", negative: "Negativ" },
  },
  activity: {
    title: "Aktivitätsverlauf",
    description: "Nachrichten, Buchungen und Umfragen — ein einziger chronologischer Feed.",
    empty: "Noch keine Aktivität.",
    pax: "Pers.",
    feedbackSentDesc: "Zufriedenheitsumfrage wurde gesendet.",
    events: {
      message: "Nachricht",
      registration: "Buchung",
      feedback_sent: "Umfrage gesendet",
      feedback_received: "Feedback erhalten",
    },
  },
  actions: {
    menuLabel: "Schnellaktionen",
    pauseBot: "Bot pausieren",
    resumeBot: "Bot fortsetzen",
    botPausedToast: "Bot pausiert",
    botResumedToast: "Bot fortgesetzt",
    botPausedDesc: "Der Bot wird diesem Kunden 24 Stunden lang nicht antworten.",
    openWhatsApp: "In WhatsApp öffnen",
    callPhone: "Telefon anrufen",
    copyContact: "Kontakt kopieren",
    openTemplates: "Zu Vorlagen gehen",
    copied: "Kopiert",
    copyFailed: "Kopieren fehlgeschlagen.",
    invalidPhone: "Ungültige Telefonnummer.",
  },
  notes: {
    title: "Kundennotiz",
    hint: "Nur für Ihre Agentur sichtbar — der Kunde sieht das nicht.",
    placeholder: "Private Notiz zu diesem Kunden… (z. B. Vorlieben, vergangene Vereinbarungen, zu beachtende Punkte)",
    save: "Speichern",
    saved: "Gespeichert",
    savedToast: "Notiz gespeichert",
  },
  contactTracking: "Kontakt & Tracking",
  emailLabel: "E-Mail",
  marketingOptIn: "Marketing erlaubt",
  marketingOptOut: "Kein Marketing-Einverständnis",
  emailNotCollected: "Noch nicht erfasst",
  lastFeedbackSent: "Letzte Umfrage",
  neverSent: "Noch nie gesendet",
  botStatus: "Bot-Status",
  botActive: "Aktiv",
  botPaused: "Pausiert",
  botPausedUntil: "Bot pausiert",
  until: "Bis:",
};

const FR = {
  tabs: { activity: "Activité" },
  subTabs: { summary: "Résumé IA", messages: "Tous les messages" },
  summary: {
    loading: "Chargement des résumés…",
    empty: "Aucun résumé IA pour le moment.",
    emptyHint: "Les résumés IA sont générés automatiquement après les conversations.",
    dominantSentiment: "Sentiment global",
    totalDays: "Jours de résumé",
    messages: "messages",
    topics: "Sujets",
    mentionedTours: "Circuits mentionnés",
    dailyBreakdown: "Détail quotidien",
    sentiment: { positive: "Positif", neutral: "Neutre", negative: "Négatif" },
  },
  activity: {
    title: "Chronologie d'activité",
    description: "Messages, réservations et événements de sondage — un seul flux chronologique.",
    empty: "Aucune activité pour le moment.",
    pax: "pers.",
    feedbackSentDesc: "Enquête de satisfaction envoyée.",
    events: {
      message: "Message",
      registration: "Réservation",
      feedback_sent: "Enquête envoyée",
      feedback_received: "Retour reçu",
    },
  },
  actions: {
    menuLabel: "Actions rapides",
    pauseBot: "Mettre le bot en pause",
    resumeBot: "Réactiver le bot",
    botPausedToast: "Bot en pause",
    botResumedToast: "Bot réactivé",
    botPausedDesc: "Le bot ne répondra pas à ce client pendant 24 heures.",
    openWhatsApp: "Ouvrir dans WhatsApp",
    callPhone: "Appeler le téléphone",
    copyContact: "Copier le contact",
    openTemplates: "Aller aux modèles",
    copied: "Copié",
    copyFailed: "Copie échouée.",
    invalidPhone: "Numéro de téléphone invalide.",
  },
  notes: {
    title: "Note client",
    hint: "Visible uniquement par votre agence — le client ne la voit pas.",
    placeholder: "Note privée sur ce client… (ex. préférences, accords passés, points d'attention)",
    save: "Enregistrer",
    saved: "Enregistré",
    savedToast: "Note enregistrée",
  },
  contactTracking: "Contact & Suivi",
  emailLabel: "E-mail",
  marketingOptIn: "Marketing autorisé",
  marketingOptOut: "Pas de consentement marketing",
  emailNotCollected: "Pas encore collecté",
  lastFeedbackSent: "Dernière enquête",
  neverSent: "Jamais envoyée",
  botStatus: "État du bot",
  botActive: "Actif",
  botPaused: "En pause",
  botPausedUntil: "Bot en pause",
  until: "Jusqu'à :",
};

const ES = {
  tabs: { activity: "Actividad" },
  subTabs: { summary: "Resumen IA", messages: "Todos los mensajes" },
  summary: {
    loading: "Cargando resúmenes…",
    empty: "Aún no hay resúmenes IA.",
    emptyHint: "Los resúmenes IA se generan automáticamente tras las conversaciones.",
    dominantSentiment: "Sentimiento general",
    totalDays: "Días resumidos",
    messages: "mensajes",
    topics: "Temas",
    mentionedTours: "Tours mencionados",
    dailyBreakdown: "Resumen diario",
    sentiment: { positive: "Positivo", neutral: "Neutral", negative: "Negativo" },
  },
  activity: {
    title: "Línea de actividad",
    description: "Mensajes, reservas y eventos de encuesta — un único flujo cronológico.",
    empty: "Aún no hay actividad.",
    pax: "pers.",
    feedbackSentDesc: "Se envió la encuesta de satisfacción.",
    events: {
      message: "Mensaje",
      registration: "Reserva",
      feedback_sent: "Encuesta enviada",
      feedback_received: "Comentario recibido",
    },
  },
  actions: {
    menuLabel: "Acciones rápidas",
    pauseBot: "Pausar bot",
    resumeBot: "Reanudar bot",
    botPausedToast: "Bot pausado",
    botResumedToast: "Bot reanudado",
    botPausedDesc: "El bot no responderá a este cliente durante 24 horas.",
    openWhatsApp: "Abrir en WhatsApp",
    callPhone: "Llamar al teléfono",
    copyContact: "Copiar contacto",
    openTemplates: "Ir a plantillas",
    copied: "Copiado",
    copyFailed: "No se pudo copiar.",
    invalidPhone: "Número de teléfono no válido.",
  },
  notes: {
    title: "Nota del cliente",
    hint: "Solo visible para tu agencia — el cliente no la ve.",
    placeholder: "Nota privada sobre este cliente… (p. ej. preferencias, acuerdos pasados, puntos a vigilar)",
    save: "Guardar",
    saved: "Guardado",
    savedToast: "Nota guardada",
  },
  contactTracking: "Contacto y seguimiento",
  emailLabel: "Correo",
  marketingOptIn: "Marketing permitido",
  marketingOptOut: "Sin consentimiento de marketing",
  emailNotCollected: "Aún no recogido",
  lastFeedbackSent: "Última encuesta",
  neverSent: "Nunca enviada",
  botStatus: "Estado del bot",
  botActive: "Activo",
  botPaused: "Pausado",
  botPausedUntil: "Bot pausado",
  until: "Hasta:",
};

const RU = {
  tabs: { activity: "Активность" },
  subTabs: { summary: "ИИ-обзор", messages: "Все сообщения" },
  summary: {
    loading: "Загрузка обзоров…",
    empty: "Пока нет ИИ-обзоров.",
    emptyHint: "ИИ-обзоры создаются автоматически после диалога.",
    dominantSentiment: "Общая тональность",
    totalDays: "Дней с обзорами",
    messages: "сообщений",
    topics: "Темы",
    mentionedTours: "Упомянутые туры",
    dailyBreakdown: "Подневный обзор",
    sentiment: { positive: "Положительная", neutral: "Нейтральная", negative: "Отрицательная" },
  },
  activity: {
    title: "Хронология активности",
    description: "Сообщения, бронирования и опросы — единая хронологическая лента.",
    empty: "Пока нет активности.",
    pax: "чел.",
    feedbackSentDesc: "Отправлен опрос удовлетворённости.",
    events: {
      message: "Сообщение",
      registration: "Бронирование",
      feedback_sent: "Опрос отправлен",
      feedback_received: "Отзыв получен",
    },
  },
  actions: {
    menuLabel: "Быстрые действия",
    pauseBot: "Приостановить бота",
    resumeBot: "Возобновить бота",
    botPausedToast: "Бот приостановлен",
    botResumedToast: "Бот возобновлён",
    botPausedDesc: "Бот не будет отвечать этому клиенту 24 часа.",
    openWhatsApp: "Открыть в WhatsApp",
    callPhone: "Позвонить",
    copyContact: "Копировать контакт",
    openTemplates: "Перейти к шаблонам",
    copied: "Скопировано",
    copyFailed: "Не удалось скопировать.",
    invalidPhone: "Некорректный номер телефона.",
  },
  notes: {
    title: "Заметка о клиенте",
    hint: "Видна только вашему агентству — клиент её не видит.",
    placeholder: "Личная заметка об этом клиенте… (напр. предпочтения, прошлые договорённости, на что обратить внимание)",
    save: "Сохранить",
    saved: "Сохранено",
    savedToast: "Заметка сохранена",
  },
  contactTracking: "Контакты и отслеживание",
  emailLabel: "Эл. почта",
  marketingOptIn: "Маркетинг разрешён",
  marketingOptOut: "Согласие на маркетинг отсутствует",
  emailNotCollected: "Ещё не собрано",
  lastFeedbackSent: "Последний опрос",
  neverSent: "Не отправлялся",
  botStatus: "Статус бота",
  botActive: "Активен",
  botPaused: "Приостановлен",
  botPausedUntil: "Бот приостановлен",
  until: "До:",
};

const AR = {
  tabs: { activity: "النشاط" },
  subTabs: { summary: "ملخص الذكاء الاصطناعي", messages: "كل الرسائل" },
  summary: {
    loading: "يتم تحميل الملخصات…",
    empty: "لا توجد ملخصات بعد.",
    emptyHint: "تُنشأ ملخصات الذكاء الاصطناعي تلقائيًا بعد المحادثات.",
    dominantSentiment: "الشعور العام",
    totalDays: "أيام الملخص",
    messages: "رسالة",
    topics: "المواضيع",
    mentionedTours: "الجولات المذكورة",
    dailyBreakdown: "الملخص اليومي",
    sentiment: { positive: "إيجابي", neutral: "محايد", negative: "سلبي" },
  },
  activity: {
    title: "الجدول الزمني للنشاط",
    description: "الرسائل والحجوزات وأحداث الاستطلاع — تدفق زمني واحد.",
    empty: "لا يوجد نشاط بعد.",
    pax: "شخص",
    feedbackSentDesc: "تم إرسال استطلاع الرضا.",
    events: {
      message: "رسالة",
      registration: "حجز",
      feedback_sent: "تم إرسال الاستطلاع",
      feedback_received: "تم استلام التعليق",
    },
  },
  actions: {
    menuLabel: "إجراءات سريعة",
    pauseBot: "إيقاف البوت مؤقتًا",
    resumeBot: "استئناف البوت",
    botPausedToast: "تم إيقاف البوت مؤقتًا",
    botResumedToast: "تم استئناف البوت",
    botPausedDesc: "لن يرد البوت على هذا العميل خلال 24 ساعة.",
    openWhatsApp: "فتح في WhatsApp",
    callPhone: "اتصال هاتفي",
    copyContact: "نسخ جهة الاتصال",
    openTemplates: "الذهاب إلى القوالب",
    copied: "تم النسخ",
    copyFailed: "فشل النسخ.",
    invalidPhone: "رقم هاتف غير صالح.",
  },
  notes: {
    title: "ملاحظة العميل",
    hint: "مرئية فقط لوكالتك — العميل لا يراها.",
    placeholder: "ملاحظة خاصة عن هذا العميل… (مثل التفضيلات والاتفاقيات السابقة والنقاط التي يجب مراقبتها)",
    save: "حفظ",
    saved: "تم الحفظ",
    savedToast: "تم حفظ الملاحظة",
  },
  contactTracking: "التواصل والمتابعة",
  emailLabel: "البريد الإلكتروني",
  marketingOptIn: "تسويق مسموح",
  marketingOptOut: "لا يوجد إذن تسويق",
  emailNotCollected: "لم يتم جمعه بعد",
  lastFeedbackSent: "آخر استطلاع",
  neverSent: "لم يُرسل أبدًا",
  botStatus: "حالة البوت",
  botActive: "نشط",
  botPaused: "متوقف",
  botPausedUntil: "البوت متوقف",
  until: "حتى:",
};

const LANG_VALUES = { tr: TR, en: EN, de: DE, fr: FR, es: ES, ru: RU, ar: AR };

// Derin merge — sadece yoksa veya farklıysa yaz
function deepSet(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepSet(target[k], v);
    } else {
      if (target[k] !== v) {
        target[k] = v;
        changes++;
      }
    }
  }
}

let changes = 0;
for (const [lang, values] of Object.entries(LANG_VALUES)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.admin) obj.admin = {};
  if (!obj.admin.whatsapp) obj.admin.whatsapp = {};
  if (!obj.admin.whatsapp.userProfiles) obj.admin.whatsapp.userProfiles = {};

  const before = changes;
  deepSet(obj.admin.whatsapp.userProfiles, values);
  console.log(`[${lang}] ${changes - before} keys set`);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
}

console.log(`\nTotal TUR 2 i18n changes: ${changes}`);
