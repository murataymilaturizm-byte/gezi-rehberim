// Demo tour data configuration
export const DEMO_AGENCY_ID = "00000000-0000-0000-0000-000000000000";

// Demo payment instructions for demo agency
export const DEMO_PAYMENT_INSTRUCTIONS = {
  payment_type: 'deposit',
  deposit_percentage: 30,
  payment_methods: ['bank_transfer', 'cash_office', 'cash_on_tour', 'credit_card'],
  bank_info: {
    tr: {
      bank_name: 'Demo Bank',
      iban: 'TR11 1111 1111 1111 1111 1111 11',
      account_holder: 'Örnek Turizm Ltd. Şti.'
    },
    en: {
      bank_name: 'Demo Bank',
      iban: 'TR11 1111 1111 1111 1111 1111 11',
      account_holder: 'Sample Tourism Ltd.'
    },
    de: {
      bank_name: 'Demo Bank',
      iban: 'TR11 1111 1111 1111 1111 1111 11',
      account_holder: 'Beispiel Tourismus GmbH'
    },
    ru: {
      bank_name: 'Демо Банк',
      iban: 'TR11 1111 1111 1111 1111 1111 11',
      account_holder: 'Пример Туризм ООО'
    },
    fr: {
      bank_name: 'Banque Démo',
      iban: 'TR11 1111 1111 1111 1111 1111 11',
      account_holder: 'Exemple Tourisme SARL'
    },
    es: {
      bank_name: 'Banco Demo',
      iban: 'TR11 1111 1111 1111 1111 1111 11',
      account_holder: 'Ejemplo Turismo S.L.'
    },
    ar: {
      bank_name: 'بنك تجريبي',
      iban: 'TR11 1111 1111 1111 1111 1111 11',
      account_holder: 'شركة السياحة النموذجية'
    }
  },
  office_address: 'Demo Caddesi No:1 Merkez/İstanbul',
  working_hours: '09:00 - 18:00',
  phone_number: '+90 555 111 1111'
};

export const DEMO_TOURS = [
  {
    id: 'demo-kapadokya-1',
    title: 'Kapadokya Balon Turu',
    destination: 'Kapadokya',
    type: 'DAYTRIP',
    currency: 'TRY',
    program_kisa: 'Kapadokya\'da gün doğumunda unutulmaz bir sıcak hava balonu deneyimi.',
    gezilecek_yerler: 'Göreme Vadisi, Peribacaları, Uçhisar Kalesi (havadan)',
    toplanma_saati: '05:00',
    hareket_noktasi: 'Göreme Merkez',
    tur_sure: '3 saat (uçuş 1 saat)',
    ulasim: 'Otelden alım-bırakım dahil',
    konaklama: 'Günübirlik tur - konaklama yok',
    dates: [
      { id: 'demo-date-1', departure_date: '2026-04-15', price_adult: 1500, price_child: 1200, quota: 20 },
      { id: 'demo-date-2', departure_date: '2026-04-22', price_adult: 1500, price_child: 1200, quota: 15 },
      { id: 'demo-date-1b', departure_date: '2026-05-10', price_adult: 1600, price_child: 1300, quota: 20 },
      { id: 'demo-date-1c', departure_date: '2026-06-07', price_adult: 1800, price_child: 1400, quota: 18 }
    ]
  },
  {
    id: 'demo-kapadokya-2',
    title: 'Kapadokya Kültür Turu',
    destination: 'Kapadokya',
    type: 'N2',
    currency: 'TRY',
    program_kisa: 'Kapadokya\'nın tarihi ve kültürel zenginliklerini keşfedin.',
    gezilecek_yerler: 'Göreme Açık Hava Müzesi, Derinkuyu Yeraltı Şehri, Paşabağ Peribacaları, Avanos Çömlekçilik, Uçhisar Kalesi',
    toplanma_saati: '08:00',
    hareket_noktasi: 'Nevşehir Havalimanı veya Göreme Oteller',
    tur_sure: '2 gün 1 gece',
    ulasim: 'Klimalı otobüs',
    konaklama: 'Göreme\'de 4* otel, kahvaltı dahil',
    dates: [
      { id: 'demo-date-3', departure_date: '2026-04-18', price_adult: 2500, price_child: 2000, quota: 18 },
      { id: 'demo-date-3b', departure_date: '2026-05-16', price_adult: 2700, price_child: 2200, quota: 16 },
      { id: 'demo-date-3c', departure_date: '2026-06-20', price_adult: 2900, price_child: 2300, quota: 14 }
    ]
  },
  {
    id: 'demo-pamukkale-1',
    title: 'Pamukkale Turu',
    destination: 'Pamukkale',
    type: 'N2',
    currency: 'TRY',
    program_kisa: 'Beyaz cennet Pamukkale travertenleri ve antik Hierapolis kenti.',
    gezilecek_yerler: 'Pamukkale Travertenleri, Hierapolis Antik Kenti, Kleopatra Havuzu, Antik Tiyatro',
    toplanma_saati: '07:30',
    hareket_noktasi: 'Denizli',
    tur_sure: '2 gün 1 gece',
    ulasim: 'Klimalı otobüs',
    konaklama: 'Pamukkale\'de 4* termal otel, yarım pansiyon',
    dates: [
      { id: 'demo-date-4', departure_date: '2026-04-10', price_adult: 3500, price_child: 2800, quota: 15 },
      { id: 'demo-date-5', departure_date: '2026-04-25', price_adult: 3500, price_child: 2800, quota: 12 },
      { id: 'demo-date-5b', departure_date: '2026-05-22', price_adult: 3800, price_child: 3000, quota: 14 }
    ]
  },
  {
    id: 'demo-antalya-1',
    title: 'Antalya Rafting',
    destination: 'Antalya',
    type: 'DAYTRIP',
    currency: 'TRY',
    program_kisa: 'Köprülü Kanyon\'da adrenalin dolu rafting macerası.',
    gezilecek_yerler: 'Köprülü Kanyon Milli Parkı, Köprüçay Nehri (14 km rafting)',
    toplanma_saati: '08:30',
    hareket_noktasi: 'Antalya oteller bölgesi',
    tur_sure: 'Günübirlik (sabah 08:30 - akşam 17:00)',
    ulasim: 'Otelden alım-bırakım',
    konaklama: 'Günübirlik - konaklama yok',
    dates: [
      { id: 'demo-date-6', departure_date: '2025-12-05', price_adult: 800, price_child: 600, quota: 30 },
      { id: 'demo-date-7', departure_date: '2025-12-12', price_adult: 800, price_child: 600, quota: 25 }
    ]
  },
  {
    id: 'demo-ege-1',
    title: 'Ege Turu',
    destination: 'İzmir-Çeşme-Alaçatı',
    type: 'N3',
    currency: 'TRY',
    program_kisa: 'Ege\'nin incisi Çeşme, rüzgar başkenti Alaçatı ve antik Efes.',
    gezilecek_yerler: 'Çeşme Marina, Alaçatı Taş Sokaklar, Efes Antik Kenti, Artemis Tapınağı, Şirince Köyü',
    toplanma_saati: '09:00',
    hareket_noktasi: 'İzmir Adnan Menderes Havalimanı',
    tur_sure: '3 gün 2 gece',
    ulasim: 'Klimalı minibüs',
    konaklama: 'Çeşme\'de 5* resort otel, her şey dahil',
    dates: [
      { id: 'demo-date-8', departure_date: '2025-12-14', price_adult: 4500, price_child: 3600, quota: 10 }
    ]
  }
];
