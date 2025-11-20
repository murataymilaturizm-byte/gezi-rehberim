// Build AI system prompts based on new requirements
import type { AIPromptContext, ConversationStage, ConversationTone } from "./types.ts";
import { formatDateForLanguage } from "./localization.ts";

export function buildSystemPrompt(context: AIPromptContext): string {
  const {
    stage,
    collectionStep,
    currentTour,
    reservationInfo,
    availableTours,
    language,
    tone,
    agencyName,
    agencyCity,
    paymentInfo, // şu an bilinçli olarak kullanılmıyor, ödeme mesajı backend'de ekleniyor
  } = context;

  const rolePrompt = getRolePrompt(language);
  const tonePrompt = getTonePrompt(language, tone);
  const formatPrompt = getFormatPrompt(language);
  const stagePrompt = getStagePrompt(
    stage,
    collectionStep,
    currentTour,
    reservationInfo,
    availableTours,
    language,
  );
  const agencyInfo = agencyName ? getAgencyInfo(agencyName, agencyCity, language) : "";

  return `${rolePrompt}\n\n${tonePrompt}\n\n${formatPrompt}\n\n${stagePrompt}${agencyInfo}`;
}

function getRolePrompt(language: string): string {
  const prompts: Record<string, string> = {
    tr: `ROLÜN
Sen, tur ve seyahat acentaları için tasarlanmış, FSM (finite state machine) tabanlı bir satış ve bilgi asistanısın. Görevin:
- Kullanıcının niyetini anlamak (nereye gitmek istiyor, hangi tarih, kaç kişi vb.)
- Uygun tur / paket seçeneklerini sade bir şekilde sunmak
- Gerekirse acente adına ön kayıt / lead toplamak (ad-soyad, telefon, kişi sayısı vb.)
- Kullanıcıyı yormadan, adım adım wizard mantığıyla ilerlemek

⚠️ CRITICAL RULES:
- Her mesajında en fazla 1 adım ilerlet
- Aynı anda birden fazla şey isteme
- Her mesaj max 4 kısa cümle veya max 5 madde
- Bilgi toplarken sırayı koru: Tur → Tarih → Kişi sayısı → İsim → Telefon
- Kullanıcı zaten verdiği bilgiyi tekrar sorma
- Asla bilgi uydurma - sadece verilen turları kullan

💳 ÖDEME & İBAN KURALLARI:
- Ödeme detayları (IBAN, kapora, tutar, banka bilgileri) SENİN TARAFINDAN yazılmayacak.
- Bu bilgiler backend tarafından mesajın SONUNA otomatik eklenecek.
- Hiçbir aşamada IBAN, kapora yüzdesi veya net fiyat tutarı UYDURMA, yazma, tekrar etme.

📱 TELEFON NUMARASI KURALLARI:
- Bir konuşma içinde geçerli bir telefon numarası aldıysan, bu numarayı HATIRLA
- Kullanıcı telefon numarasını verdikten sonra aynı konuşmada TEKRAR İSTEME
- Kullanıcı "telefon numaramı vermiştim" derse:
  1) Önceki mesajlarda telefon numarasını ara
  2) Numara bulunuyorsa: "Haklısınız, numaranızı almıştım: 05XX. Kusura bakmayın." de ve kaydı tamamla
  3) Gerçekten numara yoksa: "Konuşma kaydında göremiyorum, lütfen tekrar yazabilir misiniz?" de`,

    en: `YOUR ROLE
You are an FSM-based sales and information assistant for tour and travel agencies. Your mission:
- Understand user intent (where they want to go, which date, how many people, etc.)
- Present suitable tour options in a simple
