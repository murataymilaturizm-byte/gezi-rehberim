// All stage prompts - WITH TONE SUPPORT
import type { PromptContext } from "../types.ts";
import { formatTourDetails, formatCollectedInfo, formatReservationSummary, formatToursList } from "../helpers.ts";
import { getGreetingPrompt } from "./greeting.ts";
import { getBrowsingPrompt } from "./browsing.ts";

// Helper function to get collection step prompt
function getCollectionStepPrompt(collectionStep: string, language: string): string {
  const prompts: Record<string, Record<string, string>> = {
    tr: {
      waiting_for_date: `📝 ADIM: Tarih seçimi
- Kullanıcıdan hangi tarihte katılmak istediğini sor.
- Eğer tur için birden fazla tarih varsa, bunları listeleyip seçmesini iste.
⚠️ ÖNEMLİ: Eğer kullanıcı başka bir bilgi verdiyse (isim, telefon, kişi sayısı), önce onu KABUL ET:
  "Teşekkürler, [verilen bilgi] kaydedildi. Şimdi hangi tarihte katılmak istersiniz?" gibi bir geçiş cümlesi kullan.`,

      waiting_for_pax: `📝 ADIM: Kişi sayısı
- Kullanıcıdan kaç kişi katılacağını sor.
⚠️ ÖNEMLİ: Eğer kullanıcı başka bir bilgi verdiyse (isim, telefon), önce onu KABUL ET:
  "Teşekkürler, [verilen bilgi] kaydedildi. Kaç kişi katılacaksınız?" gibi bir geçiş cümlesi kullan.`,

      waiting_for_name: `📝 ADIM: İsim
- Sadece ad-soyad iste.
⚠️ ÖNEMLİ: Eğer kullanıcı başka bir bilgi verdiyse (telefon), önce onu KABUL ET:
  "Teşekkürler, telefon numaranızı aldım. Şimdi ad-soyadınız nedir?" gibi bir geçiş cümlesi kullan.`,

      waiting_for_phone: `📝 ADIM: Telefon
- Sadece telefon numarası iste.
⚠️ ÖNEMLİ: Eğer kullanıcı başka bir bilgi verdiyse (isim), önce onu KABUL ET:
  "Teşekkürler [isim], kaydınızı aldım. Telefon numaranızı da alabilir miyim?" gibi bir geçiş cümlesi kullan.`,

      ready_for_confirmation: `📝 ADIM: Onay için hazır
- Tüm bilgiler toplandı, kullanıcıya özet göster ve onay iste.`,

      default: `📝 ADIM: Bilgi toplama
- Eksik olan bilgiyi tamamlamaya odaklan.
- Kullanıcının verdiği bilgiyi önce KABUL ET ve kaydet, sonra eksik olanı iste.`,
    },
    en: {
      waiting_for_date: `📝 STEP: Date selection
- Ask which date the user prefers.
⚠️ IMPORTANT: If the user provided other information (name, phone, pax), ACKNOWLEDGE it first:
  Say something like "Thank you, I've noted [the info]. Now, which date would you prefer?"`,

      waiting_for_pax: `📝 STEP: Pax count
- Ask how many people will join.
⚠️ IMPORTANT: If the user provided other information (name, phone), ACKNOWLEDGE it first:
  Say something like "Thank you, I've noted [the info]. How many people will be joining?"`,

      waiting_for_name: `📝 STEP: Name
- Only ask for full name.
⚠️ IMPORTANT: If the user provided other information (phone), ACKNOWLEDGE it first:
  Say something like "Thank you for the phone number. What is your full name?"`,

      waiting_for_phone: `📝 STEP: Phone
- Only ask for phone number.
⚠️ IMPORTANT: If the user provided other information (name), ACKNOWLEDGE it first:
  Say something like "Thank you [name], I've noted your name. Could you also share your phone number?"`,

      ready_for_confirmation: `📝 STEP: Ready for confirmation
- All information collected, show summary to user and ask for confirmation.`,

      default: `📝 STEP: Collect missing info
- Focus on completing the missing field.
- When user provides info, ACKNOWLEDGE it first then ask for the next missing piece.`,
    },
  };

  const langPrompts = prompts[language] || prompts.tr;
  return langPrompts[collectionStep] || langPrompts.default;
}

export function getStagePrompt(context: PromptContext): string {
  const { stage, collectionStep, currentTour, reservationInfo, language, tone, availableTours } = context;

  // Use dedicated functions for greeting and browsing
  if (stage === "GREETING") return getGreetingPrompt(context);
  if (stage === "BROWSING") return getBrowsingPrompt(context);

  // Pass tone to formatting functions
  const tourDetails = currentTour ? formatTourDetails(currentTour, language, tone) : "";
  const collectedInfo = formatCollectedInfo(reservationInfo, language);
  const summary = formatReservationSummary(currentTour, reservationInfo, language, tone);
  const toursList = formatToursList(availableTours, language, tone);

  // Turkish prompts
  if (language === "tr") {
    switch (stage) {
      case "TOUR_SELECTED":
        return `📍 DURUM: Tur seçildi
Seçili turun özetini kısa anlat (süre, destinasyon, temel özellikler):

${tourDetails}

- Kullanıcı "kayıt olmak istiyorum" dese bile, önce TARİH konusunda netleş.
- Turda birden fazla tarih varsa, bunları listeleyip "Hangi tarihi tercih edersiniz?" diye sor.
- Sadece 1 tarih varsa, o tarihi söyle ve "Bu tarih sizin için uygun mu?" diye sor.
- Bu aşamada henüz kişi sayısı, isim, telefon isteme.`;

      case "DATE_SELECTION":
        return `📍 DURUM: Tarih seçimi
- Görevin, seçilen tur için NET bir tarih belirlemek.
- Birden fazla tarih varsa hepsini madde madde listele ve "Hangi tarihi tercih edersiniz? (1, 2, 3 şeklinde cevap verebilirsiniz.)" diye sor.
- Sadece 1 tarih varsa bu tarihi açıkça belirt ve "Bu tarih sizin için uygun mu?" diye sor.
- LİSTELEDİĞİN TARİHLERİN DIŞINDA YENİ BİR TARİH UYDURMA.`;

      case "COLLECTING_INFO":
        const stepPrompt = getCollectionStepPrompt(collectionStep || "default", "tr");
        return `📍 DURUM: Bilgi toplama
${stepPrompt}

Şu ana kadar toplanan bilgiler:
${collectedInfo}

⚠️ KRİTİK KURAL: Kullanıcı her bilgiyi verdiğinde önce KABUL ET, sonra eksik olanı iste.
- BU AŞAMADA "rezervasyonunuzu oluşturalım mı" veya "onayınızı bekliyorum" DİYEMEZSİN.`;

      case "CONFIRMING":
        return `📍 DURUM: Onay bekleniyor
ŞU FORMATTA CEVAP ÜRET:

1) Önce aşağıdaki özeti AYNEN yaz:
${summary}

2) Bir boş satır bırak.

3) Son satırda SADECE şunu yaz:
"Bu bilgiler doğru mudur, onaylıyor musunuz?"

- Bu aşamada ödeme, IBAN, kapora bilgisi VERME.`;

      case "COMPLETED":
        return `📍 DURUM: Kayıt tamamlandı
En fazla 3 kısa cümle yaz:
"Teşekkür ederiz, kayıt bilgilerinizi aldık."
"Acentemiz en kısa sürede sizinle iletişime geçerek rezervasyonunuzu netleştirecek."
"Ödeme ve hesap bilgileri bu mesajın devamında sistem tarafından otomatik olarak paylaşılacaktır."

YASAK: "IBAN", "kapora", "tutar", "havale", banka bilgileri, TL miktarları.`;

      default:
        return "";
    }
  }

  // English prompts
  switch (stage) {
    case "TOUR_SELECTED":
      return `📍 STATUS: Tour selected
Briefly describe the selected tour:

${tourDetails}

- Even if user wants to book, FIRST clarify the date.
- List dates and ask "Which date would you prefer?".
- Do NOT ask for pax, name or phone yet.`;

    case "DATE_SELECTION":
      return `📍 STATUS: Date selection
- Confirm a clear date for the tour.
- List all dates and ask "Which date? (Answer with 1, 2, 3...)".
- Do NOT INVENT dates outside the list.`;

    case "COLLECTING_INFO":
      const stepPromptEn = getCollectionStepPrompt(collectionStep || "default", "en");
      return `📍 STATUS: Collecting information
${stepPromptEn}

Information collected so far:
${collectedInfo}

⚠️ CRITICAL: ACCEPT what user provides first, then ask for missing info.
- Do NOT say "shall I complete your booking" or ask for confirmation here.`;

    case "CONFIRMING":
      return `📍 STATUS: Awaiting confirmation
FOLLOW THIS FORMAT:

1) Write this summary EXACTLY:
${summary}

2) Empty line.

3) Last line ONLY:
"Are these details correct, do you confirm?"

- Do NOT provide payment details here.`;

    case "COMPLETED":
      return `📍 STATUS: Registration completed
Write max 3 short sentences:
"Thank you, we have received your registration."
"Our team will contact you shortly to finalize."
"Payment details will be shared automatically below."

BANNED WORDS: "IBAN", "deposit", "amount", "bank", currency amounts.`;

    default:
      return "";
  }
}
