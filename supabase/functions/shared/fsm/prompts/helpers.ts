// Helper functions for formatting prompts
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

export function formatToursList(tours: any[], language: string): string {
  if (!tours || tours.length === 0) {
    return language === "tr"
      ? "Şu an sistemde tanımlı aktif tur bulunmuyor."
      : "There are no active tours defined in the system at the moment.";
  }

  return tours
    .map((tour, idx) => {
      const firstDate = tour.dates?.[0];
      const price = firstDate?.price_adult;
      const rawDate = firstDate?.departure_date;
      const formattedDate = rawDate ? formatDateForLanguage(rawDate, language) : "";
      const dateText =
        formattedDate && formattedDate.trim() !== ""
          ? language === "tr"
            ? ` — en yakın tarih: ${formattedDate}`
            : ` — next date: ${formattedDate}`
          : "";
      const priceText =
        price && price > 0
          ? language === "tr"
            ? ` (kişi başı yaklaşık ${price}₺)`
            : ` (approx. ${price}₺ per person)`
          : "";
      return `${idx + 1}. ${tour.title} — ${tour.destination}${dateText}${priceText}`;
    })
    .join("\n");
}

export function formatTourDetails(tour: any, language: string): string {
  const dates = tour.dates || [];
  const firstDate = dates[0];
  const price = firstDate?.price_adult;

  let datesSection = "";
  if (dates.length > 0) {
    const formattedDates = dates
      .map((d: any, idx: number) => {
        const formattedDate = formatDateForLanguage(d.departure_date, language);
        const datePrice = d.price_adult ? ` (${d.price_adult}₺)` : "";
        return `  ${idx + 1}) ${formattedDate}${datePrice}`;
      })
      .join("\n");

    datesSection =
      language === "tr" ? `\n📅 Müsait Tarihler:\n${formattedDates}` : `\n📅 Available Dates:\n${formattedDates}`;
  }

  if (language === "tr") {
    return (
      [
        `Tur: ${tour.title}`,
        `Destinasyon: ${tour.destination}`,
        price ? `Fiyat: kişi başı yaklaşık ${price}₺` : "",
        tour.program_kisa ? `Özet: ${tour.program_kisa}` : "",
      ]
        .filter(Boolean)
        .join("\n") + datesSection
    );
  }

  return (
    [
      `Tour: ${tour.title}`,
      `Destination: ${tour.destination}`,
      price ? `Price: approx. ${price}₺ per person` : "",
      tour.program_kisa ? `Summary: ${tour.program_kisa}` : "",
    ]
      .filter(Boolean)
      .join("\n") + datesSection
  );
}

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

export function formatReservationSummary(tour: any, info: any, language: string): string {
  const tourTitle = info?.tourTitle || tour?.title || "";
  const rawDate = info?.selectedDate || "";
  const formattedDate = rawDate ? formatDateForLanguage(rawDate, language) : "";
  const paxAdult = info?.paxAdult || 0;
  const paxChild = info?.paxChild || 0;
  const fullName = info?.fullName || "";
  const phone = info?.phone || "";

  if (language === "tr") {
    return `📋 REZERVASYON ÖZETİ:
• Tur: ${tourTitle || "-"}
• Tarih: ${formattedDate || rawDate || "-"}
• Kişi: ${paxAdult || 0} yetişkin${paxChild ? `, ${paxChild} çocuk` : ""}
• İsim: ${fullName || "-"}
• Telefon: ${phone || "-"}`;
  }

  return `📋 RESERVATION SUMMARY:
• Tour: ${tourTitle || "-"}
• Date: ${formattedDate || rawDate || "-"}
• People: ${paxAdult || 0} adult${paxChild ? `, ${paxChild} child` : ""}
• Name: ${fullName || "-"}
• Phone: ${phone || "-"}`;
}

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
