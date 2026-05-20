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
    'whatsapp.connect.numberConnected': 'Numaranız bağlı',
    'whatsapp.disconnect.title': 'WhatsApp Bağlantısını Kopar?',
    'whatsapp.disconnect.description': 'WhatsApp Business bağlantınız kaldırılacak. Yeniden bağlanana kadar müşteriler size mesaj gönderemez. Konuşma geçmişiniz korunur.',
    'whatsapp.disconnect.confirm': 'Evet, Bağlantıyı Kopar',
    'whatsapp.disconnect.disconnecting': 'Kopuyor...',
    'whatsapp.disconnect.success': 'WhatsApp bağlantısı koparıldı',
    'whatsapp.disconnect.error': 'Bağlantı koparılamadı',
  },
  en: {
    'whatsapp.connect.numberConnected': 'Your number is connected',
    'whatsapp.disconnect.title': 'Disconnect WhatsApp?',
    'whatsapp.disconnect.description': 'Your WhatsApp Business connection will be removed. Customers will not be able to message you until you reconnect. Your conversation history will be preserved.',
    'whatsapp.disconnect.confirm': 'Yes, Disconnect',
    'whatsapp.disconnect.disconnecting': 'Disconnecting...',
    'whatsapp.disconnect.success': 'WhatsApp disconnected successfully',
    'whatsapp.disconnect.error': 'Could not disconnect WhatsApp',
  },
  de: {
    'whatsapp.connect.numberConnected': 'Ihre Nummer ist verbunden',
    'whatsapp.disconnect.title': 'WhatsApp-Verbindung trennen?',
    'whatsapp.disconnect.description': 'Ihre WhatsApp Business-Verbindung wird getrennt. Kunden können Ihnen keine Nachrichten senden, bis Sie sich erneut verbinden. Ihr Gesprächsverlauf bleibt erhalten.',
    'whatsapp.disconnect.confirm': 'Ja, Verbindung trennen',
    'whatsapp.disconnect.disconnecting': 'Wird getrennt...',
    'whatsapp.disconnect.success': 'WhatsApp erfolgreich getrennt',
    'whatsapp.disconnect.error': 'Verbindung konnte nicht getrennt werden',
  },
  fr: {
    'whatsapp.connect.numberConnected': 'Votre numéro est connecté',
    'whatsapp.disconnect.title': 'Déconnecter WhatsApp ?',
    'whatsapp.disconnect.description': 'Votre connexion WhatsApp Business sera supprimée. Les clients ne pourront pas vous envoyer de messages jusqu\'à ce que vous vous reconnectiez. Votre historique de conversation sera conservé.',
    'whatsapp.disconnect.confirm': 'Oui, déconnecter',
    'whatsapp.disconnect.disconnecting': 'Déconnexion...',
    'whatsapp.disconnect.success': 'WhatsApp déconnecté avec succès',
    'whatsapp.disconnect.error': 'Impossible de déconnecter WhatsApp',
  },
  es: {
    'whatsapp.connect.numberConnected': 'Su número está conectado',
    'whatsapp.disconnect.title': '¿Desconectar WhatsApp?',
    'whatsapp.disconnect.description': 'Su conexión de WhatsApp Business será eliminada. Los clientes no podrán enviarle mensajes hasta que se vuelva a conectar. Su historial de conversaciones se conservará.',
    'whatsapp.disconnect.confirm': 'Sí, desconectar',
    'whatsapp.disconnect.disconnecting': 'Desconectando...',
    'whatsapp.disconnect.success': 'WhatsApp desconectado correctamente',
    'whatsapp.disconnect.error': 'No se pudo desconectar WhatsApp',
  },
  ru: {
    'whatsapp.connect.numberConnected': 'Ваш номер подключён',
    'whatsapp.disconnect.title': 'Отключить WhatsApp?',
    'whatsapp.disconnect.description': 'Ваше подключение WhatsApp Business будет удалено. Клиенты не смогут отправлять вам сообщения, пока вы не подключитесь снова. История разговоров будет сохранена.',
    'whatsapp.disconnect.confirm': 'Да, отключить',
    'whatsapp.disconnect.disconnecting': 'Отключение...',
    'whatsapp.disconnect.success': 'WhatsApp успешно отключён',
    'whatsapp.disconnect.error': 'Не удалось отключить WhatsApp',
  },
  ar: {
    'whatsapp.connect.numberConnected': 'رقمك متصل',
    'whatsapp.disconnect.title': 'قطع اتصال واتساب؟',
    'whatsapp.disconnect.description': 'سيتم إزالة اتصال واتساب Business الخاص بك. لن يتمكن العملاء من مراسلتك حتى تعيد الاتصال. سيتم الحفاظ على سجل محادثاتك.',
    'whatsapp.disconnect.confirm': 'نعم، قطع الاتصال',
    'whatsapp.disconnect.disconnecting': 'جارٍ القطع...',
    'whatsapp.disconnect.success': 'تم قطع اتصال واتساب بنجاح',
    'whatsapp.disconnect.error': 'تعذّر قطع اتصال واتساب',
  },
};

for (const [lang, trans] of Object.entries(allTranslations)) {
  apply(lang, trans);
}
console.log('Tamamlandı!');
