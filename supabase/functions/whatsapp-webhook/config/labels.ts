// Multi-language labels for WhatsApp responses

export const multilingualLabels: Record<string, Record<string, string>> = {
  user: { 
    tr: 'Kullanıcı', 
    en: 'User', 
    de: 'Benutzer', 
    ru: 'Пользователь', 
    ar: 'المستخدم', 
    fr: 'Utilisateur', 
    es: 'Usuario' 
  },
  preferences: { 
    tr: 'Tercihleri', 
    en: 'Preferences', 
    de: 'Präferenzen', 
    ru: 'Предпочтения', 
    ar: 'التفضيلات', 
    fr: 'Préférences', 
    es: 'Preferencias' 
  },
  previous_searches: { 
    tr: 'Önceki aramalar', 
    en: 'Previous searches', 
    de: 'Frühere Suchen', 
    ru: 'Предыдущие поиски', 
    ar: 'عمليات البحث السابقة', 
    fr: 'Recherches précédentes', 
    es: 'Búsquedas anteriores' 
  },
  found_tours: { 
    tr: 'Muhteşem Turlar Buldum', 
    en: 'Amazing Tours Found', 
    de: 'Tolle Touren gefunden', 
    ru: 'Найдены отличные туры', 
    ar: 'عثرنا على جولات رائعة', 
    fr: 'Superbes circuits trouvés', 
    es: 'Tours increíbles encontrados' 
  },
  greeting_context: { 
    tr: 'KULLANICI SELAMLAŞTI: Kullanıcı daha önce "{search}" araması yaptı. Bu tur hakkında mı bilgi almak isterler yoksa farklı bir şey mi? KISA TUT (2 cümle max).',
    en: 'USER GREETED: User previously searched for "{search}". Do they want info about that tour OR something else? Keep it SHORT (2 sentences max).',
    de: 'BENUTZER GRÜSSTE: Benutzer suchte zuvor nach "{search}". Möchten sie Informationen über diese Tour ODER etwas anderes? KURZ HALTEN (max. 2 Sätze).',
    ru: 'ПОЛЬЗОВАТЕЛЬ ПОЗДОРОВАЛСЯ: Пользователь ранее искал "{search}". Хотят ли они информацию об этом туре ИЛИ о чём-то другом? КОРОТКО (макс. 2 предложения).',
    ar: 'المستخدم سلم: بحث المستخدم سابقًا عن "{search}". هل يريدون معلومات عن تلك الجولة أم شيء آخر؟ اجعلها قصيرة (جملتان كحد أقصى).',
    fr: 'UTILISATEUR SALUÉ: L\'utilisateur a déjà recherché "{search}". Veulent-ils des informations sur ce circuit OU autre chose? BREF (2 phrases max).',
    es: 'USUARIO SALUDÓ: El usuario buscó anteriormente "{search}". ¿Quieren información sobre ese tour O algo más? BREVE (máx. 2 oraciones).'
  },
  tour_list_prompt: {
    tr: 'KULLANICI GENEL TUR LİSTESİ SORDU: SADECE tur isimlerini ve ilk 2 tarihi numaralı liste olarak göster. Ekle: "Hangi tura ilgi duyuyorsunuz? Detaylı bilgi için tur adını yazabilirsiniz." KISA ve TEMİZ tut.',
    en: 'USER ASKED FOR GENERAL TOUR LIST: Show ONLY tour names and first 2 dates in a numbered list. Add: "Which tour are you interested in? You can write the tour name for detailed information." Keep it SHORT and CLEAN.',
    de: 'BENUTZER FRAGTE NACH ALLGEMEINER TOURLISTE: Zeigen Sie NUR Tournamen und erste 2 Daten in nummerierter Liste. Fügen Sie hinzu: "Welche Tour interessiert Sie? Sie können den Tournamen für detaillierte Informationen schreiben." KURZ und SAUBER halten.',
    ru: 'ПОЛЬЗОВАТЕЛЬ ЗАПРОСИЛ ОБЩИЙ СПИСОК ТУРОВ: Показать ТОЛЬКО названия туров и первые 2 даты в нумерованном списке. Добавьте: "Какой тур вас интересует? Вы можете написать название тура для подробной информации." КОРОТКО и ЧИСТО.',
    ar: 'طلب المستخدم قائمة الجولات العامة: أظهر فقط أسماء الجولات وأول تاريخين في قائمة مرقمة. أضف: "ما الجولة التي تهتم بها؟ يمكنك كتابة اسم الجولة للحصول على معلومات مفصلة." اجعلها قصيرة ونظيفة.',
    fr: 'L\'UTILISATEUR A DEMANDÉ LA LISTE GÉNÉRALE DES CIRCUITS: Afficher UNIQUEMENT les noms des circuits et les 2 premières dates dans une liste numérotée. Ajoutez: "Quel circuit vous intéresse? Vous pouvez écrire le nom du circuit pour des informations détaillées." BREF et PROPRE.',
    es: 'USUARIO PIDIÓ LISTA GENERAL DE TOURS: Mostrar SOLO nombres de tours y primeras 2 fechas en lista numerada. Agregar: "¿Qué tour te interesa? Puedes escribir el nombre del tour para información detallada." BREVE y LIMPIO.'
  }
};

export const systemMessages: Record<string, Record<string, string>> = {
  wizard_cancel: {
    tr: 'Rezervasyon iptal edildi. Size nasıl yardımcı olabilirim?',
    en: 'Reservation cancelled. How can I help you?',
    de: 'Reservierung storniert. Wie kann ich Ihnen helfen?',
    ru: 'Бронирование отменено. Как я могу вам помочь?',
    ar: 'تم إلغاء الحجز. كيف يمكنني مساعدتك؟',
    fr: 'Réservation annulée. Comment puis-je vous aider?',
    es: 'Reserva cancelada. ¿Cómo puedo ayudarte?'
  },
  registration_success: {
    tr: 'Rezervasyonunuz başarıyla alındı! Kısa süre içinde size dönüş yapacağız.',
    en: 'Your reservation has been received! We will get back to you shortly.',
    de: 'Ihre Reservierung wurde empfangen! Wir melden uns in Kürze bei Ihnen.',
    ru: 'Ваша бронь получена! Мы скоро свяжемся с вами.',
    ar: 'تم استلام حجزك! سنعود إليك قريبًا.',
    fr: 'Votre réservation a été reçue! Nous vous recontacterons sous peu.',
    es: '¡Tu reserva ha sido recibida! Te contactaremos pronto.'
  }
};

export function getLabel(key: string, language: string = 'tr'): string {
  return multilingualLabels[key]?.[language] || multilingualLabels[key]?.['tr'] || key;
}

export function getSystemMessage(key: string, language: string = 'tr'): string {
  return systemMessages[key]?.[language] || systemMessages[key]?.['tr'] || '';
}
