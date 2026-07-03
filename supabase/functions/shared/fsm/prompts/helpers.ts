// Helper functions for formatting prompts - TONE-AWARE VERSION
import { formatDateForLanguage } from "../localization.ts";

export function formatDateHeader(language: string): string {
  const now = new Date();
  const currentDateStr = formatDateForLanguage(now.toISOString().split("T")[0], language);

  const dayNames: Record<string, string[]> = {
    tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
    en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    ru: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
    ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
    fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
    es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
  };

  const dayName = (dayNames[language] || dayNames.tr)[now.getDay()];
  return `📅 CURRENT DATE: ${dayName}, ${currentDateStr}`;
}

/**
 * Format tours list with tone-aware styling
 */
export function formatToursList(tours: any[], language: string, tone: string = "standart"): string {
  if (!tours || tours.length === 0) {
    return language === "tr"
      ? "Şu an sistemde tanımlı aktif tur bulunmuyor."
      : "There are no active tours defined in the system at the moment.";
  }

  switch (tone) {
    case "kurumsal":
      return formatToursListCorporate(tours, language);
    case "dinamik":
      return formatToursListDynamic(tours, language);
    case "premium":
      return formatToursListPremium(tours, language);
    default:
      return formatToursListStandard(tours, language);
  }
}

// STANDART TONE
// Demo chat formatıyla uyumlu: numaralı liste, gezilecek yerler, fiyat
// *tek yıldız* kullanır (WhatsApp uyumlu)
function formatToursListStandard(tours: any[], language: string): string {
  const isTR = language === "tr";

  return tours
    .map((tour, idx) => {
      const firstDate = tour.dates?.[0];
      const price = firstDate?.price_adult;
      const rawDate = firstDate?.departure_date;
      const formattedDate = rawDate ? formatDateForLanguage(rawDate, language) : "";

      const icon = getTourIcon(tour.type);
      const priceText = price ? (isTR ? `💰 ${price}₺` : `💰 ${price}₺`) : "";
      const dateText = formattedDate
        ? `📅 ${formattedDate}`
        : isTR
          ? "📅 Tarih belirtilmemiş"
          : "📅 Date not specified";

      // Gezilecek yerler varsa ekle
      const placesText = tour.gezilecek_yerler ? `\n   🗺️ ${tour.gezilecek_yerler}` : "";

      if (isTR) {
        return `${idx + 1}. ${icon} *${tour.title}*\n   📍 ${tour.destination}${placesText}\n   ${priceText} | ${dateText}`;
      } else {
        return `${idx + 1}. ${icon} *${tour.title}*\n   📍 ${tour.destination}${placesText}\n   ${priceText} | ${dateText}`;
      }
    })
    .join("\n\n");
}

// KURUMSAL TONE - Formal and structured
function formatToursListCorporate(tours: any[], language: string): string {
  const isTR = language === "tr";

  return tours
    .map((tour, idx) => {
      const firstDate = tour.dates?.[0];
      const price = firstDate?.price_adult;
      const rawDate = firstDate?.departure_date;
      const formattedDate = rawDate ? formatDateForLanguage(rawDate, language) : "";

      if (isTR) {
        return `${idx + 1}) *${tour.title}*\n   Destinasyon: ${tour.destination}\n   Fiyat: ${price ? price + " TRY" : "Belirtilmemiş"} (kişi başı)\n   İlk Tarih: ${formattedDate || "Belirtilmemiş"}`;
      } else {
        return `${idx + 1}) *${tour.title}*\n   Destination: ${tour.destination}\n   Price: ${price ? price + " TRY" : "Not specified"} (per person)\n   First Date: ${formattedDate || "Not specified"}`;
      }
    })
    .join("\n\n");
}

// DİNAMİK TONE - Energetic and exciting
function formatToursListDynamic(tours: any[], language: string): string {
  const isTR = language === "tr";

  return tours
    .map((tour, idx) => {
      const firstDate = tour.dates?.[0];
      const price = firstDate?.price_adult;
      const rawDate = firstDate?.departure_date;
      const formattedDate = rawDate ? formatDateForLanguage(rawDate, language) : "";

      const icon = getTourIcon(tour.type);
      const numberEmoji = getNumberEmoji(idx + 1);

      if (isTR) {
        return `${numberEmoji} *${tour.title}* ${icon}\n   ⭐ ${tour.destination}\n   💎 ${price}₺ | 🚀 ${formattedDate}`;
      } else {
        return `${numberEmoji} *${tour.title}* ${icon}\n   ⭐ ${tour.destination}\n   💎 ${price}₺ | 🚀 ${formattedDate}`;
      }
    })
    .join("\n\n");
}

// PREMIUM TONE - Elegant and refined
function formatToursListPremium(tours: any[], language: string): string {
  const isTR = language === "tr";

  return tours
    .map((tour) => {
      const firstDate = tour.dates?.[0];
      const price = firstDate?.price_adult;
      const rawDate = firstDate?.departure_date;
      const formattedDate = rawDate ? formatDateForLanguage(rawDate, language) : "";

      const description = tour.program_kisa || (isTR ? "Eşsiz bir deneyim" : "An exclusive experience");

      if (isTR) {
        return `*${tour.title}*\n${description}\n${tour.destination} | ${price ? price + " TRY" : ""} | ${formattedDate}`;
      } else {
        return `*${tour.title}*\n${description}\n${tour.destination} | ${price ? price + " TRY" : ""} | ${formattedDate}`;
      }
    })
    .join("\n\n");
}

// Helper: Get tour type icon
function getTourIcon(type?: string): string {
  const icons: Record<string, string> = {
    cultural: "🏛️",
    adventure: "🏔️",
    city: "🌆",
    beach: "🏖️",
    nature: "🌿",
    historical: "🏰",
    food: "🍽️",
    default: "🗺️",
  };
  return icons[type || "default"] || icons.default;
}

// Helper: Get number emoji
function getNumberEmoji(num: number): string {
  const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  return emojis[num - 1] || `${num}.`;
}

/**
 * "HH:MM:SS" veya "HH:MM" formatındaki saati "HH:MM" olarak normalize et.
 * DB'de time without time zone tipi "07:30:00" şeklinde gelir; LLM'e kısa hal.
 * 2026-06-20 BUG 4 fix: bu helper olmadan LLM saat uyduruyordu (07:00/08:00 vs).
 */
function formatTime(t: any): string {
  if (!t) return "";
  const s = String(t);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : s;
}

/**
 * Format tour details with tone-aware styling
 * *tek yıldız* kullanır (WhatsApp uyumlu)
 */
export function formatTourDetails(tour: any, language: string, _tone: string = "standart"): string {
  // 2026-06-19 (Bug A3 kök çözümü): datesSection bloğu KALDIRILDI. LLM artık tarih
  // konuşmuyor; tarih listesi process-message.ts :11 (TARİH LİSTESİ deterministik)
  // tarafından üretiliyor (D5 — collectionStep'ten bağımsız).
  //
  // 2026-06-20 (Bug 4 kök çözümü): toplanma_saati + hareket_noktasi + tur_sure
  // alanları EKLENDİ. DB'de bu alanlar dolu (Pamukkale 07:30, Kapadokya Balon
  // 05:00, vb.) ama prompt'a girmediği için LLM saat uyduruyor + tutarsız
  // davranıyordu. Artık deterministik veri prompt'ta → halüsinasyon kapısı kapalı.
  const _today = new Date().toISOString().slice(0, 10);
  const firstDate = (tour.dates || []).filter((d: any) => !d?.departure_date || d.departure_date >= _today)[0];
  const price = firstDate?.price_adult;
  const meetTime = formatTime(tour.toplanma_saati);

  // 2026-07-03 DATA-GAP FIX 1: konaklama/ulasim/hotel/visa/price_child eklendi.
  // Bu alanlar DB'de VARDI (migration 20251112152524 + 20251125080314 — "for
  // expanded chatbot functionality") ama prompt'a hiç bağlanmamıştı → LLM'in
  // elinde veri yokken hotel_details/transport_details soruları uydurma
  // riskindeydi (Bug 4 saat vakasıyla aynı sınıf).
  // price_child: SADECE >0 ise basılır — şemada DECIMAL nullable, DEFAULT yok;
  // 0'ın "ücretsiz" anlamı tanımsız → 0/null "belirtilmemiş" sayılır (yanlış
  // "çocuk ücretsiz" çıkarımı engellenir).
  // return_date BİLİNÇLİ EKLENMEDİ: Bug A3 kuralı (LLM tarih KONUŞMAZ, tarihler
  // :11 deterministik) + tarih seçilmemişken ilk tarihin dönüşünü basmak
  // yanıltıcı. Doğru yer :11 listesi — ayrı iş.
  const _hotelLine = tour.hotel_name
    ? `${tour.hotel_name}${tour.hotel_stars ? ` (${tour.hotel_stars}⭐)` : ""}`
    : "";
  const _visaLine = tour.visa_notes
    ? String(tour.visa_notes)
    : (tour.visa_required === true ? "__REQUIRED_NO_NOTES__" : "");
  const _childPrice =
    firstDate?.price_child && Number(firstDate.price_child) > 0
      ? Number(firstDate.price_child)
      : null;

  // 2026-07-03 DATA-GAP FIX 2: boş kritik alanlar için AÇIK "veri yok" sinyali.
  // Eski filter(Boolean) boş alanı sessizce atlıyordu → LLM'e "bu veri yok"
  // sinyali örtüktü → hallucinationGuard'a rağmen (M1) uydurma kapısı açıktı.
  // Tasarım: alan başına satır DEĞİL (8 boş satır prompt şişirir), boşları TEK
  // toplu iç-talimat satırında listele. hallucinationGuard diliyle tutarlı.
  const _missingTr: string[] = [];
  const _missingEn: string[] = [];
  const _track = (val: unknown, tr: string, en: string) => {
    if (!val) { _missingTr.push(tr); _missingEn.push(en); }
  };
  _track(meetTime, "toplanma saati", "meeting time");
  _track(tour.hareket_noktasi, "kalkış noktası", "pickup point");
  _track(tour.tur_sure, "tur süresi", "duration");
  _track(tour.konaklama, "konaklama detayı", "accommodation details");
  _track(_hotelLine, "otel adı", "hotel name");
  _track(tour.ulasim, "ulaşım detayı", "transport details");
  _track(_visaLine, "vize bilgisi", "visa info");
  _track(_childPrice, "çocuk fiyatı", "child price");

  if (language === "tr") {
    const parts = [
      `*${tour.title}*`,
      `📍 Destinasyon: ${tour.destination}`,
      price ? `💰 Fiyat: kişi başı ${price}₺` : "",
      _childPrice ? `👶 Çocuk fiyatı: ${_childPrice}₺` : "",
      tour.tur_sure ? `⏱ Süre: ${tour.tur_sure}` : "",
      meetTime ? `🕐 Toplanma saati: ${meetTime}` : "",
      tour.hareket_noktasi ? `🚌 Kalkış noktası: ${tour.hareket_noktasi}` : "",
      tour.konaklama ? `🏨 Konaklama: ${tour.konaklama}` : "",
      _hotelLine ? `🏨 Otel: ${_hotelLine}` : "",
      tour.ulasim ? `🚐 Ulaşım: ${tour.ulasim}` : "",
      _visaLine === "__REQUIRED_NO_NOTES__"
        ? "🛂 Vize: Bu tur için vize gereklidir (detay için acenteye danışın)"
        : _visaLine ? `🛂 Vize: ${_visaLine}` : "",
      tour.program_kisa ? `📝 Özet: ${tour.program_kisa}` : "",
      tour.gezilecek_yerler ? `🗺️ Gezilecek Yerler: ${tour.gezilecek_yerler}` : "",
      _missingTr.length
        ? `⚠️ SİSTEMDE KAYITLI OLMAYAN bilgiler: ${_missingTr.join(", ")}. Kullanıcı bunlardan birini sorarsa doğal bir dille bilginin acentemizde olduğunu söyle ve acenteye yönlendir — ASLA tahmin etme, sayı/isim/detay uydurma. "Sistemde kayıtlı değil" gibi teknik ifade KULLANMA.`
        : "",
    ];
    return parts.filter(Boolean).join("\n");
  }

  const parts = [
    `*${tour.title}*`,
    `📍 Destination: ${tour.destination}`,
    price ? `💰 Price: ${price}₺ per person` : "",
    _childPrice ? `👶 Child price: ${_childPrice}₺` : "",
    tour.tur_sure ? `⏱ Duration: ${tour.tur_sure}` : "",
    meetTime ? `🕐 Meeting time: ${meetTime}` : "",
    tour.hareket_noktasi ? `🚌 Pickup point: ${tour.hareket_noktasi}` : "",
    tour.konaklama ? `🏨 Accommodation: ${tour.konaklama}` : "",
    _hotelLine ? `🏨 Hotel: ${_hotelLine}` : "",
    tour.ulasim ? `🚐 Transport: ${tour.ulasim}` : "",
    _visaLine === "__REQUIRED_NO_NOTES__"
      ? "🛂 Visa: Required for this tour (contact the agency for details)"
      : _visaLine ? `🛂 Visa: ${_visaLine}` : "",
    tour.program_kisa ? `📝 Summary: ${tour.program_kisa}` : "",
    tour.gezilecek_yerler ? `🗺️ Places to Visit: ${tour.gezilecek_yerler}` : "",
    _missingEn.length
      ? `⚠️ Information NOT ON RECORD: ${_missingEn.join(", ")}. If the user asks about any of these, say naturally that the agency has this information and refer them to the agency — NEVER guess or invent numbers/names/details. Do NOT use technical phrasing like "not in the system".`
      : "",
  ];
  return parts.filter(Boolean).join("\n");
}

/**
 * Format collected info
 */
export function formatCollectedInfo(info: any, language: string): string {
  const lines: string[] = [];
  const formattedDate = info?.selectedDate ? formatDateForLanguage(info.selectedDate, language) : "";

  if (language === "tr") {
    if (info.tourTitle) lines.push(`✅ Tur: ${info.tourTitle}`);
    if (info.selectedDate) lines.push(`✅ Tarih: ${formattedDate || info.selectedDate}`);
    if (info.paxAdult)
      lines.push(`✅ Kişi: ${info.paxAdult} yetişkin${info.paxChild ? `, ${info.paxChild} çocuk` : ""}`);
    if (info.fullName) lines.push(`✅ İsim: ${info.fullName}`);
    if (info.phone) lines.push(`✅ Telefon: ${info.phone}`);
    return lines.length > 0 ? lines.join("\n") : "Henüz rezervasyon bilgisi toplanmadı.";
  }

  if (info.tourTitle) lines.push(`✅ Tour: ${info.tourTitle}`);
  if (info.selectedDate) lines.push(`✅ Date: ${formattedDate || info.selectedDate}`);
  if (info.paxAdult) lines.push(`✅ People: ${info.paxAdult} adult${info.paxChild ? `, ${info.paxChild} child` : ""}`);
  if (info.fullName) lines.push(`✅ Name: ${info.fullName}`);
  if (info.phone) lines.push(`✅ Phone: ${info.phone}`);
  return lines.length > 0 ? lines.join("\n") : "No reservation information collected yet.";
}

/**
 * Format reservation summary with tone-aware styling
 * *tek yıldız* kullanır (WhatsApp uyumlu)
 */
export function formatReservationSummary(tour: any, info: any, language: string, tone: string = "standart"): string {
  const tourTitle = info?.tourTitle || tour?.title || "";
  const rawDate = info?.selectedDate || "";
  const formattedDate = rawDate ? formatDateForLanguage(rawDate, language) : "";
  const paxAdult = info?.paxAdult || 0;
  const paxChild = info?.paxChild || 0;
  const fullName = info?.fullName || "";
  const phone = info?.phone || "";

  if (language === "tr") {
    if (tone === "premium") {
      return `Rezervasyon Özeti\n${"─".repeat(25)}\nTur: ${tourTitle || "-"}\nTarih: ${formattedDate || rawDate || "-"}\nKatılımcı: ${paxAdult || 0} yetişkin${paxChild ? `, ${paxChild} çocuk` : ""}\nİsim: ${fullName || "-"}\nTelefon: ${phone || "-"}`;
    } else if (tone === "kurumsal") {
      return `*REZERVASYON ÖZETİ*\n\nTur: ${tourTitle || "-"}\nTarih: ${formattedDate || rawDate || "-"}\nKatılımcı Sayısı: ${paxAdult || 0} yetişkin${paxChild ? `, ${paxChild} çocuk` : ""}\nAd Soyad: ${fullName || "-"}\nTelefon: ${phone || "-"}`;
    } else if (tone === "dinamik") {
      return `🎉 *REZERVASYON ÖZETİ* 🎉\n• 🗺️ Tur: ${tourTitle || "-"}\n• 📅 Tarih: ${formattedDate || rawDate || "-"}\n• 👥 Kişi: ${paxAdult || 0} yetişkin${paxChild ? `, ${paxChild} çocuk` : ""}\n• 👤 İsim: ${fullName || "-"}\n• 📱 Telefon: ${phone || "-"}`;
    } else {
      return `📋 *REZERVASYON ÖZETİ:*\n• Tur: ${tourTitle || "-"}\n• Tarih: ${formattedDate || rawDate || "-"}\n• Kişi: ${paxAdult || 0} yetişkin${paxChild ? `, ${paxChild} çocuk` : ""}\n• İsim: ${fullName || "-"}\n• Telefon: ${phone || "-"}`;
    }
  }

  if (tone === "premium") {
    return `Reservation Summary\n${"─".repeat(25)}\nTour: ${tourTitle || "-"}\nDate: ${formattedDate || rawDate || "-"}\nParticipants: ${paxAdult || 0} adult${paxChild ? `, ${paxChild} child` : ""}\nName: ${fullName || "-"}\nPhone: ${phone || "-"}`;
  } else if (tone === "kurumsal") {
    return `*RESERVATION SUMMARY*\n\nTour: ${tourTitle || "-"}\nDate: ${formattedDate || rawDate || "-"}\nNumber of Participants: ${paxAdult || 0} adult${paxChild ? `, ${paxChild} child` : ""}\nFull Name: ${fullName || "-"}\nPhone: ${phone || "-"}`;
  } else if (tone === "dinamik") {
    return `🎉 *RESERVATION SUMMARY* 🎉\n• 🗺️ Tour: ${tourTitle || "-"}\n• 📅 Date: ${formattedDate || rawDate || "-"}\n• 👥 People: ${paxAdult || 0} adult${paxChild ? `, ${paxChild} child` : ""}\n• 👤 Name: ${fullName || "-"}\n• 📱 Phone: ${phone || "-"}`;
  } else {
    return `📋 *RESERVATION SUMMARY:*\n• Tour: ${tourTitle || "-"}\n• Date: ${formattedDate || rawDate || "-"}\n• People: ${paxAdult || 0} adult${paxChild ? `, ${paxChild} child` : ""}\n• Name: ${fullName || "-"}\n• Phone: ${phone || "-"}`;
  }
}

/**
 * Multiple tour warning
 */
export function getMultipleTourWarning(context: any, language: string): string {
  const { multipleTourMatches } = context;

  if (!multipleTourMatches || multipleTourMatches.length <= 1) {
    return "";
  }

  const tourList = multipleTourMatches.map((t: any, i: number) => `${i + 1}. ${t.title}`).join("\n");

  if (language === "tr") {
    return `\n\n🚨 KRİTİK - ÇOKLU TUR EŞLEŞMESİ:
Kullanıcının araması birden fazla turla eşleşti. OTOMATİK SEÇİM YAPMA!
Mutlaka şu turları listele ve hangisini istediğini sor:
${tourList}

Örnek yanıt: "Bu destinasyon için birden fazla tur seçeneğimiz var:
1. [Tur 1 adı] - [kısa açıklama]
2. [Tur 2 adı] - [kısa açıklama]

Hangisini tercih edersiniz?"`;
  }

  return `\n\n🚨 CRITICAL - MULTIPLE TOUR MATCHES:
User's search matched multiple tours. DO NOT auto-select!
You MUST list these tours and ask which one they want:
${tourList}

Example response: "We have multiple tour options for this destination:
1. [Tour 1 name] - [brief description]
2. [Tour 2 name] - [brief description]

Which one would you prefer?"`;
}
