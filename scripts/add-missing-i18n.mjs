/**
 * Landing page + Layout hardcoded Türkçe → i18n fix
 * Nav, footer, indexFeatures, indexSolutions bölümleri
 */
import { readFileSync, writeFileSync } from 'fs';

const additions = {
  tr: {
    nav: {
      features: "Özellikler",
      solutions: "Çözümler",
      compare: "Karşılaştır",
      blog: "Blog",
      pricing: "Fiyatlandırma",
      login: "Giriş Yap",
      freeTrial: "Ücretsiz Dene",
      menu: "Menü",
      discoverFeatures: "Özelliklerimizi Keşfet",
    },
    pricing: { mostPopular: "En Popüler" },
    cta: {
      learnMore: "Detaylı bilgi",
      more: "Daha fazla",
    },
    indexFeatures: {
      title: "Acentenize Özel Çözümler",
      subtitle: "WhatsApp üzerinden satış, rezervasyon ve müşteri hizmetini tek platformda yönetin.",
      whatsapp: {
        title: "WhatsApp Business Chatbot",
        desc: "Müşteri mesajlarını 7/24 otomatik yanıtlayın. Gece 2'de gelen sorulara bile anında cevap.",
      },
      ai: {
        title: "AI Destekli Rezervasyon",
        desc: "Yapay zeka tarih, kişi, isim ve telefon bilgilerini adım adım toplayarak otomatik rezervasyon oluşturur.",
      },
      multilingual: {
        title: "7 Dilde Müşteri Hizmetleri",
        desc: "Alman, Rus, Arap turist kendi dilinde yazar, chatbot aynı dilde yanıt verir. Çevirmen gerekmez.",
      },
      automation: {
        title: "Otomatik Tur Yönetimi",
        desc: "Kontenjan takibi, tur hatırlatıcıları, müşteri segmentasyonu — hepsi otomatik.",
      },
    },
    indexSolutions: {
      title: "Sektöre Özel Çözümler",
      subtitle: "Her acente tipine uygun özelleştirilmiş yapılar.",
      incoming: {
        title: "İncoming Acenteler",
        desc: "Yabancı turistlere 7 dilde, 7/24 hizmet. Kültürel hassasiyetle, anında yanıt.",
        bullets: [
          "Almanca, Rusça, Arapça otomatik",
          "Saat farkı sorun değil — 7/24 aktif",
          "Yabancı turist pazarına direkt erişim",
        ],
      },
      dayTour: {
        title: "Günübirlik Tur Operatörleri",
        desc: "Hızlı rezervasyon, son dakika satışları, dinamik kontenjan yönetimi.",
        bullets: [
          "Anlık yer sorgulama ve rezervasyon",
          "Son dakika doluluğu otomatik kapanır",
          "Gece satışlarını da kaçırmayın",
        ],
      },
      boutique: {
        title: "Butik Acenteler",
        desc: "Kişisel dokunuş + modern teknoloji. Küçük bütçeyle büyük şirket görünümü.",
        bullets: [
          "2.999₺/ay'dan başlayan paket",
          "Kurulum 5-10 dakika",
          "1 çalışan maliyetinin %20'si",
        ],
      },
    },
    footer: {
      company: "Şirket",
      resources: "Kaynaklar",
      about: "Hakkımızda",
      kvkk: "KVKK Politikası",
      termsOfUse: "Kullanım Koşulları",
      helpCenter: "Yardım Merkezi",
      requestDemo: "Demo İste",
      whatsappChatbot: "WhatsApp Chatbot",
      aiReservation: "AI Tur Rezervasyonu",
      multilingualService: "Çok Dilli Hizmet",
      tourAutomation: "Tur Otomasyonu",
      incomingAgencies: "İncoming Acenteler",
      dayTours: "Günübirlik Tur",
      boutiqueAgencies: "Butik Acenteler",
      comparison: "Karşılaştırma",
      copyright: "© {year} Turzz AI. Tüm hakları saklıdır.",
      dataDeletion: "Veri Silme",
      dataExport: "Veri İndirme",
    },
  },

  en: {
    nav: {
      features: "Features",
      solutions: "Solutions",
      compare: "Compare",
      blog: "Blog",
      pricing: "Pricing",
      login: "Log In",
      freeTrial: "Free Trial",
      menu: "Menu",
      discoverFeatures: "Discover Features",
    },
    pricing: { mostPopular: "Most Popular" },
    cta: { learnMore: "Learn more", more: "More" },
    indexFeatures: {
      title: "Built for Travel Agencies",
      subtitle: "Manage sales, bookings and customer service via WhatsApp — all in one platform.",
      whatsapp: {
        title: "WhatsApp Business Chatbot",
        desc: "Auto-respond to customer messages 24/7. Even 2am inquiries get instant answers.",
      },
      ai: {
        title: "AI-Powered Booking",
        desc: "AI collects date, pax count, name and phone step by step — and creates the reservation automatically.",
      },
      multilingual: {
        title: "7-Language Customer Service",
        desc: "German, Russian, Arabic tourists write in their own language — chatbot replies the same. No translator needed.",
      },
      automation: {
        title: "Automated Tour Management",
        desc: "Quota tracking, tour reminders, customer segmentation — all automatic.",
      },
    },
    indexSolutions: {
      title: "Industry-Specific Solutions",
      subtitle: "Tailored setups for every type of travel agency.",
      incoming: {
        title: "Incoming Agencies",
        desc: "Serve foreign tourists in 7 languages, 24/7. Culturally aware, instant responses.",
        bullets: [
          "German, Russian, Arabic — automated",
          "Time zones are no obstacle — 24/7 active",
          "Direct access to the international market",
        ],
      },
      dayTour: {
        title: "Day Tour Operators",
        desc: "Fast bookings, last-minute sales, dynamic quota management.",
        bullets: [
          "Real-time seat check and booking",
          "Last-minute availability closes automatically",
          "Never miss a late-night booking",
        ],
      },
      boutique: {
        title: "Boutique Agencies",
        desc: "Personal touch + modern technology. Big-company presence on a small budget.",
        bullets: [
          "Plans from ₺2,999/mo",
          "Setup in 5–10 minutes",
          "20% of the cost of one employee",
        ],
      },
    },
    footer: {
      company: "Company",
      resources: "Resources",
      about: "About Us",
      kvkk: "Privacy Policy",
      termsOfUse: "Terms of Service",
      helpCenter: "Help Center",
      requestDemo: "Request Demo",
      whatsappChatbot: "WhatsApp Chatbot",
      aiReservation: "AI Tour Booking",
      multilingualService: "Multilingual Service",
      tourAutomation: "Tour Automation",
      incomingAgencies: "Incoming Agencies",
      dayTours: "Day Tours",
      boutiqueAgencies: "Boutique Agencies",
      comparison: "Comparison",
      copyright: "© {year} Turzz AI. All rights reserved.",
      dataDeletion: "Data Deletion",
      dataExport: "Data Export",
    },
  },

  de: {
    nav: {
      features: "Funktionen",
      solutions: "Lösungen",
      compare: "Vergleich",
      blog: "Blog",
      pricing: "Preise",
      login: "Anmelden",
      freeTrial: "Kostenlos testen",
      menu: "Menü",
      discoverFeatures: "Funktionen entdecken",
    },
    pricing: { mostPopular: "Beliebtester" },
    cta: { learnMore: "Mehr erfahren", more: "Mehr" },
    indexFeatures: {
      title: "Funktionen für Reisebüros",
      subtitle: "Verwalten Sie Verkäufe, Buchungen und Kundenservice über WhatsApp — alles auf einer Plattform.",
      whatsapp: {
        title: "WhatsApp Business Chatbot",
        desc: "Beantworten Sie Kundennachrichten automatisch rund um die Uhr. Sofortige Antworten auch um 2 Uhr nachts.",
      },
      ai: {
        title: "KI-gestützte Buchung",
        desc: "Die KI erfasst Datum, Personenzahl, Name und Telefon Schritt für Schritt und erstellt die Buchung automatisch.",
      },
      multilingual: {
        title: "Kundenservice in 7 Sprachen",
        desc: "Deutsche, russische, arabische Touristen schreiben in ihrer Sprache — der Chatbot antwortet genauso. Kein Übersetzer nötig.",
      },
      automation: {
        title: "Automatisiertes Tourmanagement",
        desc: "Kapazitätsverwaltung, Tourerinnerungen, Kundensegmentierung — alles automatisch.",
      },
    },
    indexSolutions: {
      title: "Branchenspezifische Lösungen",
      subtitle: "Maßgeschneiderte Lösungen für jeden Agenturtyp.",
      incoming: {
        title: "Incoming-Agenturen",
        desc: "Bedienen Sie ausländische Touristen in 7 Sprachen, 24/7. Kultursensibel und sofort.",
        bullets: [
          "Deutsch, Russisch, Arabisch — automatisiert",
          "Zeitzonen sind kein Problem — 24/7 aktiv",
          "Direkter Zugang zum internationalen Markt",
        ],
      },
      dayTour: {
        title: "Tagestouren-Operatoren",
        desc: "Schnelle Buchungen, Last-Minute-Verkäufe, dynamisches Kapazitätsmanagement.",
        bullets: [
          "Echtzeit-Verfügbarkeit und Buchung",
          "Last-Minute-Kapazität schließt automatisch",
          "Keine Buchungen mehr in der Nacht verpassen",
        ],
      },
      boutique: {
        title: "Boutique-Agenturen",
        desc: "Persönliche Note + moderne Technologie. Großunternehmen-Präsenz mit kleinem Budget.",
        bullets: [
          "Pakete ab ₺2.999/Monat",
          "Einrichtung in 5–10 Minuten",
          "20% der Kosten eines Mitarbeiters",
        ],
      },
    },
    footer: {
      company: "Unternehmen",
      resources: "Ressourcen",
      about: "Über uns",
      kvkk: "Datenschutzrichtlinie",
      termsOfUse: "Nutzungsbedingungen",
      helpCenter: "Hilfezentrum",
      requestDemo: "Demo anfragen",
      whatsappChatbot: "WhatsApp Chatbot",
      aiReservation: "KI-Buchung",
      multilingualService: "Mehrsprachiger Service",
      tourAutomation: "Tour-Automatisierung",
      incomingAgencies: "Incoming-Agenturen",
      dayTours: "Tagestouren",
      boutiqueAgencies: "Boutique-Agenturen",
      comparison: "Vergleich",
      copyright: "© {year} Turzz AI. Alle Rechte vorbehalten.",
      dataDeletion: "Datenlöschung",
      dataExport: "Daten exportieren",
    },
  },

  ru: {
    nav: {
      features: "Функции",
      solutions: "Решения",
      compare: "Сравнение",
      blog: "Блог",
      pricing: "Цены",
      login: "Войти",
      freeTrial: "Бесплатная версия",
      menu: "Меню",
      discoverFeatures: "Изучить возможности",
    },
    pricing: { mostPopular: "Самый популярный" },
    cta: { learnMore: "Подробнее", more: "Ещё" },
    indexFeatures: {
      title: "Решения для туристических агентств",
      subtitle: "Управляйте продажами, бронированиями и обслуживанием клиентов через WhatsApp — всё на одной платформе.",
      whatsapp: {
        title: "Чат-бот WhatsApp Business",
        desc: "Автоматически отвечайте на сообщения клиентов 24/7. Мгновенные ответы даже в 2 часа ночи.",
      },
      ai: {
        title: "Бронирование с помощью ИИ",
        desc: "ИИ поэтапно собирает дату, количество гостей, имя и телефон — и автоматически создаёт бронирование.",
      },
      multilingual: {
        title: "Обслуживание на 7 языках",
        desc: "Немецкие, русские, арабские туристы пишут на родном языке — чат-бот отвечает так же. Переводчик не нужен.",
      },
      automation: {
        title: "Автоматизация управления турами",
        desc: "Отслеживание мест, напоминания о турах, сегментация клиентов — всё автоматически.",
      },
    },
    indexSolutions: {
      title: "Отраслевые решения",
      subtitle: "Индивидуальные решения для каждого типа агентства.",
      incoming: {
        title: "Инкомингские агентства",
        desc: "Обслуживайте иностранных туристов на 7 языках, 24/7. Культурно чуткий мгновенный ответ.",
        bullets: [
          "Немецкий, русский, арабский — автоматически",
          "Разница в часовых поясах не проблема — 24/7",
          "Прямой доступ к международному рынку",
        ],
      },
      dayTour: {
        title: "Операторы однодневных туров",
        desc: "Быстрые бронирования, продажи в последний момент, динамическое управление местами.",
        bullets: [
          "Проверка наличия мест и бронирование в реальном времени",
          "Места последнего момента закрываются автоматически",
          "Не упускайте ночные бронирования",
        ],
      },
      boutique: {
        title: "Бутик-агентства",
        desc: "Личный подход + современные технологии. Имидж крупной компании при небольшом бюджете.",
        bullets: [
          "Тарифы от ₺2 999/мес",
          "Настройка за 5–10 минут",
          "20% от стоимости одного сотрудника",
        ],
      },
    },
    footer: {
      company: "Компания",
      resources: "Ресурсы",
      about: "О нас",
      kvkk: "Политика конфиденциальности",
      termsOfUse: "Условия использования",
      helpCenter: "Центр помощи",
      requestDemo: "Запросить демо",
      whatsappChatbot: "Чат-бот WhatsApp",
      aiReservation: "Бронирование ИИ",
      multilingualService: "Многоязычный сервис",
      tourAutomation: "Автоматизация туров",
      incomingAgencies: "Инкомингские агентства",
      dayTours: "Однодневные туры",
      boutiqueAgencies: "Бутик-агентства",
      comparison: "Сравнение",
      copyright: "© {year} Turzz AI. Все права защищены.",
      dataDeletion: "Удаление данных",
      dataExport: "Экспорт данных",
    },
  },

  ar: {
    nav: {
      features: "الميزات",
      solutions: "الحلول",
      compare: "مقارنة",
      blog: "المدونة",
      pricing: "الأسعار",
      login: "تسجيل الدخول",
      freeTrial: "تجربة مجانية",
      menu: "القائمة",
      discoverFeatures: "استكشاف الميزات",
    },
    pricing: { mostPopular: "الأكثر شعبية" },
    cta: { learnMore: "تفاصيل أكثر", more: "المزيد" },
    indexFeatures: {
      title: "حلول مصممة لوكالات السياحة",
      subtitle: "أدِر المبيعات والحجوزات وخدمة العملاء عبر WhatsApp — كل شيء في منصة واحدة.",
      whatsapp: {
        title: "روبوت WhatsApp Business",
        desc: "استجب لرسائل العملاء تلقائياً على مدار الساعة. ردود فورية حتى في الساعة الثانية صباحاً.",
      },
      ai: {
        title: "حجز مدعوم بالذكاء الاصطناعي",
        desc: "يجمع الذكاء الاصطناعي التاريخ وعدد الأشخاص والاسم والهاتف خطوة بخطوة وينشئ الحجز تلقائياً.",
      },
      multilingual: {
        title: "خدمة العملاء بـ 7 لغات",
        desc: "السياح الألمان والروس والعرب يكتبون بلغتهم — يرد الروبوت بنفس اللغة. لا حاجة لمترجم.",
      },
      automation: {
        title: "إدارة الجولات التلقائية",
        desc: "تتبع الطاقة الاستيعابية وتذكيرات الجولات وتقسيم العملاء — كل شيء تلقائي.",
      },
    },
    indexSolutions: {
      title: "حلول خاصة بكل قطاع",
      subtitle: "إعدادات مخصصة لكل نوع من أنواع الوكالات.",
      incoming: {
        title: "وكالات الاستقبال",
        desc: "اخدم السياح الأجانب بـ 7 لغات، 24/7. ردود فورية مع مراعاة الحساسيات الثقافية.",
        bullets: [
          "الألمانية والروسية والعربية — تلقائياً",
          "فوارق التوقيت ليست عائقاً — 24/7",
          "وصول مباشر إلى السوق الدولي",
        ],
      },
      dayTour: {
        title: "منظمو الجولات اليومية",
        desc: "حجوزات سريعة ومبيعات اللحظة الأخيرة وإدارة ديناميكية للطاقة.",
        bullets: [
          "فحص المقاعد والحجز في الوقت الفعلي",
          "المقاعد الأخيرة تُغلق تلقائياً",
          "لا تفوّت الحجوزات الليلية",
        ],
      },
      boutique: {
        title: "الوكالات الفاخرة",
        desc: "اللمسة الشخصية + التكنولوجيا الحديثة. مظهر الشركة الكبيرة بميزانية صغيرة.",
        bullets: [
          "خطط تبدأ من ₺2,999/شهر",
          "إعداد في 5-10 دقائق",
          "20% من تكلفة موظف واحد",
        ],
      },
    },
    footer: {
      company: "الشركة",
      resources: "الموارد",
      about: "من نحن",
      kvkk: "سياسة الخصوصية",
      termsOfUse: "شروط الاستخدام",
      helpCenter: "مركز المساعدة",
      requestDemo: "طلب عرض توضيحي",
      whatsappChatbot: "روبوت WhatsApp",
      aiReservation: "حجز بالذكاء الاصطناعي",
      multilingualService: "خدمة متعددة اللغات",
      tourAutomation: "أتمتة الجولات",
      incomingAgencies: "وكالات الاستقبال",
      dayTours: "الجولات اليومية",
      boutiqueAgencies: "الوكالات الفاخرة",
      comparison: "المقارنة",
      copyright: "© {year} Turzz AI. جميع الحقوق محفوظة.",
      dataDeletion: "حذف البيانات",
      dataExport: "تصدير البيانات",
    },
  },

  fr: {
    nav: {
      features: "Fonctionnalités",
      solutions: "Solutions",
      compare: "Comparer",
      blog: "Blog",
      pricing: "Tarifs",
      login: "Se connecter",
      freeTrial: "Essai gratuit",
      menu: "Menu",
      discoverFeatures: "Découvrir les fonctionnalités",
    },
    pricing: { mostPopular: "Le plus populaire" },
    cta: { learnMore: "En savoir plus", more: "Plus" },
    indexFeatures: {
      title: "Conçu pour les agences de voyage",
      subtitle: "Gérez ventes, réservations et service client via WhatsApp — tout sur une seule plateforme.",
      whatsapp: {
        title: "Chatbot WhatsApp Business",
        desc: "Répondez automatiquement aux messages clients 24h/24. Même les demandes à 2h du matin reçoivent une réponse instantanée.",
      },
      ai: {
        title: "Réservation assistée par IA",
        desc: "L'IA collecte date, nombre de personnes, nom et téléphone étape par étape — et crée la réservation automatiquement.",
      },
      multilingual: {
        title: "Service client en 7 langues",
        desc: "Les touristes allemands, russes, arabes écrivent dans leur langue — le chatbot répond pareil. Pas besoin de traducteur.",
      },
      automation: {
        title: "Gestion automatisée des circuits",
        desc: "Suivi des quotas, rappels de circuits, segmentation des clients — tout automatiquement.",
      },
    },
    indexSolutions: {
      title: "Solutions spécifiques au secteur",
      subtitle: "Des configurations personnalisées pour chaque type d'agence.",
      incoming: {
        title: "Agences réceptives",
        desc: "Servez les touristes étrangers en 7 langues, 24h/24. Culturellement adapté, réponses immédiates.",
        bullets: [
          "Allemand, russe, arabe — automatique",
          "Le décalage horaire n'est plus un obstacle — 24/7",
          "Accès direct au marché international",
        ],
      },
      dayTour: {
        title: "Opérateurs de circuits journaliers",
        desc: "Réservations rapides, ventes de dernière minute, gestion dynamique des quotas.",
        bullets: [
          "Disponibilité en temps réel et réservation",
          "Les dernières places se ferment automatiquement",
          "Ne manquez plus les réservations nocturnes",
        ],
      },
      boutique: {
        title: "Agences boutique",
        desc: "Touche personnelle + technologie moderne. Image grande entreprise avec petit budget.",
        bullets: [
          "Formules à partir de ₺2 999/mois",
          "Installation en 5-10 minutes",
          "20% du coût d'un employé",
        ],
      },
    },
    footer: {
      company: "Entreprise",
      resources: "Ressources",
      about: "À propos",
      kvkk: "Politique de confidentialité",
      termsOfUse: "Conditions d'utilisation",
      helpCenter: "Centre d'aide",
      requestDemo: "Demander une démo",
      whatsappChatbot: "Chatbot WhatsApp",
      aiReservation: "Réservation IA",
      multilingualService: "Service multilingue",
      tourAutomation: "Automatisation des circuits",
      incomingAgencies: "Agences réceptives",
      dayTours: "Circuits journaliers",
      boutiqueAgencies: "Agences boutique",
      comparison: "Comparatif",
      copyright: "© {year} Turzz AI. Tous droits réservés.",
      dataDeletion: "Suppression des données",
      dataExport: "Export des données",
    },
  },

  es: {
    nav: {
      features: "Características",
      solutions: "Soluciones",
      compare: "Comparar",
      blog: "Blog",
      pricing: "Precios",
      login: "Iniciar sesión",
      freeTrial: "Prueba gratis",
      menu: "Menú",
      discoverFeatures: "Descubrir características",
    },
    pricing: { mostPopular: "Más popular" },
    cta: { learnMore: "Más información", more: "Más" },
    indexFeatures: {
      title: "Diseñado para agencias de viajes",
      subtitle: "Gestione ventas, reservas y atención al cliente por WhatsApp — todo en una plataforma.",
      whatsapp: {
        title: "Chatbot de WhatsApp Business",
        desc: "Responda mensajes de clientes automáticamente 24/7. Incluso las consultas a las 2 de la madrugada reciben respuesta instantánea.",
      },
      ai: {
        title: "Reserva impulsada por IA",
        desc: "La IA recopila fecha, número de personas, nombre y teléfono paso a paso — y crea la reserva automáticamente.",
      },
      multilingual: {
        title: "Atención al cliente en 7 idiomas",
        desc: "Los turistas alemanes, rusos, árabes escriben en su idioma — el chatbot responde igual. No se necesita traductor.",
      },
      automation: {
        title: "Gestión automatizada de tours",
        desc: "Seguimiento de cupos, recordatorios de tours, segmentación de clientes — todo automático.",
      },
    },
    indexSolutions: {
      title: "Soluciones específicas del sector",
      subtitle: "Configuraciones personalizadas para cada tipo de agencia.",
      incoming: {
        title: "Agencias receptivas",
        desc: "Atienda a turistas extranjeros en 7 idiomas, 24/7. Culturalmente adaptado, respuestas inmediatas.",
        bullets: [
          "Alemán, ruso, árabe — automatizado",
          "La diferencia horaria no es problema — 24/7",
          "Acceso directo al mercado internacional",
        ],
      },
      dayTour: {
        title: "Operadores de tours de día",
        desc: "Reservas rápidas, ventas de último momento, gestión dinámica de cupos.",
        bullets: [
          "Consulta de plazas y reserva en tiempo real",
          "Los últimos cupos se cierran automáticamente",
          "No pierda reservas nocturnas",
        ],
      },
      boutique: {
        title: "Agencias boutique",
        desc: "Toque personal + tecnología moderna. Imagen de gran empresa con pequeño presupuesto.",
        bullets: [
          "Planes desde ₺2.999/mes",
          "Configuración en 5-10 minutos",
          "20% del coste de un empleado",
        ],
      },
    },
    footer: {
      company: "Empresa",
      resources: "Recursos",
      about: "Sobre nosotros",
      kvkk: "Política de privacidad",
      termsOfUse: "Términos de servicio",
      helpCenter: "Centro de ayuda",
      requestDemo: "Solicitar demo",
      whatsappChatbot: "Chatbot de WhatsApp",
      aiReservation: "Reserva con IA",
      multilingualService: "Servicio multilingüe",
      tourAutomation: "Automatización de tours",
      incomingAgencies: "Agencias receptivas",
      dayTours: "Tours de día",
      boutiqueAgencies: "Agencias boutique",
      comparison: "Comparativa",
      copyright: "© {year} Turzz AI. Todos los derechos reservados.",
      dataDeletion: "Eliminación de datos",
      dataExport: "Exportar datos",
    },
  },
};

const langs = ['tr','en','de','ru','ar','fr','es'];

for (const lang of langs) {
  const path = `src/i18n/locales/${lang}.json`;
  const d = JSON.parse(readFileSync(path, 'utf8'));
  const a = additions[lang];

  // Merge top-level keys, deep-merge nav/footer/pricing/cta
  for (const [key, value] of Object.entries(a)) {
    if (typeof value === 'object' && !Array.isArray(value) && d[key]) {
      d[key] = { ...d[key], ...value };
    } else {
      d[key] = value;
    }
  }

  writeFileSync(path, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log(`${lang} ✓`);
}
console.log('Done — all 7 locales updated.');
