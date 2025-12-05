// All stage prompts - ALL IN ONE FILE (no separate files needed)
import type { PromptContext } from "../types.ts";
import { formatTourDetails, formatCollectedInfo, formatReservationSummary, formatToursList } from "../helpers.ts";

// ============================================
// GREETING STAGE
// ============================================
function getGreetingPrompt(context: PromptContext): string {
  const { availableTours, language, tone } = context;
  const toursList = formatToursList(availableTours, language, tone);

  if (language === "tr") {
    return `📍 DURUM: İlk karşılama
- Kullanıcıyı sıcak ve KISA bir mesajla karşıla.
- Acentenin adını kullanarak hoş geldiniz de.
- Ne konuda yardımcı olabileceğini 1–2 cümlede özetle.
- Son cümlede mutlaka ihtiyacını sor (tur, destinasyon veya tarih).

CEVAP FORMATIN:
- 1 satır: Karşılama cümlesi
- 1 satır: Nasıl yardımcı olabileceğini anlatan kısa özet
- 1 satır: "Hangi bölge / tur / tarih ile başlayalım?" tarzı net soru

Sistem için mevcut turlar:
${toursList}`;
  }

  return `📍 STATUS: Initial greeting
- Greet the user warmly in a SHORT message.
- Use the agency name in the welcome sentence.
- In 1–2 sentences explain how you can help (tours, destinations, dates).
- End with a clear question about their need.

Available tours:
${toursList}`;
}

// ============================================
// BROWSING STAGE
// ============================================
function getBrowsingPrompt(context: PromptContext): string {
  const { availableTours, language, tone } = context;
  const toursList = formatToursList(availableTours, language, tone);

  if (language === "tr") {
    return `📍 DURUM: Tur arama / listeleme
- Kullanıcı turları keşfediyor, bu aşamada kişisel kayıt bilgisi SORMA.
- İlgilendiği destinasyona göre uygun turları sade bir şekilde listele.
- Aynı destinasyondan birden fazla tur varsa hepsini madde madde göster.

🚨 KRİTİK KURAL - HENÜZ TUR SEÇİLMEDİ:
- Kullanıcı "tura katılmak istiyorum" derse ÖNCE tur seçmesini iste.
- ASLA tarih sorma!

Mevcut turlar:
${toursList}`;
  }

  return `📍 STATUS: Tour browsing
- The user is exploring tours, do NOT ask for personal details yet.
- List relevant tours according to their interest.

🚨 CRITICAL RULE:
- If user wants to join, ask them to select a tour FIRST.
- NEVER ask for a date before tour selection!

Available tours:
${toursList}`;
}

// ============================================
// COLLECTION STEP HELPER
// ============================================
function getCollectionStepPrompt(collectionStep: string, language: string): string {
  const prompts: Record<string, Record<string, string>> = {
    tr: {
      waiting_for_date: `📝 ADIM: Tarih seçimi
- Kullanıcıdan hangi tarihte katılmak istediğini sor.
⚠️ Eğer kullanıcı başka bilgi verdiyse önce KABUL ET.`,

      waiting_for_pax: `📝 ADIM: Kişi sayısı
- Kullanıcıdan kaç kişi katılacağını sor.
⚠️ Eğer kullanıcı başka bilgi verdiyse önce KABUL ET.`,

      waiting_for_name: `📝 ADIM: İsim
- Sadece ad-soyad iste.
⚠️ Eğer kullanıcı başka bilgi verdiyse önce KABUL ET.`,

      waiting_for_phone: `📝 ADIM: Telefon
- Sadece telefon numarası iste.
⚠️ Eğer kullanıcı başka bilgi verdiyse önce KABUL ET.`,

      default: `📝 ADIM: Bilgi toplama
- Eksik bilgiyi tamamla.`,
    },
    en: {
      waiting_for_date: `📝 STEP: Date selection
- Ask which date they prefer.
⚠️ If user provided other info, ACKNOWLEDGE it first.`,

      waiting_for_pax: `📝 STEP: Pax count
- Ask how many people.
⚠️ If user provided other info, ACKNOWLEDGE it first.`,

      waiting_for_name: `📝 STEP: Name
- Ask for full name only.
⚠️ If user provided other info, ACKNOWLEDGE it first.`,

      waiting_for_phone: `📝 STEP: Phone
- Ask for phone number only.
⚠️ If user provided other info, ACKNOWLEDGE it first.`,

      default: `📝 STEP: Collect info
- Complete the missing field.`,
    },
  };

  const langPrompts = prompts[language] || prompts.tr;
  return langPrompts[collectionStep] || langPrompts.default;
}

// ============================================
// MAIN STAGE PROMPT FUNCTION
// ============================================
export function getStagePrompt(context: PromptContext): string {
  const { stage, collectionStep, currentTour, reservationInfo, language, tone, availableTours } = context;

  // Handle greeting and browsing
  if (stage === "GREETING") return getGreetingPrompt(context);
  if (stage === "BROWSING") return getBrowsingPrompt(context);

  // Format helpers with tone support
  const tourDetails = currentTour ? formatTourDetails(currentTour, language, tone) : "";
  const collectedInfo = formatCollectedInfo(reservationInfo, language);
  const summary = formatReservationSummary(currentTour, reservationInfo, language, tone);

  // Turkish prompts
  if (language === "tr") {
    switch (stage) {
      case "TOUR_SELECTED":
        return `📍 DURUM: Tur seçildi

${tourDetails}

🚨 KRİTİK KURAL - TARİH SEÇİMİ:
- TÜMMM müsait tarihleri numaralı liste halinde göster.
- Her tarih için fiyat bilgisi de ver.
- Kullanıcının seçim yapmasını BEKLE.
- Tarih seçilmeden önce kişi sayısı, isim, telefon SORMA.
- "Hangi tarihi tercih edersiniz?" diye mutlaka sor.

Örnek format:
"1) 15 Aralık 2025 - 1500₺/kişi
2) 22 Aralık 2025 - 1500₺/kişi
Hangi tarihi tercih edersiniz?"`;


      case "DATE_SELECTION":
        return `📍 DURUM: Tarih seçimi
- NET bir tarih belirle.
- Tarihleri listele ve seçim iste.
- YENİ TARİH UYDURMA.`;

      case "COLLECTING_INFO":
        const stepPrompt = getCollectionStepPrompt(collectionStep || "default", "tr");
        return `📍 DURUM: Bilgi toplama
${stepPrompt}

Toplanan bilgiler:
${collectedInfo}

⚠️ Kullanıcı bilgi verdiğinde önce KABUL ET.`;

      case "CONFIRMING":
        return `📍 DURUM: Onay bekleniyor

${summary}

Bu bilgiler doğru mudur, onaylıyor musunuz?`;

      case "COMPLETED":
        return `📍 DURUM: Kayıt tamamlandı ✅

🎯 YAPILACAK:
- Kayıt tamamlandı mesajı ver
- "Acentemiz en kısa sürede iletişime geçecek" de
- Başka sorusu veya başka tur isteği var mı diye sor

🚫 BU REZERVASYON İÇİN:
- Tekrar bilgi toplama (zaten tüm bilgiler alındı)
- IBAN, kapora, tutar yazma

NOT: Kullanıcı başka tur isterse sistem otomatik olarak yeni akışa geçecek.`;

      case "ASKING_NEW_RESERVATION":
        return `📍 DURUM: Yeni rezervasyon sorgusu

Kullanıcı mevcut rezervasyonunu tamamladıktan sonra farklı bir tur hakkında sordu.

🎯 YAPILACAK:
- Kibarca "Farklı bir tur için bilgi almak veya yeni bir rezervasyon yapmak mı istiyorsunuz?" diye sor.
- Önceki rezervasyonlarının tamamlandığını hatırlat.
- Kullanıcının cevabını bekle.

Örnek yanıt:
"Kapadokya Kültür Turu rezervasyonunuz tamamlandı. Başka bir tur için bilgi almak veya yeni rezervasyon yapmak ister misiniz?"`;

      default:
        return "";
    }
  }

  // English prompts
  switch (stage) {
    case "TOUR_SELECTED":
      return `📍 STATUS: Tour selected

${tourDetails}

🚨 CRITICAL RULE - DATE SELECTION:
- List ALL available dates in numbered format.
- Show price for each date.
- WAIT for user to choose.
- Do NOT ask for pax, name or phone before date is selected.
- Always ask "Which date do you prefer?"

Example format:
"1) December 15, 2025 - $150/person
2) December 22, 2025 - $150/person
Which date do you prefer?"`;

    case "DATE_SELECTION":
      return `📍 STATUS: Date selection
- Confirm a clear date.
- List dates and ask to choose.
- Don't invent dates.`;

    case "COLLECTING_INFO":
      const stepPromptEn = getCollectionStepPrompt(collectionStep || "default", "en");
      return `📍 STATUS: Collecting information
${stepPromptEn}

Collected info:
${collectedInfo}

⚠️ ACCEPT user info first, then ask for next.`;

    case "CONFIRMING":
      return `📍 STATUS: Awaiting confirmation

${summary}

Are these details correct, do you confirm?`;

    case "COMPLETED":
      return `📍 STATUS: Registration completed ✅

🎯 DO:
- Confirm registration is complete
- Say "Our team will contact you shortly"
- Ask if they have other questions or want another tour

🚫 FOR THIS RESERVATION:
- Don't collect more info (all info already collected)
- Don't write IBAN, deposit, amount

NOTE: If user wants another tour, system will automatically start new flow.`;

    case "ASKING_NEW_RESERVATION":
      return `📍 STATUS: New reservation inquiry

User asked about a different tour after completing their current reservation.

🎯 ACTION:
- Politely ask "Would you like to get info about a different tour or make a new reservation?"
- Remind them their previous reservation is complete.
- Wait for user's response.

Example response:
"Your Cappadocia Culture Tour reservation is complete. Would you like to get info about another tour or make a new reservation?"`;

    default:
      return "";
  }
}
