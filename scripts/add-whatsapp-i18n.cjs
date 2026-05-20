const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/i18n/locales');

const connectKeys = {
  tr: {
    cardTitle: 'WhatsApp Numaranızı Bağlayın',
    cardDescription: 'Meta Embedded Signup ile WhatsApp Business numaranızı birkaç adımda bağlayın. Teknik bilgi gerektirmez.',
    activeTitle: 'WhatsApp bağlantısı aktif!',
    activeNumber: 'Numara',
    connected: 'Bağlı',
    disconnect: 'Bağlantıyı Kaldır',
    h4Title: 'WhatsApp Business Numaranızı Bağlayın',
    h4Desc: 'Aşağıdaki butona tıklayın, Meta hesabınızla giriş yapın ve WhatsApp Business numaranızı seçin. İşlem birkaç dakika sürer.',
    connecting: 'Bağlanıyor...',
    note: 'Not: Bu işlem için bir Meta Business hesabınızın olması gerekir. Hesabınız yoksa, işlem sırasında otomatik oluşturulur.',
    security: 'Bilgileriniz güvenli şekilde saklanır ve yalnızca WhatsApp mesajlaşma için kullanılır.',
    sdkError: 'Facebook SDK yüklenemedi. Lütfen sayfayı yenileyin.',
    cancelled: 'İptal Edildi',
    cancelledDesc: 'WhatsApp bağlantısı iptal edildi.',
    success: 'Başarılı!',
    successDesc: 'WhatsApp numaranız başarıyla bağlandı',
    successDescPhone: 'WhatsApp numaranız başarıyla bağlandı: {{phone}}',
    errorTitle: 'Hata',
    exchangeError: 'WhatsApp bağlantısı sırasında bir hata oluştu. Lütfen tekrar deneyin.',
    disconnected: 'Bağlantı Kaldırıldı',
    disconnectedDesc: 'WhatsApp bağlantınız kaldırıldı.',
    disconnectError: 'Bağlantı kaldırılırken bir hata oluştu.',
  },
  en: {
    cardTitle: 'Connect Your WhatsApp Number',
    cardDescription: 'Connect your WhatsApp Business number in a few steps with Meta Embedded Signup. No technical knowledge required.',
    activeTitle: 'WhatsApp connection is active!',
    activeNumber: 'Number',
    connected: 'Connected',
    disconnect: 'Disconnect',
    h4Title: 'Connect Your WhatsApp Business Number',
    h4Desc: 'Click the button below, log in with your Meta account and select your WhatsApp Business number. The process takes a few minutes.',
    connecting: 'Connecting...',
    note: 'Note: You need a Meta Business account for this process. If you do not have one, it will be created automatically during the process.',
    security: 'Your information is stored securely and used only for WhatsApp messaging.',
    sdkError: 'Facebook SDK could not be loaded. Please refresh the page.',
    cancelled: 'Cancelled',
    cancelledDesc: 'WhatsApp connection was cancelled.',
    success: 'Success!',
    successDesc: 'Your WhatsApp number was connected successfully',
    successDescPhone: 'Your WhatsApp number was connected successfully: {{phone}}',
    errorTitle: 'Error',
    exchangeError: 'An error occurred during WhatsApp connection. Please try again.',
    disconnected: 'Disconnected',
    disconnectedDesc: 'Your WhatsApp connection has been removed.',
    disconnectError: 'An error occurred while removing the connection.',
  },
  de: {
    cardTitle: 'Ihre WhatsApp-Nummer verbinden',
    cardDescription: 'Verbinden Sie Ihre WhatsApp Business-Nummer in wenigen Schritten mit Meta Embedded Signup. Kein technisches Wissen erforderlich.',
    activeTitle: 'WhatsApp-Verbindung ist aktiv!',
    activeNumber: 'Nummer',
    connected: 'Verbunden',
    disconnect: 'Verbindung trennen',
    h4Title: 'Ihre WhatsApp Business-Nummer verbinden',
    h4Desc: 'Klicken Sie auf die Schaltfläche, melden Sie sich mit Ihrem Meta-Konto an und wählen Sie Ihre WhatsApp Business-Nummer. Der Vorgang dauert einige Minuten.',
    connecting: 'Verbinden...',
    note: 'Hinweis: Für diesen Vorgang benötigen Sie ein Meta Business-Konto. Falls Sie keines haben, wird es automatisch erstellt.',
    security: 'Ihre Daten werden sicher gespeichert und nur für WhatsApp-Nachrichten verwendet.',
    sdkError: 'Facebook SDK konnte nicht geladen werden. Bitte aktualisieren Sie die Seite.',
    cancelled: 'Abgebrochen',
    cancelledDesc: 'WhatsApp-Verbindung wurde abgebrochen.',
    success: 'Erfolgreich!',
    successDesc: 'Ihre WhatsApp-Nummer wurde erfolgreich verbunden',
    successDescPhone: 'Ihre WhatsApp-Nummer wurde erfolgreich verbunden: {{phone}}',
    errorTitle: 'Fehler',
    exchangeError: 'Bei der WhatsApp-Verbindung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
    disconnected: 'Verbindung getrennt',
    disconnectedDesc: 'Ihre WhatsApp-Verbindung wurde entfernt.',
    disconnectError: 'Beim Trennen der Verbindung ist ein Fehler aufgetreten.',
  },
  fr: {
    cardTitle: 'Connecter votre numéro WhatsApp',
    cardDescription: 'Connectez votre numéro WhatsApp Business en quelques étapes avec Meta Embedded Signup. Aucune connaissance technique requise.',
    activeTitle: 'La connexion WhatsApp est active !',
    activeNumber: 'Numéro',
    connected: 'Connecté',
    disconnect: 'Déconnecter',
    h4Title: 'Connecter votre numéro WhatsApp Business',
    h4Desc: 'Cliquez sur le bouton, connectez-vous avec votre compte Meta et sélectionnez votre numéro WhatsApp Business. Le processus prend quelques minutes.',
    connecting: 'Connexion...',
    note: 'Remarque : Vous avez besoin d\'un compte Meta Business. S\'il n\'existe pas, il sera créé automatiquement.',
    security: 'Vos informations sont stockées en toute sécurité et utilisées uniquement pour la messagerie WhatsApp.',
    sdkError: 'Le SDK Facebook n\'a pas pu être chargé. Veuillez actualiser la page.',
    cancelled: 'Annulé',
    cancelledDesc: 'La connexion WhatsApp a été annulée.',
    success: 'Succès !',
    successDesc: 'Votre numéro WhatsApp a été connecté avec succès',
    successDescPhone: 'Votre numéro WhatsApp a été connecté avec succès : {{phone}}',
    errorTitle: 'Erreur',
    exchangeError: 'Une erreur s\'est produite lors de la connexion WhatsApp. Veuillez réessayer.',
    disconnected: 'Déconnecté',
    disconnectedDesc: 'Votre connexion WhatsApp a été supprimée.',
    disconnectError: 'Une erreur s\'est produite lors de la suppression de la connexion.',
  },
  es: {
    cardTitle: 'Conectar su número de WhatsApp',
    cardDescription: 'Conecte su número de WhatsApp Business en pocos pasos con Meta Embedded Signup. No se requieren conocimientos técnicos.',
    activeTitle: '¡La conexión de WhatsApp está activa!',
    activeNumber: 'Número',
    connected: 'Conectado',
    disconnect: 'Desconectar',
    h4Title: 'Conectar su número de WhatsApp Business',
    h4Desc: 'Haga clic en el botón, inicie sesión con su cuenta Meta y seleccione su número de WhatsApp Business. El proceso toma unos minutos.',
    connecting: 'Conectando...',
    note: 'Nota: Necesita una cuenta de Meta Business. Si no tiene una, se creará automáticamente.',
    security: 'Su información se almacena de forma segura y se utiliza únicamente para mensajería de WhatsApp.',
    sdkError: 'No se pudo cargar el SDK de Facebook. Por favor, actualice la página.',
    cancelled: 'Cancelado',
    cancelledDesc: 'La conexión de WhatsApp fue cancelada.',
    success: '¡Éxito!',
    successDesc: 'Su número de WhatsApp se conectó correctamente',
    successDescPhone: 'Su número de WhatsApp se conectó correctamente: {{phone}}',
    errorTitle: 'Error',
    exchangeError: 'Ocurrió un error durante la conexión de WhatsApp. Por favor, inténtelo de nuevo.',
    disconnected: 'Desconectado',
    disconnectedDesc: 'Su conexión de WhatsApp ha sido eliminada.',
    disconnectError: 'Ocurrió un error al eliminar la conexión.',
  },
  ru: {
    cardTitle: 'Подключить ваш номер WhatsApp',
    cardDescription: 'Подключите свой номер WhatsApp Business за несколько шагов с помощью Meta Embedded Signup. Технические знания не требуются.',
    activeTitle: 'Подключение WhatsApp активно!',
    activeNumber: 'Номер',
    connected: 'Подключено',
    disconnect: 'Отключить',
    h4Title: 'Подключить номер WhatsApp Business',
    h4Desc: 'Нажмите кнопку, войдите в учётную запись Meta и выберите номер WhatsApp Business. Процесс занимает несколько минут.',
    connecting: 'Подключение...',
    note: 'Примечание: Нужна учётная запись Meta Business. Если её нет, она будет создана автоматически.',
    security: 'Ваши данные хранятся в безопасности и используются только для сообщений WhatsApp.',
    sdkError: 'Не удалось загрузить Facebook SDK. Пожалуйста, обновите страницу.',
    cancelled: 'Отменено',
    cancelledDesc: 'Подключение WhatsApp было отменено.',
    success: 'Успешно!',
    successDesc: 'Ваш номер WhatsApp успешно подключён',
    successDescPhone: 'Ваш номер WhatsApp успешно подключён: {{phone}}',
    errorTitle: 'Ошибка',
    exchangeError: 'При подключении WhatsApp произошла ошибка. Пожалуйста, попробуйте снова.',
    disconnected: 'Отключено',
    disconnectedDesc: 'Ваше подключение WhatsApp было удалено.',
    disconnectError: 'При удалении подключения произошла ошибка.',
  },
  ar: {
    cardTitle: 'ربط رقم واتساب الخاص بك',
    cardDescription: 'اربط رقم واتساب Business الخاص بك في خطوات قليلة باستخدام Meta Embedded Signup. لا تتطلب معرفة تقنية.',
    activeTitle: 'اتصال واتساب نشط!',
    activeNumber: 'الرقم',
    connected: 'متصل',
    disconnect: 'قطع الاتصال',
    h4Title: 'ربط رقم واتساب Business الخاص بك',
    h4Desc: 'انقر على الزر، سجّل الدخول بحساب Meta واختر رقم واتساب Business. تستغرق العملية بضع دقائق.',
    connecting: 'جارٍ الاتصال...',
    note: 'ملاحظة: تحتاج إلى حساب Meta Business. إذا لم يكن لديك حساب، سيتم إنشاؤه تلقائياً.',
    security: 'تُحفظ معلوماتك بأمان وتُستخدم فقط لمراسلة واتساب.',
    sdkError: 'تعذّر تحميل Facebook SDK. يرجى تحديث الصفحة.',
    cancelled: 'ملغى',
    cancelledDesc: 'تم إلغاء اتصال واتساب.',
    success: 'نجاح!',
    successDesc: 'تم ربط رقم واتساب الخاص بك بنجاح',
    successDescPhone: 'تم ربط رقم واتساب الخاص بك بنجاح: {{phone}}',
    errorTitle: 'خطأ',
    exchangeError: 'حدث خطأ أثناء اتصال واتساب. يرجى المحاولة مرة أخرى.',
    disconnected: 'تم قطع الاتصال',
    disconnectedDesc: 'تم إزالة اتصال واتساب الخاص بك.',
    disconnectError: 'حدث خطأ أثناء إزالة الاتصال.',
  },
};

const topLevelWhatsapp = {
  tr: { configError: 'WhatsApp yapılandırması yüklenemedi. Lütfen daha sonra tekrar deneyin.', sdkLoading: 'Yükleniyor...', connectButton: 'WhatsApp Numaramı Bağla' },
  en: { configError: 'Failed to load WhatsApp configuration. Please try again later.', sdkLoading: 'Loading...', connectButton: 'Connect My WhatsApp Number' },
  de: { configError: 'WhatsApp-Konfiguration konnte nicht geladen werden. Bitte später erneut versuchen.', sdkLoading: 'Wird geladen...', connectButton: 'Meine WhatsApp-Nummer verbinden' },
  fr: { configError: 'Impossible de charger la configuration WhatsApp. Veuillez réessayer plus tard.', sdkLoading: 'Chargement...', connectButton: 'Connecter mon numéro WhatsApp' },
  es: { configError: 'No se pudo cargar la configuración de WhatsApp. Por favor, inténtelo más tarde.', sdkLoading: 'Cargando...', connectButton: 'Conectar mi número de WhatsApp' },
  ru: { configError: 'Не удалось загрузить конфигурацию WhatsApp. Повторите попытку позже.', sdkLoading: 'Загрузка...', connectButton: 'Подключить мой номер WhatsApp' },
  ar: { configError: 'فشل تحميل إعدادات WhatsApp. يرجى المحاولة مرة أخرى لاحقاً.', sdkLoading: 'جارٍ التحميل...', connectButton: 'ربط رقم واتساب الخاص بي' },
};

const userProfilesEN = {
  tabs: { profile: 'Profile Info', preferences: 'Preferences', tags: 'Tags', conversations: 'Conversation History' },
  salesStats: 'Sales Statistics', totalBookings: 'Total Bookings', totalSpent: 'Total Spent',
  averageSpending: 'Average Spending', communicationMetrics: 'Communication Metrics', dailyAverage: 'Daily Average',
  firstInteraction: 'First Interaction', lastInteraction: 'Last Interaction',
  preferencesInterests: 'Preferences & Interests', interestedDestinations: 'Interested Destinations',
  lastSearch: 'Last Search', customerSatisfaction: 'Customer Satisfaction',
  feedbackScore: 'Feedback Score', feedbackComment: 'Comment', noFeedback: 'No feedback yet',
  customerTags: 'Customer Tags', addTag: 'Add Tag', tagAdded: 'Tag added', tagRemoved: 'Tag removed',
  tagError: 'Tag operation failed', conversationHistory: 'Conversation History',
  loadingConversations: 'Loading conversations...', noConversations: 'No conversations yet',
  conversationError: 'Error loading conversations', customer: 'Customer', assistant: 'Assistant',
};

const langs = ['tr', 'en', 'de', 'fr', 'es', 'ru', 'ar'];

for (const lang of langs) {
  const filePath = path.join(localesDir, lang + '.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Merge whatsapp.connect
  if (!data.whatsapp) data.whatsapp = {};
  data.whatsapp.connect = { ...(data.whatsapp.connect || {}), ...connectKeys[lang] };

  // Merge top-level whatsapp keys (configError, sdkLoading, connectButton)
  Object.assign(data.whatsapp, topLevelWhatsapp[lang]);

  // EN: add userProfiles
  if (lang === 'en' && data.admin && data.admin.whatsapp) {
    data.admin.whatsapp.userProfiles = { ...(data.admin.whatsapp.userProfiles || {}), ...userProfilesEN };
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('OK ' + lang + '.json');
}

console.log('Done!');
