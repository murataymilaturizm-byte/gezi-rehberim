// CRM TUR 3 — manuel düzenleme + sıfırdan ekleme i18n keys (7 dil, idempotent).
// admin.whatsapp.userProfiles namespace altına:
//   manualBadge, manualBadgeTooltip
//   autoTags.lead
//   filter.lead
//   edit.{title, description, fullNameLabel, fullNamePlaceholder, emailLabel,
//         emailHint, addName, savedToast, invalidEmail}
//   newCustomer.{button, title, description, phoneLabel, fullNameLabel,
//                fullNamePlaceholder, emailLabel, notesLabel, notesPlaceholder,
//                previewLabel, invalidPhone, invalidPhoneHint, duplicate,
//                duplicateDesc, botOptInNote, create, createdToast}
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const TR = {
  manualBadge: "Manuel",
  manualBadgeTooltip: "Manuel eklenen müşteri (acente CRM'den ekledi)",
  autoTags: { lead: "Lead" },
  filter: { lead: "Lead" },
  edit: {
    title: "Müşteri Bilgilerini Düzenle",
    description: "Ad ve e-posta bilgilerini güncelleyin. Bot bu değerleri sonradan ezmez.",
    fullNameLabel: "Tam Ad",
    fullNamePlaceholder: "Örn: Ahmet Yılmaz",
    emailLabel: "E-posta",
    emailHint: "Boş bırakırsanız kaldırılır.",
    addName: "İsim ekle",
    savedToast: "Müşteri bilgileri güncellendi",
    invalidEmail: "Geçersiz e-posta adresi",
  },
  newCustomer: {
    button: "Yeni Müşteri",
    title: "Yeni Müşteri Ekle",
    description: "Acentenizin tanıdığı müşteriyi CRM'e ekleyin.",
    phoneLabel: "Telefon",
    fullNameLabel: "Ad Soyad",
    fullNamePlaceholder: "Opsiyonel",
    emailLabel: "E-posta",
    notesLabel: "Not",
    notesPlaceholder: "Bu müşteri hakkında özel not (opsiyonel)",
    previewLabel: "Kaydedilecek format",
    invalidPhone: "Geçersiz telefon numarası",
    invalidPhoneHint: "Lütfen ülke kodu ile birlikte girin (örn. +90 532 ...)",
    duplicate: "Bu numara eklenemedi",
    duplicateDesc: "Aynı telefon zaten kayıtlı.",
    botOptInNote: "Bot bu müşteriye otomatik mesaj göndermez. İlk mesajı WhatsApp'tan kendiniz başlatın; müşteri cevap verince bot devralır.",
    create: "Müşteriyi Ekle",
    createdToast: "Müşteri eklendi",
  },
};

const EN = {
  manualBadge: "Manual",
  manualBadgeTooltip: "Manually added customer (added by agency in CRM)",
  autoTags: { lead: "Lead" },
  filter: { lead: "Lead" },
  edit: {
    title: "Edit Customer Info",
    description: "Update name and email. The bot will not overwrite these later.",
    fullNameLabel: "Full Name",
    fullNamePlaceholder: "e.g. John Smith",
    emailLabel: "Email",
    emailHint: "Leave blank to clear.",
    addName: "Add name",
    savedToast: "Customer info updated",
    invalidEmail: "Invalid email address",
  },
  newCustomer: {
    button: "New Customer",
    title: "Add New Customer",
    description: "Add a customer your agency already knows into CRM.",
    phoneLabel: "Phone",
    fullNameLabel: "Full Name",
    fullNamePlaceholder: "Optional",
    emailLabel: "Email",
    notesLabel: "Note",
    notesPlaceholder: "Private note about this customer (optional)",
    previewLabel: "Will be saved as",
    invalidPhone: "Invalid phone number",
    invalidPhoneHint: "Please enter with country code (e.g. +90 532 ...)",
    duplicate: "Could not add this number",
    duplicateDesc: "This phone is already registered.",
    botOptInNote: "The bot will not message this customer automatically. Start the first message yourself on WhatsApp; once the customer replies, the bot takes over.",
    create: "Add Customer",
    createdToast: "Customer added",
  },
};

const DE = {
  manualBadge: "Manuell",
  manualBadgeTooltip: "Manuell hinzugefügter Kunde (von Agentur im CRM hinzugefügt)",
  autoTags: { lead: "Lead" },
  filter: { lead: "Lead" },
  edit: {
    title: "Kundendaten bearbeiten",
    description: "Name und E-Mail aktualisieren. Der Bot überschreibt diese später nicht.",
    fullNameLabel: "Vollständiger Name",
    fullNamePlaceholder: "z. B. Max Mustermann",
    emailLabel: "E-Mail",
    emailHint: "Leer lassen zum Entfernen.",
    addName: "Name hinzufügen",
    savedToast: "Kundendaten aktualisiert",
    invalidEmail: "Ungültige E-Mail-Adresse",
  },
  newCustomer: {
    button: "Neuer Kunde",
    title: "Neuen Kunden hinzufügen",
    description: "Einen bereits bekannten Kunden in das CRM aufnehmen.",
    phoneLabel: "Telefon",
    fullNameLabel: "Vollständiger Name",
    fullNamePlaceholder: "Optional",
    emailLabel: "E-Mail",
    notesLabel: "Notiz",
    notesPlaceholder: "Private Notiz zu diesem Kunden (optional)",
    previewLabel: "Wird gespeichert als",
    invalidPhone: "Ungültige Telefonnummer",
    invalidPhoneHint: "Bitte mit Ländervorwahl eingeben (z. B. +49 ...)",
    duplicate: "Diese Nummer konnte nicht hinzugefügt werden",
    duplicateDesc: "Diese Telefonnummer ist bereits registriert.",
    botOptInNote: "Der Bot schreibt diesem Kunden nicht automatisch. Beginnen Sie die erste Nachricht selbst auf WhatsApp; sobald der Kunde antwortet, übernimmt der Bot.",
    create: "Kunde hinzufügen",
    createdToast: "Kunde hinzugefügt",
  },
};

const FR = {
  manualBadge: "Manuel",
  manualBadgeTooltip: "Client ajouté manuellement (ajouté par l'agence dans le CRM)",
  autoTags: { lead: "Lead" },
  filter: { lead: "Lead" },
  edit: {
    title: "Modifier les infos du client",
    description: "Mettre à jour le nom et l'e-mail. Le bot ne les écrasera plus.",
    fullNameLabel: "Nom complet",
    fullNamePlaceholder: "ex. Jean Dupont",
    emailLabel: "E-mail",
    emailHint: "Laisser vide pour effacer.",
    addName: "Ajouter un nom",
    savedToast: "Informations du client mises à jour",
    invalidEmail: "Adresse e-mail invalide",
  },
  newCustomer: {
    button: "Nouveau client",
    title: "Ajouter un nouveau client",
    description: "Ajoutez un client que votre agence connaît déjà au CRM.",
    phoneLabel: "Téléphone",
    fullNameLabel: "Nom complet",
    fullNamePlaceholder: "Optionnel",
    emailLabel: "E-mail",
    notesLabel: "Note",
    notesPlaceholder: "Note privée sur ce client (optionnel)",
    previewLabel: "Sera enregistré comme",
    invalidPhone: "Numéro de téléphone invalide",
    invalidPhoneHint: "Veuillez entrer avec l'indicatif (ex. +33 ...)",
    duplicate: "Impossible d'ajouter ce numéro",
    duplicateDesc: "Ce téléphone est déjà enregistré.",
    botOptInNote: "Le bot n'enverra pas de message automatique à ce client. Commencez le premier message vous-même sur WhatsApp ; dès que le client répond, le bot prend le relais.",
    create: "Ajouter le client",
    createdToast: "Client ajouté",
  },
};

const ES = {
  manualBadge: "Manual",
  manualBadgeTooltip: "Cliente añadido manualmente (agregado por la agencia en CRM)",
  autoTags: { lead: "Lead" },
  filter: { lead: "Lead" },
  edit: {
    title: "Editar datos del cliente",
    description: "Actualiza el nombre y el e-mail. El bot no los sobrescribirá luego.",
    fullNameLabel: "Nombre completo",
    fullNamePlaceholder: "ej. Juan Pérez",
    emailLabel: "Correo",
    emailHint: "Deja vacío para borrar.",
    addName: "Añadir nombre",
    savedToast: "Datos del cliente actualizados",
    invalidEmail: "Correo no válido",
  },
  newCustomer: {
    button: "Nuevo cliente",
    title: "Añadir nuevo cliente",
    description: "Añade un cliente que tu agencia ya conoce al CRM.",
    phoneLabel: "Teléfono",
    fullNameLabel: "Nombre completo",
    fullNamePlaceholder: "Opcional",
    emailLabel: "Correo",
    notesLabel: "Nota",
    notesPlaceholder: "Nota privada sobre este cliente (opcional)",
    previewLabel: "Se guardará como",
    invalidPhone: "Número de teléfono no válido",
    invalidPhoneHint: "Introduce con código de país (ej. +34 ...)",
    duplicate: "No se pudo añadir este número",
    duplicateDesc: "Este teléfono ya está registrado.",
    botOptInNote: "El bot no escribirá automáticamente a este cliente. Inicia tú el primer mensaje en WhatsApp; cuando el cliente responda, el bot tomará el relevo.",
    create: "Añadir cliente",
    createdToast: "Cliente añadido",
  },
};

const RU = {
  manualBadge: "Вручную",
  manualBadgeTooltip: "Клиент добавлен вручную (агентством через CRM)",
  autoTags: { lead: "Лид" },
  filter: { lead: "Лид" },
  edit: {
    title: "Редактировать данные клиента",
    description: "Обновите имя и email. Бот больше не перезапишет эти значения.",
    fullNameLabel: "Полное имя",
    fullNamePlaceholder: "напр. Иван Иванов",
    emailLabel: "Email",
    emailHint: "Оставьте пустым для удаления.",
    addName: "Добавить имя",
    savedToast: "Данные клиента обновлены",
    invalidEmail: "Некорректный email",
  },
  newCustomer: {
    button: "Новый клиент",
    title: "Добавить нового клиента",
    description: "Добавьте клиента, которого ваше агентство уже знает, в CRM.",
    phoneLabel: "Телефон",
    fullNameLabel: "Полное имя",
    fullNamePlaceholder: "Опционально",
    emailLabel: "Email",
    notesLabel: "Заметка",
    notesPlaceholder: "Личная заметка об этом клиенте (опционально)",
    previewLabel: "Будет сохранено как",
    invalidPhone: "Некорректный номер телефона",
    invalidPhoneHint: "Введите с кодом страны (напр. +7 ...)",
    duplicate: "Не удалось добавить этот номер",
    duplicateDesc: "Этот телефон уже зарегистрирован.",
    botOptInNote: "Бот не будет автоматически писать этому клиенту. Начните первое сообщение сами в WhatsApp; когда клиент ответит, бот возьмёт на себя.",
    create: "Добавить клиента",
    createdToast: "Клиент добавлен",
  },
};

const AR = {
  manualBadge: "يدوي",
  manualBadgeTooltip: "عميل أُضيف يدويًا (أضافته الوكالة عبر CRM)",
  autoTags: { lead: "محتمل جديد" },
  filter: { lead: "محتمل جديد" },
  edit: {
    title: "تعديل بيانات العميل",
    description: "حدّث الاسم والبريد الإلكتروني. لن يستبدلها البوت لاحقًا.",
    fullNameLabel: "الاسم الكامل",
    fullNamePlaceholder: "مثال: أحمد محمد",
    emailLabel: "البريد الإلكتروني",
    emailHint: "اتركه فارغًا للحذف.",
    addName: "إضافة اسم",
    savedToast: "تم تحديث بيانات العميل",
    invalidEmail: "بريد إلكتروني غير صالح",
  },
  newCustomer: {
    button: "عميل جديد",
    title: "إضافة عميل جديد",
    description: "أضف عميلًا تعرفه وكالتك بالفعل إلى CRM.",
    phoneLabel: "الهاتف",
    fullNameLabel: "الاسم الكامل",
    fullNamePlaceholder: "اختياري",
    emailLabel: "البريد الإلكتروني",
    notesLabel: "ملاحظة",
    notesPlaceholder: "ملاحظة خاصة عن هذا العميل (اختياري)",
    previewLabel: "سيتم الحفظ كـ",
    invalidPhone: "رقم هاتف غير صالح",
    invalidPhoneHint: "يرجى الإدخال مع رمز الدولة (مثال +966 ...)",
    duplicate: "لا يمكن إضافة هذا الرقم",
    duplicateDesc: "هذا الرقم مسجل بالفعل.",
    botOptInNote: "لن يرسل البوت رسائل تلقائية لهذا العميل. ابدأ أنت أول رسالة عبر WhatsApp؛ عندما يرد العميل، يتولى البوت المهمة.",
    create: "أضف العميل",
    createdToast: "تمت إضافة العميل",
  },
};

const LANG_VALUES = { tr: TR, en: EN, de: DE, fr: FR, es: ES, ru: RU, ar: AR };

let changes = 0;
function deepSet(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepSet(target[k], v);
    } else if (target[k] !== v) {
      target[k] = v;
      changes++;
    }
  }
}

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

console.log(`\nTotal TUR 3 i18n changes: ${changes}`);
