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
- Sistemde olmayan bir tur sorulursa "Bu tur sistemimizde bulunmuyor" de.
- Olmayan tur için başka turun tarihlerini ASLA önerme veya listeleme.

🚨 KRİTİK KURAL - KALKI YERİ:
- "Kalkış yeri", "nereden hareket", "toplanma yeri", "nerede buluşuyoruz" sorularında:
  → SADECE turun hareket_noktasi bilgisini ver
  → Acente ofis adresini ASLA kalkış yeri olarak gösterme
  → hareket_noktasi boşsa: "Kalkış yeri için lütfen acentemizle iletişime geçin" de

Mevcut turlar:
${toursList}`;
  }

  return `📍 STATUS: Tour browsing
- The user is exploring tours, do NOT ask for personal details yet.
- List relevant tours according to their interest.

🚨 CRITICAL RULE - NO TOUR MIXING:
- If user asks about tour X, ONLY provide info about tour X.
- NEVER show dates or prices of a different tour than what was asked.
- If a tour is not in the system, say "This tour is not available".

🚨 CRITICAL RULE - DEPARTURE POINT:
- For questions about "departure point", "where to meet", "pickup location":
  → ONLY use the tour's hareket_noktasi field
  → NEVER use the agency office address as departure point
  → If hareket_noktasi is empty: say "Please contact our agency for departure details"

🚨 CRITICAL RULE:
- If user wants to join, ask them to select a tour FIRST.
- NEVER ask for a date before tour selection!

Available tours:
${toursList}`;
}

// ============================================
// COLLECTION STEP HELPER
// ============================================
// Hangi alanlar zaten dolu? Buradan "TEKRAR SORMA" yasağını üretmek için kullanılır.
// State machine'in collectionStep kararı KESİN — LLM'in adım seçme özgürlüğü yok;
// LLM sadece o adımın metnini yazar.
function getCollectedFields(info: any): {
  hasDate: boolean;
  hasPax: boolean;
  hasName: boolean;
  hasPhone: boolean;
} {
  return {
    hasDate: !!(info?.selectedDate || info?.dateId),
    hasPax: !!info?.paxAdult,
    hasName: !!info?.fullName,
    hasPhone: !!info?.phone,
  };
}

// TR ve EN için "SORMA YASAĞI" listesi üret — collectionStep'in talep ettiği alan
// dışındaki DOLU alanları DEĞERLERİYLE birlikte "TEKRAR SORMA" diyerek yasakla.
// 2026-06-19 (Tuğçe canlı bug): etiket bazlı listeyi LLM kaçırıyordu. Değerleri
// göstermek anchor etkisi yapar — LLM "tarih: 2026-12-12, pax: 1" görünce
// "kaç kişi?" sormaya cesaret edemez.
function buildForbiddenAskList(
  collectionStep: string,
  collected: ReturnType<typeof getCollectedFields>,
  language: string,
  reservationInfo?: any,
): string {
  const labels: Record<string, Record<string, string>> = {
    tr: { date: "tarih", pax: "kişi sayısı", name: "isim", phone: "telefon" },
    en: { date: "date", pax: "number of people", name: "name", phone: "phone" },
  };
  const lang = labels[language] ? language : "en";
  const L = labels[lang];

  const info = reservationInfo || {};
  const forbidden: string[] = [];
  if (collected.hasDate && collectionStep !== "waiting_for_date") {
    const val = info.selectedDate || info.dateId || "✓";
    forbidden.push(`${L.date}: ${val}`);
  }
  if (collected.hasPax && collectionStep !== "waiting_for_pax") {
    forbidden.push(`${L.pax}: ${info.paxAdult}`);
  }
  if (collected.hasName && collectionStep !== "waiting_for_name") {
    forbidden.push(`${L.name}: ${info.fullName}`);
  }
  if (collected.hasPhone && collectionStep !== "waiting_for_phone") {
    forbidden.push(`${L.phone}: ${info.phone}`);
  }

  if (forbidden.length === 0) return "";

  const list = forbidden.map((f) => `  - ${f}`).join("\n");
  return lang === "tr"
    ? `\n\n❌ TEKRAR SORMA (ZATEN ALINDI):\n${list}\nBu alanları doğrulama amaçlı bile SORMA. Sadece bu adımın sorusunu sor.`
    : `\n\n❌ DO NOT ASK AGAIN (ALREADY COLLECTED):\n${list}\nNever re-ask, not even for verification. Only ask the question for this step.`;
}

function getCollectionStepPrompt(
  collectionStep: string,
  language: string,
  reservationInfo?: any,
): string {
  const collected = reservationInfo ? getCollectedFields(reservationInfo) : { hasDate: false, hasPax: false, hasName: false, hasPhone: false };
  const forbiddenList = reservationInfo ? buildForbiddenAskList(collectionStep, collected, language, reservationInfo) : "";

  // Step başına KESİN komut — LLM adım seçemez, sadece o adımın metnini yazar.
  const prompts: Record<string, Record<string, string>> = {
    tr: {
      waiting_for_date: `📝 SİSTEMİN BELİRLEDİĞİ ADIM: TARİH SEÇİMİ

GÖREVİN: SADECE tarih seç. Başka HİÇBİR şey sorma.
- ÖNCE mevcut turun TÜM müsait tarihlerini NUMARALI listele.
- Her tarih için fiyatı yaz.
- "Hangi tarihi tercih edersiniz?" diye sor.${forbiddenList}

❌ YASAK CEVAPLAR (canlı bug kanıtları):
- "Kaç kişi katılacaksınız?" (← pax adımı DEĞİL)
- "Adınızı alabilir miyim?" (← isim adımı DEĞİL)
✅ TEK DOĞRU: tarih listesi + "Hangi tarihi tercih edersiniz?"`,

      waiting_for_pax: `📝 SİSTEMİN BELİRLEDİĞİ ADIM: KİŞİ SAYISI

GÖREVİN: SADECE kişi sayısı sor. Başka HİÇBİR şey sorma.
- Kısa bir onay/teşekkür + "Kaç kişi katılacaksınız?" sorusu.${forbiddenList}

❌ YASAK CEVAPLAR (canlı bug kanıtları):
- "Hangi tarihi tercih edersiniz?" (← tarih ZATEN seçildi)
- "Adınızı alabilir miyim?" (← isim adımı DEĞİL)
- "Telefon numaranız?" (← telefon adımı DEĞİL)
✅ TEK DOĞRU: "Harika! Kaç kişi katılacaksınız?"`,

      waiting_for_name: `📝 SİSTEMİN BELİRLEDİĞİ ADIM: İSİM

GÖREVİN: SADECE ad-soyad iste. Başka HİÇBİR şey sorma.
- Kısa bir onay/teşekkür + "Ad ve soyadınızı alabilir miyim?" sorusu.${forbiddenList}

❌ YASAK CEVAPLAR (canlı bug kanıtları):
- "Kaç kişi katılacaksınız?" (← pax ZATEN alındı)
- "Hangi tarih?" (← tarih ZATEN seçildi)
- "Telefon numaranız?" (← telefon adımı DEĞİL)
✅ TEK DOĞRU: "Teşekkürler! Ad ve soyadınızı alabilir miyim?"`,

      waiting_for_phone: `📝 SİSTEMİN BELİRLEDİĞİ ADIM: TELEFON

GÖREVİN: SADECE telefon numarası iste. Başka HİÇBİR şey sorma.
- Kısa bir onay/teşekkür (isim varsa "Teşekkürler [İsim] Hanım/Bey") + "Telefon numaranızı alabilir miyim?" sorusu.${forbiddenList}

❌ YASAK CEVAPLAR (Tuğçe canlı bug 2026-06-19 kanıtı):
- "Kaç kişi katılacaksınız?" (← pax ZATEN alındı, bu mesajda silinmedi)
- "İsminizi aldım. Kaç kişi?" (← pax ZATEN alındı; isim onayından sonra pax SORMA)
- "Hangi tarih?" (← tarih ZATEN seçildi)
- "Adınızı alabilir miyim?" (← isim ZATEN alındı)
✅ TEK DOĞRU CEVAP: "Teşekkürler Tuğçe Hanım. Telefon numaranızı alabilir miyim?"

⚠️ ÖZEL UYARI: Yukarıda "ZATEN ALINDI" listesindeki alanları sorma diye
defalarca yazıldı. State doğru; sen sadece bu adımın metnini yaz.`,

      waiting_for_email: `📝 SİSTEMİN BELİRLEDİĞİ ADIM: E-POSTA

GÖREVİN: SADECE e-posta adresi iste. Başka HİÇBİR şey sorma.
- Kısa bir onay + "E-posta adresinizi alabilir miyim? (İsterseniz 'geç' diyebilirsiniz)" sorusu.${forbiddenList}

❌ YASAK CEVAPLAR:
- "Kaç kişi?" / "Adınız?" / "Telefon?" / "Hangi tarih?" (hepsi ZATEN alındı)
✅ TEK DOĞRU: "E-posta adresinizi alabilir miyim? ('geç' diyebilirsiniz)"`,

      default: `📝 ADIM: Bilgi toplama
- Eksik bilgiyi tamamla. ${forbiddenList}`,
    },
    en: {
      waiting_for_date: `📝 SYSTEM-DECIDED STEP: DATE SELECTION

YOUR TASK: ONLY ask for date selection. Nothing else.
- FIRST list ALL available dates numbered.
- Include price for each.
- End with "Which date do you prefer?"${forbiddenList}

❌ FORBIDDEN RESPONSES (live bug evidence):
- "How many people?" (← not the pax step)
- "May I have your name?" (← not the name step)
✅ ONLY CORRECT: date list + "Which date do you prefer?"`,

      waiting_for_pax: `📝 SYSTEM-DECIDED STEP: PAX COUNT

YOUR TASK: ONLY ask number of people. Nothing else.
- Brief acknowledgement + "How many people will join?"${forbiddenList}

❌ FORBIDDEN RESPONSES (live bug evidence):
- "Which date?" (← date ALREADY selected)
- "May I have your name?" (← not the name step)
- "Your phone?" (← not the phone step)
✅ ONLY CORRECT: "Great! How many people will join?"`,

      waiting_for_name: `📝 SYSTEM-DECIDED STEP: NAME

YOUR TASK: ONLY ask full name. Nothing else.
- Brief acknowledgement + "May I have your full name?"${forbiddenList}

❌ FORBIDDEN RESPONSES (live bug evidence):
- "How many people?" (← pax ALREADY collected)
- "Which date?" (← date ALREADY selected)
- "Your phone?" (← not the phone step)
✅ ONLY CORRECT: "Thank you! May I have your full name?"`,

      waiting_for_phone: `📝 SYSTEM-DECIDED STEP: PHONE

YOUR TASK: ONLY ask phone number. Nothing else.
- Brief acknowledgement (if name known: "Thank you [Name]") + "May I have your phone number?"${forbiddenList}

❌ FORBIDDEN RESPONSES (Tuğçe live bug 2026-06-19 evidence):
- "How many people?" (← pax ALREADY collected, NOT dropped in this turn)
- "Got your name. How many people?" (← never ask pax after name confirmation)
- "Which date?" (← date ALREADY selected)
- "May I have your name?" (← name ALREADY collected)
✅ ONLY CORRECT RESPONSE: "Thank you Tuğçe. May I have your phone number?"

⚠️ SPECIAL WARNING: The "ALREADY COLLECTED" list above says don't ask
those fields. State is correct; you just write this step's question.`,

      waiting_for_email: `📝 SYSTEM-DECIDED STEP: EMAIL

YOUR TASK: ONLY ask for email. Nothing else.
- Brief acknowledgement + "May I have your email address? (You can say 'skip' to opt out)"${forbiddenList}

❌ FORBIDDEN RESPONSES:
- "How many people?" / "Your name?" / "Your phone?" / "Which date?" (all ALREADY collected)
✅ ONLY CORRECT: "May I have your email address? ('skip' to opt out)"`,

      default: `📝 STEP: Collect info
- Complete the missing field.${forbiddenList}`,
    },
  };

  const langPrompts = prompts[language] || prompts.en;
  return langPrompts[collectionStep] || langPrompts.default;
}

// ============================================
// MAIN STAGE PROMPT FUNCTION
// ============================================
export function getStagePrompt(context: PromptContext): string {
  const { stage, collectionStep, currentTour, reservationInfo, language, tone, availableTours } = context;

  // === UYDURMA YASAĞI + KALKI YERİ KURALI - Tüm stage'lerde geçerli ===
  const hallucinationGuard =
    language === "tr"
      ? `\n\n🌐 DİL HATIRLATMASI: Kullanıcının yazdığı dilde yanıt ver. Hangi dilde yazıyorsa o dilde cevap ver.\n\n🚫 KRİTİK KURAL - UYDURMA YASAĞI:
- ASLA veritabanında olmayan tur, tarih, fiyat veya bilgi UYDURMA.
- Sadece sana verilen tur listesindeki bilgileri kullan.
- Listede olmayan bir tur sorulursa "Bu tur sistemimizde bulunmuyor" de.
- Tarih veya fiyat bilgisi verilmemişse "Bilgi mevcut değil" de, asla tahmin etme.
- "Her hafta", "her Cuma" gibi bilgileri VERİTABANINDA YOKSA söyleme.
- Kullanıcının sormadığı turun tarih veya fiyat bilgisini ASLA gösterme.

🚨 KRİTİK KURAL - ACENTE BİLGİSİ:
- Adres, çalışma saati, iptal/iade politikası, dahil olanlar/hizmetler → SADECE sana verilen Acente Bilgisi bölümündeki verileri kullan.
- Bu bilgiler sana verilmemişse (listede yoksa): "Bu bilgi için lütfen acentemizle iletişime geçin" de. KESİNLİKLE tahmin veya uydurma yapma.
- Özellikle: belirli adres bilgisi, açılış/kapanış saati, kişi başı dahil olan hizmetler için veri yoksa UYDURMA.

🚨 KRİTİK KURAL - KALKI / TOPLANMA YERİ:
- "Kalkış yeri", "nereden hareket", "toplanma yeri", "nerede buluşuyoruz" sorularında:
  → SADECE turun hareket_noktasi alanındaki bilgiyi ver
  → Acente ofis adresini ASLA kalkış/toplanma yeri olarak verme
  → hareket_noktasi boşsa: "Kalkış yeri detayları için acentemizle iletişime geçiniz" de
  → Kalkış saati için toplanma_saati alanını kullan, yoksa "Saati acentemizden öğrenebilirsiniz" de

🚨 KRİTİK KURAL - TUR PROGRAMI:
- Tur programı, gezilecek yerler için SADECE gezilecek_yerler ve program_kisa alanlarını kullan.
- Bu alanlar boşsa "Detaylı program için acentemizle iletişime geçiniz" de.
- ASLA program uydurma.`
      : `\n\n🌐 LANGUAGE REMINDER: Respond in the user's language. Always match the language of their message.\n\n🚫 CRITICAL RULE - NO HALLUCINATION:
- NEVER invent tours, dates, prices or information not in the database.
- Only use information from the tour list provided to you.
- If asked about a tour not in the list, say "This tour is not in our system".
- Never guess or invent. Never show another tour's dates.

🚨 CRITICAL RULE - AGENCY INFORMATION:
- Address, working hours, cancellation/refund policy, included services → ONLY use data from the Agency Info section provided to you.
- If this information is not given to you (not in the list): say "Please contact our agency for this information." NEVER guess or invent.
- Especially for: specific address, opening/closing hours, per-person inclusions — if not provided, DO NOT guess.

🚨 CRITICAL RULE - DEPARTURE / MEETING POINT:
- For questions about "departure point", "where to meet", "pickup location":
  → ONLY use the tour's hareket_noktasi field
  → NEVER use the agency office address as departure/meeting point
  → If hareket_noktasi is empty: say "Please contact our agency for departure details"
  → For departure time use toplanma_saati field, if empty say "Please ask the agency"

🚨 CRITICAL RULE - TOUR PROGRAM:
- For tour program/itinerary, ONLY use gezilecek_yerler and program_kisa fields.
- If empty: say "Please contact our agency for the detailed program".
- NEVER invent a program.`;

  if (stage === "GREETING") return getGreetingPrompt(context) + hallucinationGuard;
  if (stage === "BROWSING") return getBrowsingPrompt(context) + hallucinationGuard;

  const tourDetails = currentTour ? formatTourDetails(currentTour, language, tone) : "";
  const collectedInfo = formatCollectedInfo(reservationInfo, language);
  const summary = formatReservationSummary(currentTour, reservationInfo, language, tone);

  if (language === "tr") {
    switch (stage) {
      case "TOUR_SELECTED":
        return (
          `📍 DURUM: Tur seçildi

${tourDetails}

🚨 KRİTİK KURAL - KULLANICI NİYETİ BELİRSİZSE:
- Sadece tur adını yazdıysa → "Bilgi almak mı, rezervasyon mu?" diye sor.
- Açıkça rezervasyon istiyorsa → tarihleri listele.
- Sadece bilgi istiyorsa → tur detaylarını ver, rezervasyon başlatma.

🚨 KRİTİK KURAL - TARİH SEÇİMİ:
- TÜM müsait tarihleri numaralı liste halinde göster.
- Her tarih için fiyat bilgisi de ver.
- "Hangi tarihi tercih edersiniz?" diye sor.
- Tarih seçilmeden kişi/isim/telefon SORMA.` + hallucinationGuard
        );

      case "DATE_SELECTION":
        return (
          `📍 DURUM: Tarih seçimi
- NET bir tarih belirle.
- Tarihleri listele ve seçim iste.
- YENİ TARİH UYDURMA.` + hallucinationGuard
        );

      case "COLLECTING_INFO":
        const stepPrompt = getCollectionStepPrompt(collectionStep || "default", "tr", reservationInfo);
        const dateReinforcement =
          collectionStep === "waiting_for_date" && currentTour
            ? `\n\nSEÇİLİ TURUN TARİHLERİ:\n${tourDetails}\n\n🚨 ZORUNLU: Tarihleri numaralı listele ve seçim iste.`
            : "";
        return (
          `📍 DURUM: Bilgi toplama
${stepPrompt}
${dateReinforcement}

✅ ZATEN TOPLANAN BİLGİLER (bunları TEKRAR SORMA, sadece referans için):
${collectedInfo}

⚠️ Kullanıcı bilgi sorusu sorarsa ÖNCE cevapla, sonra YUKARIDA belirtilen adıma DÖN.
⚠️ Adımı sen seçemezsin — sistem belirledi. Sadece o adımın sorusunu sor.` + hallucinationGuard
        );

      case "CONFIRMING":
        return (
          `📍 SİSTEMİN BELİRLEDİĞİ ADIM: ONAY

GÖREVİN: SADECE özeti göster ve onay sor. Başka HİÇBİR şey sorma.
Tarih, kişi sayısı, isim ve telefon ZATEN ALINDI — bunları TEKRAR SORMA,
doğrulama amaçlı bile sorma.

${summary}

"Bu bilgiler doğru mudur, onaylıyor musunuz?" diye sor. Sadece bu.

❌ YASAK ÖRNEK CEVAPLAR (gerçek bug kanıtları):
- "Şimdi ad-soyad alabilir miyim?" (← isim zaten alındı, YASAK)
- "Telefon numaranızı tekrar alabilir miyim?" (← telefon zaten alındı, YASAK)
- "Kaç kişi katılacaksınız?" (← pax zaten alındı, YASAK)
- "Hangi tarih için?" (← tarih zaten alındı, YASAK)

✅ İYİ CEVAP: "Özet: [tur] / [tarih] / [kişi] / [isim] / [telefon]. Onaylıyor musunuz?"

⚠️ Kullanıcı soru sorarsa cevapla ama onayı tekrar iste. Asla yeni bilgi isteme.` + hallucinationGuard
        );

      case "COMPLETED":
        return (
          `📍 DURUM: Kayıt tamamlandı ✅

${summary ? `📋 MEVCUT REZERVASYON:\n${summary}\n` : ""}
🎯 YAPILACAK:
- Kullanıcının sorusunu yanıtla.
- "Rezervasyonunuz tamamlandı" tekrar DEME (zaten söylendi).
- Gerekirse "Acentemiz en kısa sürede sizinle iletişime geçecek" ekle.

🚨 AFTER-SALES — ACENTE YÖNLENDİRME KURALLARI:
- DEĞİŞİKLİK / İPTAL talebi: "Rezervasyon değişikliği ve iptali için lütfen doğrudan acentemizle iletişime geçin" de. Botu KENDIN değiştirme veya iptal etme — bu kritik iş kuralı.
- "ÖDEDİM" / "DEKONT GÖNDERDİM": "Teşekkürler! Acentemiz ödemenizi teyit edecek ve en kısa sürede sizinle iletişime geçecek" de.
- "NE ZAMAN ARAYACAKSINIŻ": Acentenin iletişim bilgisini ver + "En kısa sürede sizinle iletişime geçecekler" de.
- "BULUŞMA YERİ / TRANSFER / NE GETİREYİM": Tur kalkış bilgisini ver; bilgi yoksa acenteye yönlendir.

🚨 KRİTİK - BAŞKA TUR SORARSA:
- Bilgi istiyorsa → o turun bilgisini ver
- Rezervasyon istiyorsa → "Elbette, [tur adı] için başlatıyorum" de
- Niyet belirsizse → "Bilgi mi, rezervasyon mu?" diye sor

🚫 İPTAL / DEĞİŞİKLİK: ASLA kendin iptal etme veya değiştirme. Her zaman acenteye yönlendir.` + hallucinationGuard
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

🚨 CRITICAL - INTENT UNCLEAR:
- If user just wrote the tour name → ask "Info or reservation?"
- If clearly wants reservation → list dates.
- If just wants info → provide details, don't start reservation.

🚨 CRITICAL - DATE SELECTION:
- List ALL available dates numbered.
- Show price for each.
- Ask "Which date do you prefer?"
- Don't ask pax/name/phone before date.` + hallucinationGuard
      );

    case "DATE_SELECTION":
      return (
        `📍 STATUS: Date selection
- List dates and ask to choose.
- Don't invent dates.` + hallucinationGuard
      );

    case "COLLECTING_INFO":
      const stepPromptEn = getCollectionStepPrompt(collectionStep || "default", "en", reservationInfo);
      return (
        `📍 STATUS: Collecting information
${stepPromptEn}

${collectionStep === "waiting_for_date" && currentTour ? `TOUR DATES:\n${tourDetails}\n\n🚨 List these dates numbered and ask user to choose.` : ""}

✅ ALREADY COLLECTED (DO NOT ASK AGAIN, reference only):
${collectedInfo}

⚠️ If user asks a question, answer first then RETURN to the step above.
⚠️ You CANNOT choose the step — the system decides. Only ask the question for that step.` + hallucinationGuard
      );

    case "CONFIRMING":
      return (
        `📍 SYSTEM-DECIDED STEP: CONFIRMATION

YOUR TASK: ONLY show the summary and ask for confirmation. Nothing else.
Date, number of people, name and phone are ALREADY COLLECTED — DO NOT ask
again, not even for verification.

${summary}

Ask "Are these details correct, do you confirm?" That's all.

❌ FORBIDDEN EXAMPLES (real bug evidence):
- "May I have your name?" (← name already collected, FORBIDDEN)
- "Could you give me your phone again?" (← phone already collected, FORBIDDEN)
- "How many people?" (← pax already collected, FORBIDDEN)
- "Which date?" (← date already collected, FORBIDDEN)

✅ GOOD: "Summary: [tour] / [date] / [pax] / [name] / [phone]. Do you confirm?"

⚠️ If user asks a question, answer it but ask for confirmation again. NEVER ask for new info.` + hallucinationGuard
      );

    case "COMPLETED":
      return (
        `📍 STATUS: Registration completed ✅

${summary ? `📋 CURRENT RESERVATION:\n${summary}\n` : ""}
🎯 DO:
- Answer the user's question.
- Do NOT say "your reservation is confirmed" again (already confirmed).
- If relevant, add "Our team will contact you shortly."

🚨 AFTER-SALES — AGENCY REFERRAL RULES:
- CHANGE / CANCELLATION request: Say "For booking changes and cancellations, please contact our agency directly." NEVER change or cancel the booking yourself — this is a critical business rule.
- "I PAID" / "SENT RECEIPT": Say "Thank you! Our agency will confirm your payment and contact you shortly."
- "WHEN WILL YOU CALL": Provide agency contact info + "They will contact you as soon as possible."
- "MEETING POINT / TRANSFER / WHAT TO BRING": Provide tour departure details; if unavailable, refer to agency.

🚨 IF USER WANTS ANOTHER TOUR:
- Info → provide info
- Booking → say "Of course, starting reservation for [tour name]"
- Unclear → ask "Info or reservation?"

🚫 CANCELLATION / CHANGES: NEVER perform cancellations or changes yourself. Always refer to agency.` + hallucinationGuard
      );

    default:
      return "" + hallucinationGuard;
  }
}
