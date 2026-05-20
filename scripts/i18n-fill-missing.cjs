/**
 * Admin panel i18n tamamlama scripti
 * EN/DE/FR/ES/RU/AR için eksik key'leri doldurur
 */
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

function applyTranslations(lang, translations) {
  const filePath = path.join(localesDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let count = 0;
  for (const [key, value] of Object.entries(translations)) {
    const flat = flatten(data);
    if (!(key in flat)) {
      setNestedKey(data, key, value);
      count++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${lang}: ${count} key eklendi`);
  return count;
}

// ─── TRANSLATIONS ──────────────────────────────────────────────────────────────

const translations = {

  en: {
    // admin.filters
    'admin.filters.title': 'Filters',
    'admin.filters.tourDate': 'Tour Date',
    'admin.filters.sourceChannel': 'Source Channel',
    'admin.filters.allDates': 'All Dates',

    // feedback
    'feedback.dateFilter': 'Date Range Filter',

    // admin.tourForm
    'admin.tourForm.addTour': 'Add New Tour',
    'admin.tourForm.editTour': 'Edit Tour',
    'admin.tourForm.description': 'Fill in the tour details',
    'admin.tourForm.title': 'Tour Title',
    'admin.tourForm.titlePlaceholder': 'Cappadocia Tour',
    'admin.tourForm.destination': 'Destination',
    'admin.tourForm.destinationPlaceholder': 'Cappadocia',
    'admin.tourForm.type': 'Tour Type',
    'admin.tourForm.selectType': 'Select type',
    'admin.tourForm.currency': 'Currency',
    'admin.tourForm.minPax': 'Minimum Participants',
    'admin.tourForm.visaRequired': 'Visa Required',
    'admin.tourForm.programUrl': 'Program PDF Link',
    'admin.tourForm.programUrlPlaceholder': 'https://...',
    'admin.tourForm.shortProgram': 'Short Itinerary',
    'admin.tourForm.shortProgramPlaceholder': 'Brief description...',
    'admin.tourForm.departurePoint': 'Departure Point',
    'admin.tourForm.departurePlaceholder': 'Antalya Airport',
    'admin.tourForm.meetingTime': 'Meeting Time',
    'admin.tourForm.meetingPlaceholder': '08:00',
    'admin.tourForm.duration': 'Tour Duration',
    'admin.tourForm.durationPlaceholder': '3 days 2 nights',
    'admin.tourForm.accommodation': 'Accommodation',
    'admin.tourForm.accommodationPlaceholder': '5* Hotel',
    'admin.tourForm.transportation': 'Transportation',
    'admin.tourForm.transportationPlaceholder': 'Flight + Bus',
    'admin.tourForm.category': 'Tour Category',
    'admin.tourForm.categoryPlaceholder': 'Cultural Tour',
    'admin.tourForm.places': 'Places to Visit',
    'admin.tourForm.placesPlaceholder': 'Place 1, Place 2...',
    'admin.tourForm.cancel': 'Cancel',
    'admin.tourForm.save': 'Save',
    'admin.tourForm.saving': 'Saving...',
    'admin.tourForm.error': 'Error',
    'admin.tourForm.titleMinLength': 'Tour name must be at least 3 characters',
    'admin.tourForm.destinationMinLength': 'Destination must be at least 2 characters',
    'admin.tourForm.fillRequired': 'Please fill in all required fields',
    'admin.tourForm.addSuccess': 'Tour added successfully',
    'admin.tourForm.updateSuccess': 'Tour updated successfully',

    // admin.agencyManagement
    'admin.agencyManagement.title': 'Agency Management',
    'admin.agencyManagement.addNewAgency': 'Add New Agency',

    // admin.subscriptionHistory
    'admin.subscriptionHistory.title': 'Subscription History',
    'admin.subscriptionHistory.description': 'Payment and transaction history',

    // admin.subscription
    'admin.subscription.planFeatures': 'Plan Features',
    'admin.subscription.activePlan': 'Active Plan',
    'admin.subscription.savings': 'savings',
    'admin.subscription.trialEndsIn': 'Trial ends in',
    'admin.subscription.subscriptionEndsIn': 'Subscription ends in',
    'admin.subscription.daysLeft': 'days left',
    'admin.subscription.renewSubscription': 'Renew Subscription',
    'admin.subscription.noTransactions': 'No transaction history yet',
    'admin.subscription.actions': 'Actions',
    'admin.subscription.downloadInvoice': 'Download Invoice',
    'admin.subscription.statuses.success': 'Successful',
    'admin.subscription.statuses.failed': 'Failed',
    'admin.subscription.statuses.pending': 'Pending',
    'admin.subscription.statuses.cancelled': 'Cancelled',

    // admin.dashboard (super-admin only)
    'admin.subtitle': 'Overview',
    'admin.totalAgencies': 'Total Agencies',
    'admin.activeAgencies': 'Active Agencies',
    'admin.totalMessages': 'Total Messages',
    'admin.conversionRate': 'Conversion Rate',
    'admin.dashboard.title': 'Dashboard',
    'admin.dashboard.mostRegisteredPlaces': 'Most Registered Destinations',
    'admin.dashboard.filterByDate': 'Filter by Date',
    'admin.dashboard.allTime': 'All Time',
    'admin.dashboard.today': 'Today',
    'admin.dashboard.thisWeek': 'This Week',
    'admin.dashboard.thisMonth': 'This Month',
    'admin.dashboard.yearlyRevenue': 'Annual Revenue (Estimate)',
    'admin.dashboard.totalPotentialYearlyRevenue': 'Total potential annual revenue',
    'admin.dashboard.totalActiveAgencies': 'Total active agencies:',
    'admin.dashboard.avgAgencyValue': 'Average agency value:',
    'admin.dashboard.revenueTrend': 'Revenue Trend',
    'admin.dashboard.monthlyRevenueLabel': 'Monthly Revenue',
    'admin.dashboard.newAgencies': 'New Agencies',
    'admin.dashboard.last': 'Last',
    'admin.dashboard.months': 'months',
    'admin.dashboard.geographicDistribution': 'Geographic Distribution',
    'admin.dashboard.topCitiesByAgencies': 'Top Cities by Agencies',
    'admin.dashboard.location': 'Location',
    'admin.dashboard.agencyCount': 'Agency Count',
    'admin.dashboard.plans': 'Plans:',
    'admin.dashboard.starter': 'Starter',
    'admin.dashboard.professional': 'Professional',
    'admin.dashboard.enterprise': 'Enterprise',
    'admin.dashboard.unspecified': 'Unspecified',
    'admin.dashboard.noData': 'No data',
    'admin.dashboard.active': 'active',
    'admin.dashboard.inactive': 'inactive',
    'admin.dashboard.trialVersion': 'Trial Version',
    'admin.dashboard.agenciesInTrial': 'Agencies in trial',
    'admin.dashboard.totalMessages': 'Total Messages',
    'admin.dashboard.messagesUsedThisMonth': 'Messages used this month',
    'admin.dashboard.yearlyValueText': 'Annual value of current paid subscriptions',
    'admin.dashboard.revenueGrowthTrend': 'Revenue & Growth Trend',
    'admin.dashboard.realPaymentDataAnalysis': 'Analysis based on real payment data',
    'admin.dashboard.filters': 'Filters',
    'admin.dashboard.dateRange': 'Date Range',
    'admin.dashboard.last3Months': 'Last 3 Months',
    'admin.dashboard.last6Months': 'Last 6 Months',
    'admin.dashboard.last12Months': 'Last 12 Months',
    'admin.dashboard.last24Months': 'Last 24 Months',
    'admin.dashboard.planTypes': 'Plan Types',
    'admin.dashboard.starterPlanPrice': 'Starter',
    'admin.dashboard.professionalPlanPrice': 'Professional',
    'admin.dashboard.enterprisePlanPrice': 'Enterprise',
    'admin.dashboard.compareWithPrevious': 'Compare with previous period',
    'admin.dashboard.revenue': 'Revenue',
    'admin.dashboard.activeFilter': 'Active Filter:',
    'admin.dashboard.only': 'Only',
    'admin.dashboard.plansShowing': 'plans shown',
    'admin.dashboard.geographicDistributionTitle': 'Agency Geographic Distribution',
    'admin.dashboard.geographicDistributionDesc': 'Distribution of agencies by city and region (Top 10 locations)',
    'admin.dashboard.agencies': 'agencies',
    'admin.dashboard.noLocationInfo': 'No Location Data Found',
    'admin.dashboard.noLocationInfoDesc': 'No agency has entered location information yet. Geographic distribution will be shown here once agencies add city and region data.',
    'admin.dashboard.superAdminDescription': 'Monitor the overall status and usage statistics of all agencies here. Use the "Agencies" tab for detailed management.',

    // admin.agency
    'admin.agency.updateInfo': 'Update agency information',
    'admin.agency.createAccount': 'Create new agency account',
    'admin.agency.name': 'Agency Name',
    'admin.agency.owner': 'Agency Owner',
    'admin.agency.city': 'City',
    'admin.agency.region': 'Region',
    'admin.agency.status': 'Status',
    'admin.agency.messageQuota': 'Message Quota',
    'admin.agency.remainingTime': 'Remaining Time',
    'admin.agency.actions': 'Actions',
    'admin.agency.form.cityPlaceholder': 'Istanbul',
    'admin.agency.form.regionPlaceholder': 'Marmara',
    'admin.agency.tableHeaders.phone': 'Phone',
    'admin.agency.plans.starterWithLimit': 'Starter (500 messages/month)',
    'admin.agency.plans.professionalWithLimit': 'Professional (2,000 messages/month)',
    'admin.agency.plans.enterpriseWithLimit': 'Enterprise (Unlimited)',
  },

  de: {
    // admin.filters
    'admin.filters.title': 'Filter',
    'admin.filters.tourDate': 'Reisedatum',
    'admin.filters.sourceChannel': 'Kanal',
    'admin.filters.allDates': 'Alle Daten',

    // feedback
    'feedback.dateFilter': 'Datumsbereich',

    // admin.tourForm
    'admin.tourForm.addTour': 'Neue Tour hinzufügen',
    'admin.tourForm.editTour': 'Tour bearbeiten',
    'admin.tourForm.description': 'Tour-Details ausfüllen',
    'admin.tourForm.title': 'Tour-Titel',
    'admin.tourForm.titlePlaceholder': 'Kappadokien-Tour',
    'admin.tourForm.destination': 'Reiseziel',
    'admin.tourForm.destinationPlaceholder': 'Kappadokien',
    'admin.tourForm.type': 'Tourtyp',
    'admin.tourForm.selectType': 'Typ auswählen',
    'admin.tourForm.currency': 'Währung',
    'admin.tourForm.minPax': 'Mindest-Teilnehmeranzahl',
    'admin.tourForm.visaRequired': 'Visum erforderlich',
    'admin.tourForm.programUrl': 'Programm-PDF-Link',
    'admin.tourForm.programUrlPlaceholder': 'https://...',
    'admin.tourForm.shortProgram': 'Kurzes Programm',
    'admin.tourForm.shortProgramPlaceholder': 'Kurzbeschreibung...',
    'admin.tourForm.departurePoint': 'Abfahrtsort',
    'admin.tourForm.departurePlaceholder': 'Flughafen Antalya',
    'admin.tourForm.meetingTime': 'Treffpunkt-Zeit',
    'admin.tourForm.meetingPlaceholder': '08:00',
    'admin.tourForm.duration': 'Tour-Dauer',
    'admin.tourForm.durationPlaceholder': '3 Tage 2 Nächte',
    'admin.tourForm.accommodation': 'Unterkunft',
    'admin.tourForm.accommodationPlaceholder': '5* Hotel',
    'admin.tourForm.transportation': 'Transport',
    'admin.tourForm.transportationPlaceholder': 'Flug + Bus',
    'admin.tourForm.category': 'Tour-Kategorie',
    'admin.tourForm.categoryPlaceholder': 'Kulturtour',
    'admin.tourForm.places': 'Besuchsorte',
    'admin.tourForm.placesPlaceholder': 'Ort 1, Ort 2...',
    'admin.tourForm.cancel': 'Abbrechen',
    'admin.tourForm.save': 'Speichern',
    'admin.tourForm.saving': 'Wird gespeichert...',
    'admin.tourForm.error': 'Fehler',
    'admin.tourForm.titleMinLength': 'Tour-Name muss mindestens 3 Zeichen lang sein',
    'admin.tourForm.destinationMinLength': 'Reiseziel muss mindestens 2 Zeichen lang sein',
    'admin.tourForm.fillRequired': 'Bitte füllen Sie alle Pflichtfelder aus',
    'admin.tourForm.addSuccess': 'Tour erfolgreich hinzugefügt',
    'admin.tourForm.updateSuccess': 'Tour erfolgreich aktualisiert',

    // admin.agencyManagement
    'admin.agencyManagement.title': 'Agenturverwaltung',
    'admin.agencyManagement.addNewAgency': 'Neue Agentur hinzufügen',

    // admin.subscriptionHistory
    'admin.subscriptionHistory.title': 'Abonnementverlauf',
    'admin.subscriptionHistory.description': 'Zahlungs- und Transaktionsverlauf',

    // admin.subscription
    'admin.subscription.planFeatures': 'Paketfunktionen',
    'admin.subscription.activePlan': 'Aktives Paket',
    'admin.subscription.savings': 'Ersparnis',
    'admin.subscription.trialEndsIn': 'Testphase endet in',
    'admin.subscription.subscriptionEndsIn': 'Abonnement endet in',
    'admin.subscription.daysLeft': 'Tage verbleibend',
    'admin.subscription.renewSubscription': 'Abonnement verlängern',
    'admin.subscription.noTransactions': 'Noch kein Transaktionsverlauf',
    'admin.subscription.actions': 'Aktionen',
    'admin.subscription.downloadInvoice': 'Rechnung herunterladen',
    'admin.subscription.statuses.success': 'Erfolgreich',
    'admin.subscription.statuses.failed': 'Fehlgeschlagen',
    'admin.subscription.statuses.pending': 'Ausstehend',
    'admin.subscription.statuses.cancelled': 'Storniert',

    // admin.whatsapp.userProfiles
    'admin.whatsapp.userProfiles.tabs.profile': 'Profilinformationen',
    'admin.whatsapp.userProfiles.tabs.preferences': 'Präferenzen',
    'admin.whatsapp.userProfiles.tabs.tags': 'Tags',
    'admin.whatsapp.userProfiles.tabs.conversations': 'Gesprächsverlauf',
    'admin.whatsapp.userProfiles.salesStats': 'Verkaufsstatistiken',
    'admin.whatsapp.userProfiles.totalBookings': 'Gesamtbuchungen',
    'admin.whatsapp.userProfiles.totalSpent': 'Gesamtausgaben',
    'admin.whatsapp.userProfiles.averageSpending': 'Durchschnittliche Ausgaben',
    'admin.whatsapp.userProfiles.communicationMetrics': 'Kommunikationsstatistiken',
    'admin.whatsapp.userProfiles.dailyAverage': 'Tagesdurchschnitt',
    'admin.whatsapp.userProfiles.firstInteraction': 'Erste Interaktion',
    'admin.whatsapp.userProfiles.lastInteraction': 'Letzte Interaktion',
    'admin.whatsapp.userProfiles.preferencesInterests': 'Präferenzen & Interessen',
    'admin.whatsapp.userProfiles.interestedDestinations': 'Interessante Reiseziele',
    'admin.whatsapp.userProfiles.lastSearch': 'Letzte Suche',
    'admin.whatsapp.userProfiles.customerSatisfaction': 'Kundenzufriedenheit',
    'admin.whatsapp.userProfiles.feedbackScore': 'Bewertungspunkt',
    'admin.whatsapp.userProfiles.feedbackComment': 'Kommentar',
    'admin.whatsapp.userProfiles.noFeedback': 'Noch kein Feedback',
    'admin.whatsapp.userProfiles.customerTags': 'Kunden-Tags',
    'admin.whatsapp.userProfiles.addTag': 'Tag hinzufügen',
    'admin.whatsapp.userProfiles.tagAdded': 'Tag hinzugefügt',
    'admin.whatsapp.userProfiles.tagRemoved': 'Tag entfernt',
    'admin.whatsapp.userProfiles.tagError': 'Tag-Vorgang fehlgeschlagen',
    'admin.whatsapp.userProfiles.conversationHistory': 'Gesprächsverlauf',
    'admin.whatsapp.userProfiles.loadingConversations': 'Gespräche werden geladen...',
    'admin.whatsapp.userProfiles.noConversations': 'Noch keine Gespräche',
    'admin.whatsapp.userProfiles.conversationError': 'Fehler beim Laden der Gespräche',
    'admin.whatsapp.userProfiles.customer': 'Kunde',
    'admin.whatsapp.userProfiles.assistant': 'Assistent',
  },

  fr: {
    'admin.tourForm.titleMinLength': 'Le nom de la visite doit contenir au moins 3 caractères',
    'admin.tourForm.destinationMinLength': 'La destination doit contenir au moins 2 caractères',
  },

  es: {
    // admin.filters
    'admin.filters.title': 'Filtros',
    'admin.filters.tourDate': 'Fecha del tour',
    'admin.filters.sourceChannel': 'Canal de origen',
    'admin.filters.allDates': 'Todas las fechas',

    // feedback
    'feedback.dateFilter': 'Filtro de rango de fechas',

    // admin.tourForm
    'admin.tourForm.addTour': 'Agregar nuevo tour',
    'admin.tourForm.editTour': 'Editar tour',
    'admin.tourForm.description': 'Complete los detalles del tour',
    'admin.tourForm.title': 'Título del tour',
    'admin.tourForm.titlePlaceholder': 'Tour de Capadocia',
    'admin.tourForm.destination': 'Destino',
    'admin.tourForm.destinationPlaceholder': 'Capadocia',
    'admin.tourForm.type': 'Tipo de tour',
    'admin.tourForm.selectType': 'Seleccionar tipo',
    'admin.tourForm.currency': 'Moneda',
    'admin.tourForm.minPax': 'Participantes mínimos',
    'admin.tourForm.visaRequired': 'Visa requerida',
    'admin.tourForm.programUrl': 'Enlace PDF del programa',
    'admin.tourForm.programUrlPlaceholder': 'https://...',
    'admin.tourForm.shortProgram': 'Programa corto',
    'admin.tourForm.shortProgramPlaceholder': 'Descripción breve...',
    'admin.tourForm.departurePoint': 'Punto de salida',
    'admin.tourForm.departurePlaceholder': 'Aeropuerto de Antalya',
    'admin.tourForm.meetingTime': 'Hora de encuentro',
    'admin.tourForm.meetingPlaceholder': '08:00',
    'admin.tourForm.duration': 'Duración del tour',
    'admin.tourForm.durationPlaceholder': '3 días 2 noches',
    'admin.tourForm.accommodation': 'Alojamiento',
    'admin.tourForm.accommodationPlaceholder': 'Hotel 5*',
    'admin.tourForm.transportation': 'Transporte',
    'admin.tourForm.transportationPlaceholder': 'Vuelo + Autobús',
    'admin.tourForm.category': 'Categoría del tour',
    'admin.tourForm.categoryPlaceholder': 'Tour cultural',
    'admin.tourForm.places': 'Lugares a visitar',
    'admin.tourForm.placesPlaceholder': 'Lugar 1, Lugar 2...',
    'admin.tourForm.cancel': 'Cancelar',
    'admin.tourForm.save': 'Guardar',
    'admin.tourForm.saving': 'Guardando...',
    'admin.tourForm.error': 'Error',
    'admin.tourForm.titleMinLength': 'El nombre del tour debe tener al menos 3 caracteres',
    'admin.tourForm.destinationMinLength': 'El destino debe tener al menos 2 caracteres',
    'admin.tourForm.fillRequired': 'Por favor, complete todos los campos obligatorios',
    'admin.tourForm.addSuccess': 'Tour agregado correctamente',
    'admin.tourForm.updateSuccess': 'Tour actualizado correctamente',

    // admin.agencyManagement
    'admin.agencyManagement.title': 'Gestión de agencias',
    'admin.agencyManagement.addNewAgency': 'Agregar nueva agencia',

    // admin.subscriptionHistory
    'admin.subscriptionHistory.title': 'Historial de suscripciones',
    'admin.subscriptionHistory.description': 'Historial de pagos y transacciones',

    // admin.subscription
    'admin.subscription.planFeatures': 'Características del plan',
    'admin.subscription.activePlan': 'Plan activo',
    'admin.subscription.savings': 'ahorro',
    'admin.subscription.trialEndsIn': 'El período de prueba termina en',
    'admin.subscription.subscriptionEndsIn': 'La suscripción termina en',
    'admin.subscription.daysLeft': 'días restantes',
    'admin.subscription.renewSubscription': 'Renovar suscripción',
    'admin.subscription.noTransactions': 'Aún no hay historial de transacciones',
    'admin.subscription.actions': 'Acciones',
    'admin.subscription.downloadInvoice': 'Descargar factura',
    'admin.subscription.statuses.success': 'Exitoso',
    'admin.subscription.statuses.failed': 'Fallido',
    'admin.subscription.statuses.pending': 'Pendiente',
    'admin.subscription.statuses.cancelled': 'Cancelado',

    // admin.whatsapp.userProfiles
    'admin.whatsapp.userProfiles.tabs.profile': 'Información del perfil',
    'admin.whatsapp.userProfiles.tabs.preferences': 'Preferencias',
    'admin.whatsapp.userProfiles.tabs.tags': 'Etiquetas',
    'admin.whatsapp.userProfiles.tabs.conversations': 'Historial de conversaciones',
    'admin.whatsapp.userProfiles.salesStats': 'Estadísticas de ventas',
    'admin.whatsapp.userProfiles.totalBookings': 'Total de reservas',
    'admin.whatsapp.userProfiles.totalSpent': 'Total gastado',
    'admin.whatsapp.userProfiles.averageSpending': 'Gasto promedio',
    'admin.whatsapp.userProfiles.communicationMetrics': 'Métricas de comunicación',
    'admin.whatsapp.userProfiles.dailyAverage': 'Promedio diario',
    'admin.whatsapp.userProfiles.firstInteraction': 'Primera interacción',
    'admin.whatsapp.userProfiles.lastInteraction': 'Última interacción',
    'admin.whatsapp.userProfiles.preferencesInterests': 'Preferencias e intereses',
    'admin.whatsapp.userProfiles.interestedDestinations': 'Destinos de interés',
    'admin.whatsapp.userProfiles.lastSearch': 'Última búsqueda',
    'admin.whatsapp.userProfiles.customerSatisfaction': 'Satisfacción del cliente',
    'admin.whatsapp.userProfiles.feedbackScore': 'Puntuación de satisfacción',
    'admin.whatsapp.userProfiles.feedbackComment': 'Comentario',
    'admin.whatsapp.userProfiles.noFeedback': 'Aún no hay comentarios',
    'admin.whatsapp.userProfiles.customerTags': 'Etiquetas del cliente',
    'admin.whatsapp.userProfiles.addTag': 'Agregar etiqueta',
    'admin.whatsapp.userProfiles.tagAdded': 'Etiqueta agregada',
    'admin.whatsapp.userProfiles.tagRemoved': 'Etiqueta eliminada',
    'admin.whatsapp.userProfiles.tagError': 'Error en la operación de etiqueta',
    'admin.whatsapp.userProfiles.conversationHistory': 'Historial de conversaciones',
    'admin.whatsapp.userProfiles.loadingConversations': 'Cargando conversaciones...',
    'admin.whatsapp.userProfiles.noConversations': 'Aún no hay conversaciones',
    'admin.whatsapp.userProfiles.conversationError': 'Error al cargar las conversaciones',
    'admin.whatsapp.userProfiles.customer': 'Cliente',
    'admin.whatsapp.userProfiles.assistant': 'Asistente',
  },

  ru: {
    // admin.filters
    'admin.filters.title': 'Фильтры',
    'admin.filters.tourDate': 'Дата тура',
    'admin.filters.sourceChannel': 'Канал источника',
    'admin.filters.allDates': 'Все даты',

    // feedback
    'feedback.dateFilter': 'Фильтр по дате',

    // admin.tourForm
    'admin.tourForm.addTour': 'Добавить новый тур',
    'admin.tourForm.editTour': 'Редактировать тур',
    'admin.tourForm.description': 'Заполните детали тура',
    'admin.tourForm.title': 'Название тура',
    'admin.tourForm.titlePlaceholder': 'Тур в Каппадокию',
    'admin.tourForm.destination': 'Направление',
    'admin.tourForm.destinationPlaceholder': 'Каппадокия',
    'admin.tourForm.type': 'Тип тура',
    'admin.tourForm.selectType': 'Выберите тип',
    'admin.tourForm.currency': 'Валюта',
    'admin.tourForm.minPax': 'Минимальное количество участников',
    'admin.tourForm.visaRequired': 'Требуется виза',
    'admin.tourForm.programUrl': 'Ссылка на PDF программы',
    'admin.tourForm.programUrlPlaceholder': 'https://...',
    'admin.tourForm.shortProgram': 'Краткая программа',
    'admin.tourForm.shortProgramPlaceholder': 'Краткое описание...',
    'admin.tourForm.departurePoint': 'Место отправления',
    'admin.tourForm.departurePlaceholder': 'Аэропорт Анталии',
    'admin.tourForm.meetingTime': 'Время встречи',
    'admin.tourForm.meetingPlaceholder': '08:00',
    'admin.tourForm.duration': 'Продолжительность тура',
    'admin.tourForm.durationPlaceholder': '3 дня 2 ночи',
    'admin.tourForm.accommodation': 'Проживание',
    'admin.tourForm.accommodationPlaceholder': 'Отель 5*',
    'admin.tourForm.transportation': 'Транспорт',
    'admin.tourForm.transportationPlaceholder': 'Самолёт + Автобус',
    'admin.tourForm.category': 'Категория тура',
    'admin.tourForm.categoryPlaceholder': 'Культурный тур',
    'admin.tourForm.places': 'Места посещения',
    'admin.tourForm.placesPlaceholder': 'Место 1, Место 2...',
    'admin.tourForm.cancel': 'Отмена',
    'admin.tourForm.save': 'Сохранить',
    'admin.tourForm.saving': 'Сохранение...',
    'admin.tourForm.error': 'Ошибка',
    'admin.tourForm.titleMinLength': 'Название тура должно содержать не менее 3 символов',
    'admin.tourForm.destinationMinLength': 'Направление должно содержать не менее 2 символов',
    'admin.tourForm.fillRequired': 'Пожалуйста, заполните все обязательные поля',
    'admin.tourForm.addSuccess': 'Тур успешно добавлен',
    'admin.tourForm.updateSuccess': 'Тур успешно обновлён',

    // admin.agencyManagement
    'admin.agencyManagement.title': 'Управление агентствами',
    'admin.agencyManagement.addNewAgency': 'Добавить новое агентство',

    // admin.subscriptionHistory
    'admin.subscriptionHistory.title': 'История подписок',
    'admin.subscriptionHistory.description': 'История платежей и транзакций',

    // admin.subscription
    'admin.subscription.planFeatures': 'Функции плана',
    'admin.subscription.activePlan': 'Активный план',
    'admin.subscription.savings': 'экономия',
    'admin.subscription.trialEndsIn': 'Пробный период заканчивается',
    'admin.subscription.subscriptionEndsIn': 'Подписка заканчивается',
    'admin.subscription.daysLeft': 'дней осталось',
    'admin.subscription.renewSubscription': 'Продлить подписку',
    'admin.subscription.noTransactions': 'История транзакций пока отсутствует',
    'admin.subscription.actions': 'Действия',
    'admin.subscription.downloadInvoice': 'Скачать счёт',
    'admin.subscription.statuses.success': 'Успешно',
    'admin.subscription.statuses.failed': 'Неудачно',
    'admin.subscription.statuses.pending': 'Ожидание',
    'admin.subscription.statuses.cancelled': 'Отменено',

    // admin.whatsapp.userProfiles
    'admin.whatsapp.userProfiles.tabs.profile': 'Информация профиля',
    'admin.whatsapp.userProfiles.tabs.preferences': 'Предпочтения',
    'admin.whatsapp.userProfiles.tabs.tags': 'Теги',
    'admin.whatsapp.userProfiles.tabs.conversations': 'История разговоров',
    'admin.whatsapp.userProfiles.salesStats': 'Статистика продаж',
    'admin.whatsapp.userProfiles.totalBookings': 'Всего бронирований',
    'admin.whatsapp.userProfiles.totalSpent': 'Всего потрачено',
    'admin.whatsapp.userProfiles.averageSpending': 'Средние расходы',
    'admin.whatsapp.userProfiles.communicationMetrics': 'Коммуникационная статистика',
    'admin.whatsapp.userProfiles.dailyAverage': 'Ежедневное среднее',
    'admin.whatsapp.userProfiles.firstInteraction': 'Первое взаимодействие',
    'admin.whatsapp.userProfiles.lastInteraction': 'Последнее взаимодействие',
    'admin.whatsapp.userProfiles.preferencesInterests': 'Предпочтения и интересы',
    'admin.whatsapp.userProfiles.interestedDestinations': 'Интересующие направления',
    'admin.whatsapp.userProfiles.lastSearch': 'Последний поиск',
    'admin.whatsapp.userProfiles.customerSatisfaction': 'Удовлетворённость клиента',
    'admin.whatsapp.userProfiles.feedbackScore': 'Оценка удовлетворённости',
    'admin.whatsapp.userProfiles.feedbackComment': 'Комментарий',
    'admin.whatsapp.userProfiles.noFeedback': 'Пока нет отзывов',
    'admin.whatsapp.userProfiles.customerTags': 'Теги клиента',
    'admin.whatsapp.userProfiles.addTag': 'Добавить тег',
    'admin.whatsapp.userProfiles.tagAdded': 'Тег добавлен',
    'admin.whatsapp.userProfiles.tagRemoved': 'Тег удалён',
    'admin.whatsapp.userProfiles.tagError': 'Ошибка операции с тегом',
    'admin.whatsapp.userProfiles.conversationHistory': 'История разговоров',
    'admin.whatsapp.userProfiles.loadingConversations': 'Загрузка разговоров...',
    'admin.whatsapp.userProfiles.noConversations': 'Разговоров пока нет',
    'admin.whatsapp.userProfiles.conversationError': 'Ошибка загрузки разговоров',
    'admin.whatsapp.userProfiles.customer': 'Клиент',
    'admin.whatsapp.userProfiles.assistant': 'Ассистент',
  },

  ar: {
    'admin.tourForm.titleMinLength': 'يجب أن يحتوي اسم الجولة على 3 أحرف على الأقل',
    'admin.tourForm.destinationMinLength': 'يجب أن يحتوي الوجهة على حرفين على الأقل',
  },
};

// Apply all translations
let total = 0;
for (const [lang, trans] of Object.entries(translations)) {
  total += applyTranslations(lang, trans);
}
console.log(`\nToplam eklenen key: ${total}`);
