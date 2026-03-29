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

🚨 KRİTİK KURAL - TUR KARIŞTIRMA YASAĞI:
- Kullanıcı X turu hakkında soru soruyorsa SADECE X turunun bilgisini ver.
- Kullanıcının sormadığı başka bir turun tarih veya fiyat bilgisini ASLA gösterme.
- "Her cuma var mı?", "tarihler nedir?" gibi sorularda SADECE sorulan turun bilgisini ver.
- Sistemde olmayan bir tur sorulursa "Bu tur sistemimizde bulunmuyor" de.
- Olmayan tur için başka turun tarihlerini ASLA önerme veya listeleme.

Mevcut turlar:
${toursList}`;
  }

  return `📍 STATUS: Tour browsing
- The user is exploring tours, do NOT ask for personal details yet.
- List relevant tours according to their interest.

🚨 CRITICAL RULE - NO TOUR MIXING:
- If user asks about tour X, ONLY provide info about tour X.
- NEVER show dates or prices of a different tour than what was asked.
- If a tour is not in the system, say "This tour is not available" - NEVER suggest another tour's dates.
- For questions like "every Friday?" or "what are the dates?" - only answer about the tour being asked.

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
- ÖNCE mevcut turun TÜM müsait tarihlerini NUMARALI olarak listele.
- Her tarih için fiyatı da yaz.
- Son satırda "Hangi tarihi tercih edersiniz?" diye sor.
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
- FIRST list ALL available dates of the selected tour in numbered format.
- Include price for each date.
- End with "Which date do you prefer?"
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

  // === UYDURMA YASAĞI - Tüm stage'lerde geçerli ===
  const hallucinationGuard =
    language === "tr"
      ? `\n\n🚫 KRİTİK KURAL - UYDURMA YASAĞI:
- ASLA veritabanında olmayan tur, tarih, fiyat veya bilgi UYDURMA.
- Sadece sana verilen tur listesindeki bilgileri kullan.
- Listede olmayan bir tur sorulursa "Bu tur sistemimizde bulunmuyor" de.
- Tarih veya fiyat bilgisi verilmemişse "Bilgi mevcut değil" de, asla tahmin etme veya uydurma.
- "Her hafta", "her Cuma", "her ayın 1'i" gibi bilgileri VERİTABANINDA YOKSA söyleme.
- Kullanıcının sormadığı turun tarih veya fiyat bilgisini ASLA gösterme.`
      : `\n\n🚫 CRITICAL RULE - NO HALLUCINATION:
- NEVER invent tours, dates, prices or information not in the database.
- Only use information from the tour list provided to you.
- If asked about a tour not in the list, say "This tour is not in our system".
- If no date or price is available, say "Information not available", never guess or invent.
- Do NOT say "every week", "every Friday" or similar unless it's explicitly in the database.
- NEVER show dates or prices of a tour the user did not ask about.`;

  if (stage === "GREETING") return getGreetingPrompt(context) + hallucinationGuard;
  if (stage === "BROWSING") return getBrowsingPrompt(context) + hallucinationGuard;

  const tourDetails = currentTour ? formatTourDetails(currentTour, language, tone) : "";
  const collectedInfo = formatCollectedInfo(reservationInfo, language);
  const summary = formatReservationSummary(currentTour, reservationInfo, language, tone);

  // Turkish prompts
  if (language === "tr") {
    switch (stage) {
      case "TOUR_SELECTED":
        return (
          `📍 DURUM: Tur seçildi

${tourDetails}

🚨 KRİTİK KURAL - KULLANICI NİYETİ BELİRSİZSE:
- Eğer kullanıcı sadece tur adını yazdıysa veya tur hakkında genel bir şey söylediyse (örn: "Kapadokya turu", "bu tur", "o tur") ve rezervasyon mu yoksa bilgi mi istediği BELİRSİZSE:
  → "Bu tur hakkında bilgi almak mı, yoksa rezervasyon yaptırmak mı istiyorsunuz?" diye sor.
- Eğer kullanıcı açıkça rezervasyon istiyorsa (örn: "kayıt olayım", "rezervasyon yaptırmak istiyorum", "tura katılmak istiyorum") tarihleri listele.
- Eğer kullanıcı sadece bilgi istiyorsa tur detaylarını ver, rezervasyon başlatma.

🚨 KRİTİK KURAL - TARİH SEÇİMİ (rezervasyon niyeti netleşince):
- TÜM müsait tarihleri numaralı liste halinde göster.
- Her tarih için fiyat bilgisi de ver.
- Kullanıcının seçim yapmasını BEKLE.
- Tarih seçilmeden önce kişi sayısı, isim, telefon SORMA.
- "Hangi tarihi tercih edersiniz?" diye mutlaka sor.

Örnek format:
"1) 15 Aralık 2025 - 1500₺/kişi
2) 22 Aralık 2025 - 1500₺/kişi
Hangi tarihi tercih edersiniz?"` + hallucinationGuard
        );

      case "DATE_SELECTION":
        return (
          `📍 DURUM: Tarih seçimi
- NET bir tarih belirle.
- Tarihleri listele ve seçim iste.
- YENİ TARİH UYDURMA.` + hallucinationGuard
        );

      case "COLLECTING_INFO":
        const stepPrompt = getCollectionStepPrompt(collectionStep || "default", "tr");
        const dateListReinforcementTr =
          collectionStep === "waiting_for_date" && currentTour
            ? `\n\nSEÇİLİ TURUN TARİHLERİ:\n${tourDetails}\n\n🚨 ZORUNLU: Bu yanıtta tarihleri tekrar numaralı listele ve kullanıcıdan seçim iste.`
            : "";
        return (
          `📍 DURUM: Bilgi toplama
${stepPrompt}

${dateListReinforcementTr}

Toplanan bilgiler:
${collectedInfo}

⚠️ Kullanıcı bilgi verdiğinde önce KABUL ET.` + hallucinationGuard
        );

      case "CONFIRMING":
        return (
          `📍 DURUM: Onay bekleniyor

${summary}

Bu bilgiler doğru mudur, onaylıyor musunuz?` + hallucinationGuard
        );

      case "COMPLETED":
        return (
          `📍 DURUM: Kayıt tamamlandı ✅

🎯 YAPILACAK:
- Kayıt tamamlandı mesajı ver (SADECE ilk kez COMPLETED'a geçildiğinde)
- "Acentemiz en kısa sürede iletişime geçecek" de
- Başka sorusu var mı diye sor

🚨 KRİTİK - KULLANICI SORU SORARSA:
- Kullanıcı mevcut tur veya başka tur hakkında soru sorarsa SADECE soruyu cevapla
- "Rezervasyonunuz tamamlandı" veya "Kaydınız oluşturuldu" TEKRAR SÖYLEME
- Normal bir konuşma gibi devam et

🚨 KRİTİK - KULLANICI BAŞKA TUR SORARSA:
- Eğer kullanıcı başka bir tur hakkında bilgi soruyorsa → sadece o turun bilgisini ver
- Eğer kullanıcı başka tura rezervasyon yaptırmak istiyorsa → "Elbette! [Tur adı] için rezervasyon başlatıyorum" de
- Eğer kullanıcının niyeti belirsizse → "Bu tur hakkında bilgi almak mı, yoksa rezervasyon yaptırmak mı istiyorsunuz?" diye sor

🚫 BU REZERVASYON İÇİN:
- Tekrar bilgi toplama (zaten tüm bilgiler alındı)
- IBAN, kapora, tutar yazma (ödeme bilgileri ayrıca gönderildi)

🚫 İPTAL TALEBİ GELİRSE:
- ASLA "iptal edildi" veya "iptal edebilirim" DEME
- "İptal işlemleri için doğrudan acentemizle iletişime geçmeniz gerekmektedir" de
- Acente telefon numarası ve çalışma saatlerini paylaş (varsa)` + hallucinationGuard
        );

      default:
        return "" + hallucinationGuard;
    }
  }

  // English prompts
  switch (stage) {
    case "TOUR_SELECTED":
      return (
        `📍 STATUS: Tour selected

${tourDetails}

🚨 CRITICAL RULE - WHEN USER INTENT IS UNCLEAR:
- If user just wrote the tour name or said something vague and it's UNCLEAR whether they want info or a reservation:
  → Ask: "Would you like to get information about this tour, or would you like to make a reservation?"
- If user clearly wants a reservation → list the dates.
- If user just wants information → provide tour details, do NOT start reservation flow.

🚨 CRITICAL RULE - DATE SELECTION (once reservation intent is clear):
- List ALL available dates in numbered format.
- Show price for each date.
- WAIT for user to choose.
- Do NOT ask for pax, name or phone before date is selected.
- Always ask "Which date do you prefer?"` + hallucinationGuard
      );

    case "DATE_SELECTION":
      return (
        `📍 STATUS: Date selection
- Confirm a clear date.
- List dates and ask to choose.
- Don't invent dates.` + hallucinationGuard
      );

    case "COLLECTING_INFO":
      const stepPromptEn = getCollectionStepPrompt(collectionStep || "default", "en");
      return (
        `📍 STATUS: Collecting information
${stepPromptEn}

${collectionStep === "waiting_for_date" && currentTour ? `SELECTED TOUR DATES:\n${tourDetails}\n\n🚨 MANDATORY: List these dates in numbered format and ask user to choose.` : ""}

Collected info:
${collectedInfo}

⚠️ ACCEPT user info first, then ask for next.` + hallucinationGuard
      );

    case "CONFIRMING":
      return (
        `📍 STATUS: Awaiting confirmation

${summary}

Are these details correct, do you confirm?` + hallucinationGuard
      );

    case "COMPLETED":
      return (
        `📍 STATUS: Registration completed ✅

🎯 DO:
- Confirm registration is complete (ONLY when first entering COMPLETED stage)
- Say "Our team will contact you shortly"
- Ask if they have other questions

🚨 CRITICAL - IF USER ASKS A QUESTION:
- Just ANSWER the question naturally
- Do NOT repeat "Your reservation is confirmed"

🚨 CRITICAL - IF USER ASKS ABOUT ANOTHER TOUR:
- If asking for info → just provide that tour's info
- If wants to book → say "Of course! Starting reservation for [Tour name]"
- If intent is unclear → ask "Would you like info about this tour, or make a reservation?"

🚫 FOR THIS RESERVATION:
- Don't collect more info
- Don't write IBAN, deposit, amount

🚫 IF CANCELLATION REQUESTED:
- NEVER say "cancelled" or "I can cancel it"
- Say "For cancellation requests, please contact our agency directly"` + hallucinationGuard
      );

    default:
      return "" + hallucinationGuard;
  }
}
