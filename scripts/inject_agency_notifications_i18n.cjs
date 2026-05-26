// One-shot script: 6 dil dosyasına agency.notifications.* + whatsapp.tabs.notifications inject.
// TR'ye elle eklendi; bu script tr.json'a DOKUNMAZ. Idempotent — tekrar çalıştırılabilir.
// Çalıştırma: node scripts/inject_agency_notifications_i18n.cjs

const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const TRANSLATIONS = {
  en: {
    whatsappTab: "Notification Settings",
    agency: {
      notifications: {
        title: "Notification Settings",
        description: "Receive new reservation and support/complaint notifications from Turzz's WhatsApp number. Manage your notification number and which events to receive.",
        enabledLabel: "Enable notifications",
        enabledHint: "No notifications are sent while turned off.",
        phoneLabel: "Notification Phone",
        phoneHint: "Enter the number where your WhatsApp app is registered (E.164: +90..., +49...).",
        invalidPhone: "Phone must be in E.164 format (+ country code, then digits).",
        eventsLabel: "Notification Types",
        events: {
          new_reservation: "New Reservation",
          new_support: "Support & Complaint",
        },
        eventReservationHint: "Get notified when a new reservation is created in your system.",
        eventSupportHint: "Get notified when a customer sends a support/complaint via WhatsApp.",
        disabledBanner: "Notifications are off. No notifications will be sent until you enable them.",
        saved: "Notification settings saved.",
        historyTitle: "Notification History",
        historyDescription: "Recent notifications sent to you. Up to 50 most recent records.",
        historyEmpty: "No notifications sent yet.",
        statusSuccess: "Success",
        statusFail: "Failed",
        col: {
          sentAt: "Time",
          event: "Event",
          phone: "Phone",
          status: "Status",
          error: "Error",
        },
      },
    },
  },
  de: {
    whatsappTab: "Benachrichtigungen",
    agency: {
      notifications: {
        title: "Benachrichtigungseinstellungen",
        description: "Erhalten Sie Benachrichtigungen über neue Buchungen und Anfragen/Beschwerden von der WhatsApp-Nummer von Turzz. Verwalten Sie hier Ihre Benachrichtigungsnummer und welche Ereignisse empfangen werden sollen.",
        enabledLabel: "Benachrichtigungen aktivieren",
        enabledHint: "Wenn deaktiviert, werden keine Benachrichtigungen gesendet.",
        phoneLabel: "Benachrichtigungsnummer",
        phoneHint: "Geben Sie die Nummer ein, bei der Ihre WhatsApp-App registriert ist (E.164: +90..., +49...).",
        invalidPhone: "Telefon muss im E.164-Format sein (+ Ländercode, dann Ziffern).",
        eventsLabel: "Benachrichtigungstypen",
        events: {
          new_reservation: "Neue Buchung",
          new_support: "Anfrage & Beschwerde",
        },
        eventReservationHint: "Erhalten Sie eine Benachrichtigung, wenn eine neue Buchung eingeht.",
        eventSupportHint: "Erhalten Sie eine Benachrichtigung, wenn ein Kunde eine Anfrage/Beschwerde über WhatsApp sendet.",
        disabledBanner: "Benachrichtigungen sind aus. Bis Sie sie aktivieren, werden keine Benachrichtigungen gesendet.",
        saved: "Benachrichtigungseinstellungen gespeichert.",
        historyTitle: "Benachrichtigungsverlauf",
        historyDescription: "Letzte an Sie gesendete Benachrichtigungen. Bis zu 50 neueste Einträge.",
        historyEmpty: "Noch keine Benachrichtigungen gesendet.",
        statusSuccess: "Erfolgreich",
        statusFail: "Fehlgeschlagen",
        col: {
          sentAt: "Zeit",
          event: "Ereignis",
          phone: "Nummer",
          status: "Status",
          error: "Fehler",
        },
      },
    },
  },
  fr: {
    whatsappTab: "Notifications",
    agency: {
      notifications: {
        title: "Paramètres de notification",
        description: "Recevez des notifications de nouvelles réservations et demandes/plaintes depuis le numéro WhatsApp de Turzz. Gérez ici votre numéro de notification et les événements à recevoir.",
        enabledLabel: "Activer les notifications",
        enabledHint: "Aucune notification n'est envoyée lorsque désactivé.",
        phoneLabel: "Numéro de notification",
        phoneHint: "Saisissez le numéro auquel votre application WhatsApp est associée (E.164 : +90..., +49...).",
        invalidPhone: "Le téléphone doit être au format E.164 (+ indicatif pays, puis chiffres).",
        eventsLabel: "Types de notification",
        events: {
          new_reservation: "Nouvelle Réservation",
          new_support: "Demande & Plainte",
        },
        eventReservationHint: "Soyez averti lorsqu'une nouvelle réservation est créée dans votre système.",
        eventSupportHint: "Soyez averti lorsqu'un client envoie une demande/plainte via WhatsApp.",
        disabledBanner: "Les notifications sont désactivées. Aucune notification ne sera envoyée jusqu'à ce que vous les activiez.",
        saved: "Paramètres de notification enregistrés.",
        historyTitle: "Historique des notifications",
        historyDescription: "Notifications récentes envoyées. Jusqu'à 50 enregistrements les plus récents.",
        historyEmpty: "Aucune notification envoyée.",
        statusSuccess: "Réussi",
        statusFail: "Échec",
        col: {
          sentAt: "Heure",
          event: "Événement",
          phone: "Numéro",
          status: "État",
          error: "Erreur",
        },
      },
    },
  },
  es: {
    whatsappTab: "Notificaciones",
    agency: {
      notifications: {
        title: "Configuración de notificaciones",
        description: "Reciba notificaciones de nuevas reservas y solicitudes/quejas desde el número de WhatsApp de Turzz. Gestione su número de notificación y qué eventos recibir.",
        enabledLabel: "Activar notificaciones",
        enabledHint: "Cuando está desactivado, no se envía ninguna notificación.",
        phoneLabel: "Número de Notificación",
        phoneHint: "Ingrese el número en el que está registrada su aplicación WhatsApp (E.164: +90..., +49...).",
        invalidPhone: "El teléfono debe estar en formato E.164 (+ código de país, luego dígitos).",
        eventsLabel: "Tipos de notificación",
        events: {
          new_reservation: "Nueva Reserva",
          new_support: "Solicitud y Queja",
        },
        eventReservationHint: "Reciba una notificación cuando se cree una nueva reserva en su sistema.",
        eventSupportHint: "Reciba una notificación cuando un cliente envíe una solicitud/queja por WhatsApp.",
        disabledBanner: "Las notificaciones están desactivadas. No se enviará ninguna notificación hasta que las active.",
        saved: "Configuración de notificaciones guardada.",
        historyTitle: "Historial de Notificaciones",
        historyDescription: "Notificaciones recientes enviadas a usted. Hasta 50 registros más recientes.",
        historyEmpty: "Aún no se han enviado notificaciones.",
        statusSuccess: "Exitoso",
        statusFail: "Fallido",
        col: {
          sentAt: "Hora",
          event: "Evento",
          phone: "Número",
          status: "Estado",
          error: "Error",
        },
      },
    },
  },
  ru: {
    whatsappTab: "Уведомления",
    agency: {
      notifications: {
        title: "Настройки уведомлений",
        description: "Получайте уведомления о новых бронированиях и обращениях/жалобах с номера WhatsApp Turzz. Управляйте номером для уведомлений и какие события получать.",
        enabledLabel: "Включить уведомления",
        enabledHint: "Когда выключено, уведомления не отправляются.",
        phoneLabel: "Номер для уведомлений",
        phoneHint: "Введите номер, к которому привязано ваше приложение WhatsApp (E.164: +90..., +49...).",
        invalidPhone: "Телефон должен быть в формате E.164 (+ код страны, затем цифры).",
        eventsLabel: "Типы уведомлений",
        events: {
          new_reservation: "Новое Бронирование",
          new_support: "Обращение и Жалоба",
        },
        eventReservationHint: "Получайте уведомление при создании нового бронирования в системе.",
        eventSupportHint: "Получайте уведомление, когда клиент отправляет обращение/жалобу через WhatsApp.",
        disabledBanner: "Уведомления выключены. До их включения никакие уведомления не отправляются.",
        saved: "Настройки уведомлений сохранены.",
        historyTitle: "История уведомлений",
        historyDescription: "Последние отправленные вам уведомления. До 50 последних записей.",
        historyEmpty: "Уведомления пока не отправлялись.",
        statusSuccess: "Успешно",
        statusFail: "Не удалось",
        col: {
          sentAt: "Время",
          event: "Событие",
          phone: "Номер",
          status: "Статус",
          error: "Ошибка",
        },
      },
    },
  },
  ar: {
    whatsappTab: "الإشعارات",
    agency: {
      notifications: {
        title: "إعدادات الإشعارات",
        description: "احصل على إشعارات الحجوزات الجديدة والطلبات/الشكاوى من رقم WhatsApp الخاص بـ Turzz. أدر هنا رقم الإشعارات والأحداث التي تتلقاها.",
        enabledLabel: "تفعيل الإشعارات",
        enabledHint: "عند إيقافها، لا تُرسل أي إشعارات.",
        phoneLabel: "رقم الإشعارات",
        phoneHint: "أدخل الرقم المرتبط بتطبيق WhatsApp الخاص بك (E.164: +90...، +49...).",
        invalidPhone: "يجب أن يكون الهاتف بتنسيق E.164 (+ رمز الدولة، ثم الأرقام).",
        eventsLabel: "أنواع الإشعارات",
        events: {
          new_reservation: "حجز جديد",
          new_support: "طلب وشكوى",
        },
        eventReservationHint: "احصل على إشعار عند إنشاء حجز جديد في نظامك.",
        eventSupportHint: "احصل على إشعار عندما يرسل العميل طلبًا/شكوى عبر WhatsApp.",
        disabledBanner: "الإشعارات متوقفة. لن تُرسل أي إشعارات حتى تفعّلها.",
        saved: "تم حفظ إعدادات الإشعارات.",
        historyTitle: "سجل الإشعارات",
        historyDescription: "آخر الإشعارات المرسلة إليك. حتى 50 سجلًا.",
        historyEmpty: "لم تُرسل أي إشعارات بعد.",
        statusSuccess: "نجح",
        statusFail: "فشل",
        col: {
          sentAt: "الوقت",
          event: "الحدث",
          phone: "الرقم",
          status: "الحالة",
          error: "الخطأ",
        },
      },
    },
  },
};

function inject(lang) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  // BOM strip (mevcut dosyalarda BOM olabilir)
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const data = hasBom ? raw.slice(1) : raw;
  const obj = JSON.parse(data);
  const tr = TRANSLATIONS[lang];

  // 1) whatsapp.tabs.notifications — root-level whatsapp.tabs blok'una ekle
  if (obj.whatsapp && obj.whatsapp.tabs && typeof obj.whatsapp.tabs === "object") {
    if (!obj.whatsapp.tabs.notifications) {
      obj.whatsapp.tabs.notifications = tr.whatsappTab;
    }
  } else {
    console.warn(`[${lang}] whatsapp.tabs path missing — skipped tab key`);
  }

  // 2) agency.notifications.* — root-level agency.notifications namespace'i
  //    Eğer root'ta agency varsa ve nested ise birleştir; yoksa oluştur.
  if (!obj.agency || typeof obj.agency !== "object") {
    obj.agency = {};
  }
  // Idempotent merge — mevcut anahtarları üzerine yazma
  obj.agency.notifications = { ...(obj.agency.notifications || {}), ...tr.agency.notifications };
  // events nested — manuel merge
  obj.agency.notifications.events = {
    ...((obj.agency.notifications && obj.agency.notifications.events) || {}),
    ...tr.agency.notifications.events,
  };
  obj.agency.notifications.col = {
    ...((obj.agency.notifications && obj.agency.notifications.col) || {}),
    ...tr.agency.notifications.col,
  };

  // Yaz — orijinal indentation 2-space, BOM korunur
  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] injected (whatsapp.tabs.notifications + agency.notifications.*)`);
}

for (const lang of Object.keys(TRANSLATIONS)) {
  try {
    inject(lang);
  } catch (e) {
    console.error(`[${lang}] FAILED:`, e.message);
    process.exitCode = 1;
  }
}
