// Prompt Builder Helper Service

import { buildSystemPrompt } from "../../shared/fsm/prompt-builder.ts";
import { findTourById } from "./tour-matching.ts";
import type { Tour, AgencyData } from "../types/index.ts";
import type { ConversationContext } from "../../shared/fsm/types.ts";

interface PromptBuilderOptions {
  context: ConversationContext;
  availableTours: Tour[];
  agencyData: AgencyData | null;
  paymentInfo?: string;
  multipleTourMatches?: Tour[];
  selectedTour?: Tour | null;
}

/**
 * Build tour switch warning message
 */
function buildTourSwitchWarning(
  context: ConversationContext,
  selectedTour: Tour | null
): string {
  if (!selectedTour || !context.currentTour) return "";
  if (selectedTour.id === context.currentTour.id) return "";

  const lang = context.language;
  const currentTour = context.currentTour;
  const reservationInfo = context.reservationInfo;

  // If user is in COLLECTING_INFO and mentions different tour
  if (context.stage === "COLLECTING_INFO") {
    if (lang === "tr") {
      return `\n\n🚨 KRİTİK UYARI: Kullanıcı şu anda "${currentTour.title}" için rezervasyon YAPIYOR (tarih: ${
        reservationInfo.selectedDate || "belirtilmedi"
      }, kişi: ${reservationInfo.paxAdult || "belirtilmedi"}).
      
Ama kullanıcı "${selectedTour.title}" hakkında bir şey söyledi.

MUTLAKA ŞUNU SOR:
"Şu anda ${currentTour.title} için rezervasyon yapıyoruz. ${selectedTour.title} turuna geçmek ister misiniz? 
Geçerseniz mevcut rezervasyon bilgileriniz (${
        reservationInfo.selectedDate
          ? "tarih: " + reservationInfo.selectedDate
          : "girdiğiniz bilgiler"
      }) silinecek.

Cevabınız: 
- Evet, ${selectedTour.title} turuna geç → Ben tur değiştirme yapacağım
- Hayır, ${currentTour.title} ile devam → Mevcut rezervasyona devam"

ASLA tur değişikliği yapma, sadece kullanıcıdan onay iste!`;
    } else {
      return `\n\n🚨 CRITICAL WARNING: User is currently making a reservation for "${
        currentTour.title
      }" (date: ${reservationInfo.selectedDate || "not specified"}, pax: ${
        reservationInfo.paxAdult || "not specified"
      }).

But user mentioned "${selectedTour.title}".

YOU MUST ASK:
"You're currently making a reservation for ${currentTour.title}. Would you like to switch to ${selectedTour.title}? 
If you switch, your current reservation info (${
        reservationInfo.selectedDate
          ? "date: " + reservationInfo.selectedDate
          : "entered details"
      }) will be deleted.

Your answer:
- Yes, switch to ${selectedTour.title} → I'll switch the tour
- No, continue with ${currentTour.title} → Continue current reservation"

NEVER switch tours automatically, only ask for confirmation!`;
    }
  }

  // If user is in TOUR_SELECTED but has info already
  if (
    context.stage === "TOUR_SELECTED" &&
    Object.keys(reservationInfo).length > 2
  ) {
    if (lang === "tr") {
      return `\n\n⚠️ DİKKAT: Kullanıcı "${currentTour.title}" seçmişti, şimdi "${selectedTour.title}" sordu. Netleştir: "Hangi tur için devam etmek istersiniz?"`;
    } else {
      return `\n\n⚠️ ATTENTION: User had selected "${currentTour.title}", now asked about "${selectedTour.title}". Clarify: "Which tour would you like to continue with?"`;
    }
  }

  return "";
}

/**
 * Build complete system prompt for AI
 */
export function buildCompleteSystemPrompt(options: PromptBuilderOptions): string {
  const { context, availableTours, agencyData, paymentInfo, multipleTourMatches, selectedTour } = options;

  const currentTourData = context.currentTour 
    ? findTourById(context.currentTour.id, availableTours) 
    : null;

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
    multipleTourMatches: multipleTourMatches && multipleTourMatches.length > 1 
      ? multipleTourMatches 
      : undefined,
  });

  const tourSwitchWarning = buildTourSwitchWarning(context, selectedTour || null);

  return basePrompt + tourSwitchWarning;
}
