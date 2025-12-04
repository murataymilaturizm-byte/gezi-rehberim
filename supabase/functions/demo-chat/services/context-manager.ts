// Context Management Service

import { logger } from "../utils/logger.ts";
import { createInitialContext } from "../../shared/fsm/state-machine.ts";
import { detectLanguage } from "../../shared/fsm/language.ts";
import { detectLanguageChangeIntent, getDefaultToneForLanguage } from "../../shared/fsm/localization.ts";
import type { ConversationContext } from "../../shared/fsm/types.ts";

interface ContextLoadOptions {
  clientState: unknown;
  message: string;
  conversationStyle?: string;
}

interface ContextResult {
  context: ConversationContext;
  runtimeDetectedLang: string | null;
}

/**
 * Load or create conversation context with language handling
 */
export async function loadOrCreateContext(options: ContextLoadOptions): Promise<ContextResult> {
  const { clientState, message, conversationStyle } = options;

  // Detect language change intent first
  const languageChangeIntent = detectLanguageChangeIntent(message);
  
  // Detect language from message content
  const runtimeDetectedLang = await detectLanguage(message);
  
  logger.debug("Language detection", { 
    runtimeDetectedLang, 
    languageChangeIntent 
  });

  let context: ConversationContext;

  if (clientState && isValidContext(clientState)) {
    logger.debug("Using existing client state");
    context = clientState;

    // Priority 1: Explicit language change request
    if (languageChangeIntent && languageChangeIntent !== context.language) {
      logger.info(`Explicit language change: ${context.language} → ${languageChangeIntent}`);
      context.language = languageChangeIntent;
      (context as any).detectedLanguage = languageChangeIntent;
      context.tone = getDefaultToneForLanguage(languageChangeIntent) as any;
      logger.debug(`Tone updated to: ${context.tone}`);
    }
    // Priority 2: Automatic detection (only if different and no explicit change)
    else if (runtimeDetectedLang && runtimeDetectedLang !== context.language && !languageChangeIntent) {
      logger.info(`Auto language update: ${context.language} → ${runtimeDetectedLang}`);
      context.language = runtimeDetectedLang;
      (context as any).detectedLanguage = runtimeDetectedLang;
    }
    
    // Update tone from conversationStyle if provided
    if (conversationStyle && context.tone !== conversationStyle) {
      logger.debug(`Updating tone from frontend: ${context.tone} → ${conversationStyle}`);
      context.tone = conversationStyle as any;
    }
  } else {
    logger.debug("Initializing fresh context");
    const initialLang = runtimeDetectedLang || "tr";
    const tone = conversationStyle || getDefaultToneForLanguage(initialLang);

    context = createInitialContext(initialLang, tone as any);
    (context as any).detectedLanguage = runtimeDetectedLang || undefined;

    logger.debug(`Language: ${initialLang}, Tone: ${tone}`);
  }

  return { context, runtimeDetectedLang };
}

/**
 * Type guard for validating conversation context
 */
export function isValidContext(ctx: unknown): ctx is ConversationContext {
  return (
    ctx !== null &&
    typeof ctx === "object" &&
    typeof (ctx as any).stage === "string" &&
    typeof (ctx as any).language === "string" &&
    typeof (ctx as any).tone === "string" &&
    typeof (ctx as any).messageCount === "number"
  );
}

/**
 * Build rich context string for NLU
 */
export function buildNLUContext(context: ConversationContext): string {
  let nluContext = `Current stage: ${context.stage}.`;
  
  if (context.collectionStep) {
    nluContext += ` Collection step: ${context.collectionStep}.`;
  }
  
  if (context.currentTour) {
    nluContext += ` Selected tour: ${context.currentTour.title}.`;
  }
  
  if (context.reservationInfo) {
    const info = context.reservationInfo;
    const collected: string[] = [];
    
    if (info.selectedDate) collected.push(`date: ${info.selectedDate}`);
    if (info.paxAdult) collected.push(`pax: ${info.paxAdult}`);
    if (info.fullName) collected.push(`name: ${info.fullName}`);
    if (info.phone) collected.push(`phone: ${info.phone}`);
    
    if (collected.length > 0) {
      nluContext += ` Reservation info collected: ${collected.join(', ')}.`;
    }
  }
  
  // If all info collected, indicate ready for confirmation
  if (context.collectionStep === 'ready_for_confirmation' || 
      (context.reservationInfo?.fullName && context.reservationInfo?.phone && 
       context.reservationInfo?.paxAdult && context.reservationInfo?.dateId)) {
    nluContext += ` STATUS: READY FOR CONFIRMATION - waiting for user to confirm booking.`;
  }

  return nluContext;
}
