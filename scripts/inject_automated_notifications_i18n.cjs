// AutomatedNotificationsTab + MessageTemplates outer tabs için i18n key'leri 7 dile inject.
// İdempotent — eksik key'leri ekler, mevcut çevirileri ezmez.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const T = {
  tr: {
    whatsapp: { templates: { tabs: { templates: "Şablonlar", automated: "Otomatik Bildirimler" } } },
    automatedNotifications: {
      title: "Otomatik Bildirimler",
      description: "Müşterilerinize otomatik olarak tur hatırlatması ve memnuniyet anketi gönderin.",
      tourReminder: {
        title: "Tur Hatırlatma",
        description: "Tur başlangıcından önce müşterilerinize otomatik hatırlatma gönderin.",
      },
      feedbackSurvey: {
        title: "Memnuniyet Anketi",
        description: "Tur bitiminden sonra müşterilerinizden geri bildirim toplayın.",
      },
      timing: "Zaman",
      beforeTour: { h24: "1 gün önce", h48: "2 gün önce", h72: "3 gün önce (önerilen)" },
      afterTour: { h24: "1 gün sonra (ertesi gün)", h48: "2 gün sonra" },
      templateSelection: "Şablon Eşleştirmesi",
      templateSelectionHelp: "Her dil için kullanılacak şablonu seçin. Müşterinin dil tercihine göre uygun şablon gönderilir.",
      selectTemplate: "Şablon seçin...",
      noApprovedTemplates: "Otomatik bildirim göndermek için önce Meta Business hesabınızda bir şablon oluşturup onaylatın, sonra Şablonlar sekmesinden senkronize edin.",
      goToTemplates: "Şablonlar Sekmesine Git",
      enabledButNoMatch: "Bildirim açık ancak hiçbir dile şablon eşleştirilmemiş — kaydetmeden önce en az bir dil için şablon seçin.",
      upgradeRequired: "Profesyonel paket gerekli",
      enable: "Aktif",
      saved: "Ayarlar kaydedildi",
    },
  },
  en: {
    whatsapp: { templates: { tabs: { templates: "Templates", automated: "Automated Notifications" } } },
    automatedNotifications: {
      title: "Automated Notifications",
      description: "Automatically send tour reminders and feedback surveys to your customers.",
      tourReminder: {
        title: "Tour Reminder",
        description: "Send automatic reminders to your customers before the tour starts.",
      },
      feedbackSurvey: {
        title: "Feedback Survey",
        description: "Collect feedback from your customers after the tour ends.",
      },
      timing: "Timing",
      beforeTour: { h24: "1 day before", h48: "2 days before", h72: "3 days before (recommended)" },
      afterTour: { h24: "1 day after (next day)", h48: "2 days after" },
      templateSelection: "Template Mapping",
      templateSelectionHelp: "Select the template to use for each language. The appropriate template will be sent based on the customer's language preference.",
      selectTemplate: "Select template...",
      noApprovedTemplates: "To send automated notifications, first create and get approval for a template in your Meta Business account, then sync it from the Templates tab.",
      goToTemplates: "Go to Templates Tab",
      enabledButNoMatch: "Notification is enabled but no template is mapped for any language — select a template for at least one language before saving.",
      upgradeRequired: "Professional plan required",
      enable: "Enable",
      saved: "Settings saved",
    },
  },
  de: {
    whatsapp: { templates: { tabs: { templates: "Vorlagen", automated: "Automatische Benachrichtigungen" } } },
    automatedNotifications: {
      title: "Automatische Benachrichtigungen",
      description: "Senden Sie automatisch Tour-Erinnerungen und Zufriedenheitsumfragen an Ihre Kunden.",
      tourReminder: {
        title: "Tour-Erinnerung",
        description: "Senden Sie Ihren Kunden vor Tour-Beginn automatische Erinnerungen.",
      },
      feedbackSurvey: {
        title: "Zufriedenheitsumfrage",
        description: "Sammeln Sie nach Tour-Ende Feedback von Ihren Kunden.",
      },
      timing: "Zeitpunkt",
      beforeTour: { h24: "1 Tag vorher", h48: "2 Tage vorher", h72: "3 Tage vorher (empfohlen)" },
      afterTour: { h24: "1 Tag danach (am nächsten Tag)", h48: "2 Tage danach" },
      templateSelection: "Vorlagen-Zuordnung",
      templateSelectionHelp: "Wählen Sie die Vorlage für jede Sprache. Die passende Vorlage wird je nach Sprachpräferenz des Kunden gesendet.",
      selectTemplate: "Vorlage auswählen...",
      noApprovedTemplates: "Um automatische Benachrichtigungen zu senden, erstellen und genehmigen Sie zuerst eine Vorlage in Ihrem Meta Business-Konto und synchronisieren Sie sie über den Tab \"Vorlagen\".",
      goToTemplates: "Zum Vorlagen-Tab",
      enabledButNoMatch: "Benachrichtigung ist aktiviert, aber keine Vorlage ist einer Sprache zugeordnet — wählen Sie vor dem Speichern eine Vorlage für mindestens eine Sprache.",
      upgradeRequired: "Professional-Plan erforderlich",
      enable: "Aktivieren",
      saved: "Einstellungen gespeichert",
    },
  },
  fr: {
    whatsapp: { templates: { tabs: { templates: "Modèles", automated: "Notifications Automatiques" } } },
    automatedNotifications: {
      title: "Notifications Automatiques",
      description: "Envoyez automatiquement des rappels de tour et des enquêtes de satisfaction à vos clients.",
      tourReminder: {
        title: "Rappel de Tour",
        description: "Envoyez des rappels automatiques à vos clients avant le début du tour.",
      },
      feedbackSurvey: {
        title: "Enquête de Satisfaction",
        description: "Recueillez les commentaires de vos clients après la fin du tour.",
      },
      timing: "Moment",
      beforeTour: { h24: "1 jour avant", h48: "2 jours avant", h72: "3 jours avant (recommandé)" },
      afterTour: { h24: "1 jour après (le lendemain)", h48: "2 jours après" },
      templateSelection: "Association de Modèles",
      templateSelectionHelp: "Sélectionnez le modèle à utiliser pour chaque langue. Le modèle approprié sera envoyé selon la préférence linguistique du client.",
      selectTemplate: "Sélectionner un modèle...",
      noApprovedTemplates: "Pour envoyer des notifications automatiques, créez et faites approuver d'abord un modèle dans votre compte Meta Business, puis synchronisez-le depuis l'onglet Modèles.",
      goToTemplates: "Aller à l'onglet Modèles",
      enabledButNoMatch: "La notification est activée mais aucun modèle n'est associé à une langue — sélectionnez un modèle pour au moins une langue avant d'enregistrer.",
      upgradeRequired: "Plan Professionnel requis",
      enable: "Activer",
      saved: "Paramètres enregistrés",
    },
  },
  es: {
    whatsapp: { templates: { tabs: { templates: "Plantillas", automated: "Notificaciones Automáticas" } } },
    automatedNotifications: {
      title: "Notificaciones Automáticas",
      description: "Envíe automáticamente recordatorios de tour y encuestas de satisfacción a sus clientes.",
      tourReminder: {
        title: "Recordatorio de Tour",
        description: "Envíe recordatorios automáticos a sus clientes antes del inicio del tour.",
      },
      feedbackSurvey: {
        title: "Encuesta de Satisfacción",
        description: "Recopile comentarios de sus clientes después del final del tour.",
      },
      timing: "Momento",
      beforeTour: { h24: "1 día antes", h48: "2 días antes", h72: "3 días antes (recomendado)" },
      afterTour: { h24: "1 día después (al día siguiente)", h48: "2 días después" },
      templateSelection: "Asociación de Plantillas",
      templateSelectionHelp: "Seleccione la plantilla a usar para cada idioma. La plantilla apropiada se enviará según la preferencia de idioma del cliente.",
      selectTemplate: "Seleccionar plantilla...",
      noApprovedTemplates: "Para enviar notificaciones automáticas, primero cree y obtenga aprobación de una plantilla en su cuenta de Meta Business, luego sincronícela desde la pestaña Plantillas.",
      goToTemplates: "Ir a la pestaña Plantillas",
      enabledButNoMatch: "La notificación está activada pero no hay plantilla asociada a ningún idioma — seleccione una plantilla para al menos un idioma antes de guardar.",
      upgradeRequired: "Plan Profesional requerido",
      enable: "Activar",
      saved: "Configuración guardada",
    },
  },
  ru: {
    whatsapp: { templates: { tabs: { templates: "Шаблоны", automated: "Автоматические Уведомления" } } },
    automatedNotifications: {
      title: "Автоматические Уведомления",
      description: "Автоматически отправляйте напоминания о туре и опросы об удовлетворённости вашим клиентам.",
      tourReminder: {
        title: "Напоминание о Туре",
        description: "Отправляйте автоматические напоминания клиентам перед началом тура.",
      },
      feedbackSurvey: {
        title: "Опрос Удовлетворённости",
        description: "Собирайте отзывы клиентов после окончания тура.",
      },
      timing: "Время",
      beforeTour: { h24: "За 1 день", h48: "За 2 дня", h72: "За 3 дня (рекомендуется)" },
      afterTour: { h24: "Через 1 день (на следующий день)", h48: "Через 2 дня" },
      templateSelection: "Сопоставление Шаблонов",
      templateSelectionHelp: "Выберите шаблон для каждого языка. Подходящий шаблон будет отправлен согласно языковому предпочтению клиента.",
      selectTemplate: "Выбрать шаблон...",
      noApprovedTemplates: "Чтобы отправлять автоматические уведомления, сначала создайте и получите одобрение шаблона в вашем аккаунте Meta Business, затем синхронизируйте его на вкладке Шаблоны.",
      goToTemplates: "Перейти на вкладку Шаблоны",
      enabledButNoMatch: "Уведомление включено, но шаблон не сопоставлен ни с одним языком — выберите шаблон хотя бы для одного языка перед сохранением.",
      upgradeRequired: "Требуется план Professional",
      enable: "Включить",
      saved: "Настройки сохранены",
    },
  },
  ar: {
    whatsapp: { templates: { tabs: { templates: "القوالب", automated: "الإشعارات التلقائية" } } },
    automatedNotifications: {
      title: "الإشعارات التلقائية",
      description: "أرسل تذكيرات الجولة واستطلاعات الرضا تلقائيًا إلى عملائك.",
      tourReminder: {
        title: "تذكير الجولة",
        description: "أرسل تذكيرات تلقائية إلى عملائك قبل بدء الجولة.",
      },
      feedbackSurvey: {
        title: "استطلاع الرضا",
        description: "اجمع الملاحظات من عملائك بعد انتهاء الجولة.",
      },
      timing: "التوقيت",
      beforeTour: { h24: "قبل يوم واحد", h48: "قبل يومين", h72: "قبل 3 أيام (موصى به)" },
      afterTour: { h24: "بعد يوم (في اليوم التالي)", h48: "بعد يومين" },
      templateSelection: "ربط القوالب",
      templateSelectionHelp: "اختر القالب لاستخدامه لكل لغة. سيتم إرسال القالب المناسب حسب تفضيل لغة العميل.",
      selectTemplate: "اختر قالبًا...",
      noApprovedTemplates: "لإرسال الإشعارات التلقائية، أنشئ أولاً قالبًا في حساب Meta Business الخاص بك واحصل على الموافقة عليه، ثم قم بمزامنته من علامة تبويب القوالب.",
      goToTemplates: "الانتقال إلى علامة تبويب القوالب",
      enabledButNoMatch: "الإشعار مفعل ولكن لم يتم ربط أي قالب بأي لغة — اختر قالبًا للغة واحدة على الأقل قبل الحفظ.",
      upgradeRequired: "خطة Professional مطلوبة",
      enable: "تفعيل",
      saved: "تم حفظ الإعدادات",
    },
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

  // admin.automatedNotifications + admin.whatsapp.templates.tabs altına yaz
  if (!obj.admin) obj.admin = {};
  if (!obj.admin.automatedNotifications) obj.admin.automatedNotifications = {};
  if (!obj.admin.whatsapp) obj.admin.whatsapp = {};
  if (!obj.admin.whatsapp.templates) obj.admin.whatsapp.templates = {};
  if (!obj.admin.whatsapp.templates.tabs) obj.admin.whatsapp.templates.tabs = {};

  deepInjectIfAbsent(obj.admin.automatedNotifications, T[lang].automatedNotifications);
  deepInjectIfAbsent(obj.admin.whatsapp.templates.tabs, T[lang].whatsapp.templates.tabs);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] automatedNotifications + outer tabs injected`);
}
