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
 * Format tour details with tone-aware styling
 * *tek yıldız* kullanır (WhatsApp uyumlu)
 */
export function formatTourDetails(tour: any, language: string, tone: string = "standart"): string {
  // Token optimizasyonu: 10+ tarihli turlarda prompt'a TÜM tarihler giriyordu (her tarih ~25 token).
  // Sadece bugünden sonraki ilk 5 tarihi al — kullanıcının ihtiyacı için yeterli, AI'a daha fazlasını
  // göstermek yarar değil token israfı. Past dates zaten upstream'de (whatsapp-webhook/index.ts:440 +
  // demo-chat/index.ts:191) filtreleniyor; burada defensive olarak tekrar filtreleyip slice'lıyoruz.
  const _today = new Date().toISOString().slice(0, 10);
  const _rawDates = tour.dates || [];
  const dates = _rawDates
    .filter((d: any) => !d?.departure_date || d.departure_date >= _today)
    .slice(0, 5);
  const _truncated = _rawDates.length > dates.length;
  const firstDate = dates[0];
  const price = firstDate?.price_adult;

  let datesSection = "";
  if (dates.length > 0) {
    const isTR = language === "tr";
    const formattedDates = dates
      .map((d: any, idx: number) => {
        const formattedDate = formatDateForLanguage(d.departure_date, language);
        const datePrice = d.price_adult ? ` - ${d.price_adult}₺` : "";
        const remaining = d.remaining_quota !== undefined ? d.remaining_quota : d.quota;
        const quotaText = remaining !== undefined
          ? (isTR ? ` (${remaining} kişilik yer)` : ` (${remaining} spots)`)
          : "";

        if (tone === "kurumsal") {
          return `  ${idx + 1}) ${formattedDate}${datePrice}${quotaText}`;
        } else if (tone === "dinamik") {
          return `  ${getNumberEmoji(idx + 1)} ${formattedDate}${datePrice}${quotaText}`;
        } else {
          return `  ${idx + 1}) ${formattedDate}${datePrice}${quotaText}`;
        }
      })
      .join("\n");

    if (language === "tr") {
      datesSection =
        tone === "premium" ? `\n\nMüsait Tarihler:\n${formattedDates}` : `\n📅 Müsait Tarihler:\n${formattedDates}`;
    } else {
      datesSection =
        tone === "premium" ? `\n\nAvailable Dates:\n${formattedDates}` : `\n📅 Available Dates:\n${formattedDates}`;
    }
    // Daha fazla tarih varsa AI'a bildir — "sadece bunlar var" yanılgısını önler. Kullanıcı
    // başka tarih sorarsa AI acenteye yönlendirir (deterministik tarih listesi akışı zaten
    // process-message.ts'te tüm tarihleri gösteriyor).
    if (_truncated) {
      datesSection += language === "tr"
        ? `\n(İlk 5 tarih gösterildi. Müşteri daha fazla tarih isterse acente ile iletişime geçirilebilir.)`
        : `\n(Showing first 5 dates. If customer asks for more, refer them to the agency.)`;
    }
  }

  if (language === "tr") {
    const parts = [
      `*${tour.title}*`,
      `📍 Destinasyon: ${tour.destination}`,
      price ? `💰 Fiyat: kişi başı ${price}₺` : "",
      tour.program_kisa ? `📝 Özet: ${tour.program_kisa}` : "",
      tour.gezilecek_yerler ? `🗺️ Gezilecek Yerler: ${tour.gezilecek_yerler}` : "",
    ];
    return parts.filter(Boolean).join("\n") + datesSection;
  }

  const parts = [
    `*${tour.title}*`,
    `📍 Destination: ${tour.destination}`,
    price ? `💰 Price: ${price}₺ per person` : "",
    tour.program_kisa ? `📝 Summary: ${tour.program_kisa}` : "",
    tour.gezilecek_yerler ? `🗺️ Places to Visit: ${tour.gezilecek_yerler}` : "",
  ];
  return parts.filter(Boolean).join("\n") + datesSection;
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
