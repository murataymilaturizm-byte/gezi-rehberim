// Prompt Builder Helper Service

import { buildSystemPrompt } from "../../shared/fsm/prompt-builder.ts";
import { findTourById } from "./tour-matching.ts";
import type { Tour, AgencyData } from "../types/index.ts";
import type { ConversationContext } from "../../shared/fsm/types.ts";

interface PromptBuilderOptions {
  context: ConversationContext;
  previousContext?: ConversationContext;
  availableTours: Tour[];
  agencyData: AgencyData | null;
  paymentInfo?: string;
  multipleTourMatches?: Tour[];
  selectedTour?: Tour | null;
}

/**
 * Build tour switch warning message
 */
function buildTourSwitchWarning(context: ConversationContext, selectedTour: Tour | null): string {
  if (!selectedTour || !context.currentTour) return "";
  if (selectedTour.id === context.currentTour.id) return "";

  const lang = context.language;
  const currentTour = context.currentTour;
  const reservationInfo = context.reservationInfo;

  if (context.stage === "COLLECTING_INFO") {
    if (lang === "tr") {
      return `\n\n🚨 KRİTİK UYARI: Kullanıcı şu anda "${currentTour.title}" için rezervasyon YAPIYOR (tarih: ${
        reservationInfo.selectedDate || "belirtilmedi"
      }, kişi: ${reservationInfo.paxAdult || "belirtilmedi"}).
      
Ama kullanıcı "${selectedTour.title}" hakkında bir şey söyledi.

MUTLAKA ŞUNU SOR:
"Şu anda ${currentTour.title} için rezervasyon yapıyoruz. ${selectedTour.title} turuna geçmek ister misiniz? 
Geçerseniz mevcut rezervasyon bilgileriniz silinecek."

ASLA tur değişikliği yapma, sadece kullanıcıdan onay iste!`;
    } else {
      return `\n\n🚨 CRITICAL WARNING: User is currently making a reservation for "${currentTour.title}".
But user mentioned "${selectedTour.title}".
YOU MUST ASK for confirmation before switching. NEVER switch automatically!`;
    }
  }

  if (context.stage === "TOUR_SELECTED" && Object.keys(reservationInfo).length > 2) {
    if (lang === "tr") {
      return `\n\n⚠️ DİKKAT: Kullanıcı "${currentTour.title}" seçmişti, şimdi "${selectedTour.title}" sordu. Netleştir: "Hangi tur için devam etmek istersiniz?"`;
    } else {
      return `\n\n⚠️ ATTENTION: User had selected "${currentTour.title}", now asked about "${selectedTour.title}". Clarify: "Which tour would you like to continue with?"`;
    }
  }

  return "";
}

/**
 * Build COMPLETED stage prompt extension
 * Prevents chatbot from repeating "reservation confirmed" after it's already done
 * and handles new tour inquiries cleanly
 */
function buildCompletedStagePrompt(context: ConversationContext, previousContext?: ConversationContext): string {
  if (!previousContext) return "";

  const lang = context.language;

  // User asking questions while still in COMPLETED (same tour or different)
  if (previousContext.stage === "COMPLETED" && context.stage === "COMPLETED") {
    if (lang === "tr") {
      return `\n\n✅ TAMAMLANAN REZERVASYon SONRASI:
Kullanıcının rezervasyonu zaten tamamlandı.
Kullanıcı şu an soru soruyor. SADECE sorusunu yanıtla.
KESİNLİKLE "rezervasyonunuz tamamlandı", "kaydınız oluşturuldu" veya benzeri TEKRAR SÖYLEME.
Doğal bir konuşma gibi devam et.`;
    } else {
      return `\n\n✅ POST-RESERVATION STATE:
User's reservation is already completed.
User is asking a question. Just ANSWER their question naturally.
DO NOT repeat "your reservation is confirmed" or "booking completed".
Continue naturally.`;
    }
  }

  // User selected a different tour after completing reservation
  if (previousContext.stage === "COMPLETED" && context.stage === "TOUR_SELECTED") {
    if (lang === "tr") {
      return `\n\n🔄 YENİ TUR SEÇİLDİ:
Kullanıcı yeni bir tur seçti: ${context.currentTour?.title || ""}.
Önceki rezervasyondan (${previousContext.currentTour?.title || ""}) KESİNLİKLE bahsetme.
Sanki yeni bir konuşma başlıyormuş gibi sadece yeni tura odaklan.
"Kaydınız tamamlandı" veya önceki tura dair HİÇBİR ŞEY söyleme.`;
    } else {
      return `\n\n🔄 NEW TOUR SELECTED:
User selected a new tour: ${context.currentTour?.title || ""}.
DO NOT mention the previous reservation (${previousContext.currentTour?.title || ""}) at all.
Focus only on the new tour as if starting fresh.
Never say anything about the previous booking.`;
    }
  }

  return "";
}

/**
 * Build complete system prompt for AI
 */
export function buildCompleteSystemPrompt(options: PromptBuilderOptions): string {
  const { context, previousContext, availableTours, agencyData, paymentInfo, multipleTourMatches, selectedTour } =
    options;

  const currentTourData = context.currentTour ? findTourById(context.currentTour.id, availableTours) : null;

  const basePrompt = buildSystemPrompt({
    stage: context.stage,
    collectionStep: context.collectionStep,
    currentTour: currentTourData,
    reservationInfo: context.reservationInfo,
    availableTours,
    language: context.language,
    tone: context.tone,
    agencyName: agencyData?.name,
    agencyCity: agencyData?.city,
    agencyAddress: agencyData?.address,
    agencyPhone: agencyData?.phone_public,
    agencyWebsite: agencyData?.website_url,
    agencyWorkingHours: agencyData?.working_hours,
    agencyMapsUrl: agencyData?.maps_url,
    agencyCancellationPolicy: agencyData?.cancellation_policy,
    paymentInfo,
    multipleTourMatches: multipleTourMatches && multipleTourMatches.length > 1 ? multipleTourMatches : undefined,
  });

  const tourSwitchWarning = buildTourSwitchWarning(context, selectedTour || null);
  const completedStagePrompt = buildCompletedStagePrompt(context, previousContext);

  return basePrompt + tourSwitchWarning + completedStagePrompt;
}
