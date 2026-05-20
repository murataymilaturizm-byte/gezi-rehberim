const fs = require('fs');
const path = require('path');
const localesDir = path.join(__dirname, '../src/i18n/locales');

function flatten(obj, p = '') {
  const r = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(r, flatten(v, key));
    else r[key] = v;
  }
  return r;
}
function setNestedKey(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in cur) || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function apply(lang, translations) {
  const filePath = path.join(localesDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let count = 0;
  for (const [key, value] of Object.entries(translations)) {
    if (!(key in flatten(data))) { setNestedKey(data, key, value); count++; }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${lang}: ${count} key eklendi`);
}

const allTranslations = {
  tr: {
    'admin.whatsapp.settings.cardTitle': 'WhatsApp Ayarları',
    'whatsapp.connectionInfo.title': 'Bağlantı Bilgileri',
    'whatsapp.connectionInfo.active': 'WhatsApp bağlantısı aktif! Mesajlar otomatik olarak AI chatbot tarafından yanıtlanıyor.',
    'whatsapp.connectionInfo.importantNotes': '⚠️ Önemli Notlar',
    'whatsapp.connectionInfo.rule24h': '24 saat kuralı: Müşteriden son mesajın üzerinden 24 saat geçtiyse sadece şablon mesajı gönderilebilir',
    'whatsapp.connectionInfo.autoManaged': 'Bağlantınız Embedded Signup ile otomatik yönetilmektedir',
    'whatsapp.guide.title': 'Entegrasyon Rehberi',
    'whatsapp.guide.subtitle': 'WhatsApp Business entegrasyonu için adım adım rehber',
    'whatsapp.guide.downloadPdf': '📄 WhatsApp Entegrasyon Rehberini İndir (PDF)',
    'whatsapp.support.title': 'Desteğe ihtiyacınız mı var?',
    'whatsapp.support.subtitle': 'Entegrasyon sürecinde yardıma ihtiyaç duyarsanız bize ulaşın',
    'whatsapp.support.contactNote': 'WhatsApp veya telefon ile destek alın',
  },
  en: {
    'admin.whatsapp.settings.cardTitle': 'WhatsApp Settings',
    'whatsapp.connectionInfo.title': 'Connection Information',
    'whatsapp.connectionInfo.active': 'WhatsApp connection active! Messages are automatically answered by the AI chatbot.',
    'whatsapp.connectionInfo.importantNotes': '⚠️ Important Notes',
    'whatsapp.connectionInfo.rule24h': '24-hour rule: If more than 24 hours have passed since the customer\'s last message, only template messages can be sent',
    'whatsapp.connectionInfo.autoManaged': 'Your connection is automatically managed via Embedded Signup',
    'whatsapp.guide.title': 'Integration Guide',
    'whatsapp.guide.subtitle': 'Step-by-step guide for WhatsApp Business integration',
    'whatsapp.guide.downloadPdf': '📄 Download WhatsApp Integration Guide (PDF)',
    'whatsapp.support.title': 'Need help?',
    'whatsapp.support.subtitle': 'Contact us if you need assistance during the integration process',
    'whatsapp.support.contactNote': 'Get support via WhatsApp or phone',
  },
  de: {
    'admin.whatsapp.settings.cardTitle': 'WhatsApp-Einstellungen',
    'whatsapp.connectionInfo.title': 'Verbindungsinformationen',
    'whatsapp.connectionInfo.active': 'WhatsApp-Verbindung aktiv! Nachrichten werden automatisch vom KI-Chatbot beantwortet.',
    'whatsapp.connectionInfo.importantNotes': '⚠️ Wichtige Hinweise',
    'whatsapp.connectionInfo.rule24h': '24-Stunden-Regel: Wenn seit der letzten Nachricht des Kunden mehr als 24 Stunden vergangen sind, können nur Vorlagennachrichten gesendet werden',
    'whatsapp.connectionInfo.autoManaged': 'Ihre Verbindung wird automatisch über Embedded Signup verwaltet',
    'whatsapp.guide.title': 'Integrationsleitfaden',
    'whatsapp.guide.subtitle': 'Schritt-für-Schritt-Anleitung für die WhatsApp Business-Integration',
    'whatsapp.guide.downloadPdf': '📄 WhatsApp-Integrationsleitfaden herunterladen (PDF)',
    'whatsapp.support.title': 'Benötigen Sie Hilfe?',
    'whatsapp.support.subtitle': 'Kontaktieren Sie uns, wenn Sie während des Integrationsprozesses Hilfe benötigen',
    'whatsapp.support.contactNote': 'Erhalten Sie Support per WhatsApp oder Telefon',
  },
  fr: {
    'admin.whatsapp.settings.cardTitle': 'Paramètres WhatsApp',
    'whatsapp.connectionInfo.title': 'Informations de connexion',
    'whatsapp.connectionInfo.active': 'Connexion WhatsApp active ! Les messages sont automatiquement répondus par le chatbot IA.',
    'whatsapp.connectionInfo.importantNotes': '⚠️ Notes importantes',
    'whatsapp.connectionInfo.rule24h': 'Règle des 24 heures : Si plus de 24 heures se sont écoulées depuis le dernier message du client, seuls les messages modèles peuvent être envoyés',
    'whatsapp.connectionInfo.autoManaged': 'Votre connexion est gérée automatiquement via Embedded Signup',
    'whatsapp.guide.title': 'Guide d\'intégration',
    'whatsapp.guide.subtitle': 'Guide étape par étape pour l\'intégration WhatsApp Business',
    'whatsapp.guide.downloadPdf': '📄 Télécharger le guide d\'intégration WhatsApp (PDF)',
    'whatsapp.support.title': 'Besoin d\'aide ?',
    'whatsapp.support.subtitle': 'Contactez-nous si vous avez besoin d\'aide pendant le processus d\'intégration',
    'whatsapp.support.contactNote': 'Obtenez de l\'aide via WhatsApp ou par téléphone',
  },
  es: {
    'admin.whatsapp.settings.cardTitle': 'Configuración de WhatsApp',
    'whatsapp.connectionInfo.title': 'Información de conexión',
    'whatsapp.connectionInfo.active': '¡Conexión de WhatsApp activa! Los mensajes son respondidos automáticamente por el chatbot de IA.',
    'whatsapp.connectionInfo.importantNotes': '⚠️ Notas importantes',
    'whatsapp.connectionInfo.rule24h': 'Regla de 24 horas: Si han pasado más de 24 horas desde el último mensaje del cliente, solo se pueden enviar mensajes de plantilla',
    'whatsapp.connectionInfo.autoManaged': 'Su conexión se gestiona automáticamente a través de Embedded Signup',
    'whatsapp.guide.title': 'Guía de integración',
    'whatsapp.guide.subtitle': 'Guía paso a paso para la integración de WhatsApp Business',
    'whatsapp.guide.downloadPdf': '📄 Descargar la guía de integración de WhatsApp (PDF)',
    'whatsapp.support.title': '¿Necesita ayuda?',
    'whatsapp.support.subtitle': 'Contáctenos si necesita ayuda durante el proceso de integración',
    'whatsapp.support.contactNote': 'Obtenga soporte por WhatsApp o teléfono',
  },
  ru: {
    'admin.whatsapp.settings.cardTitle': 'Настройки WhatsApp',
    'whatsapp.connectionInfo.title': 'Информация о подключении',
    'whatsapp.connectionInfo.active': 'Подключение WhatsApp активно! На сообщения автоматически отвечает ИИ-чатбот.',
    'whatsapp.connectionInfo.importantNotes': '⚠️ Важные замечания',
    'whatsapp.connectionInfo.rule24h': 'Правило 24 часов: Если с момента последнего сообщения клиента прошло более 24 часов, можно отправлять только шаблонные сообщения',
    'whatsapp.connectionInfo.autoManaged': 'Ваше подключение автоматически управляется через Embedded Signup',
    'whatsapp.guide.title': 'Руководство по интеграции',
    'whatsapp.guide.subtitle': 'Пошаговое руководство по интеграции WhatsApp Business',
    'whatsapp.guide.downloadPdf': '📄 Скачать руководство по интеграции WhatsApp (PDF)',
    'whatsapp.support.title': 'Нужна помощь?',
    'whatsapp.support.subtitle': 'Свяжитесь с нами, если вам нужна помощь в процессе интеграции',
    'whatsapp.support.contactNote': 'Получите поддержку через WhatsApp или по телефону',
  },
  ar: {
    'admin.whatsapp.settings.cardTitle': 'إعدادات واتساب',
    'whatsapp.connectionInfo.title': 'معلومات الاتصال',
    'whatsapp.connectionInfo.active': 'اتصال واتساب نشط! يتم الرد على الرسائل تلقائيًا بواسطة روبوت الدردشة بالذكاء الاصطناعي.',
    'whatsapp.connectionInfo.importantNotes': '⚠️ ملاحظات مهمة',
    'whatsapp.connectionInfo.rule24h': 'قاعدة 24 ساعة: إذا مرت أكثر من 24 ساعة منذ آخر رسالة للعميل، يمكن إرسال رسائل القوالب فقط',
    'whatsapp.connectionInfo.autoManaged': 'تتم إدارة اتصالك تلقائيًا عبر Embedded Signup',
    'whatsapp.guide.title': 'دليل التكامل',
    'whatsapp.guide.subtitle': 'دليل خطوة بخطوة لتكامل WhatsApp Business',
    'whatsapp.guide.downloadPdf': '📄 تنزيل دليل تكامل واتساب (PDF)',
    'whatsapp.support.title': 'هل تحتاج إلى مساعدة؟',
    'whatsapp.support.subtitle': 'اتصل بنا إذا كنت بحاجة إلى مساعدة أثناء عملية التكامل',
    'whatsapp.support.contactNote': 'احصل على الدعم عبر واتساب أو الهاتف',
  },
};

for (const [lang, trans] of Object.entries(allTranslations)) {
  apply(lang, trans);
}
console.log('Tamamlandı!');
