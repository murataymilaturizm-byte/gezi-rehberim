// Error Handler for Demo Chat

import { corsHeaders } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";

type ErrorType = 
  | "VALIDATION"
  | "TOURS_LOAD"
  | "AGENCY_LOAD"
  | "CONVERSATION_SAVE"
  | "RESERVATION_SAVE"
  | "AI_CALL"
  | "UNKNOWN";

const ERROR_MESSAGES: Record<string, Record<ErrorType, string>> = {
  tr: {
    VALIDATION: "Geçersiz istek. Lütfen tekrar deneyin.",
    TOURS_LOAD: "Turlar yüklenirken bir sorun oluştu.",
    AGENCY_LOAD: "Acenta bilgileri yüklenemedi.",
    CONVERSATION_SAVE: "Mesajınız kaydedilemedi, lütfen tekrar deneyin.",
    RESERVATION_SAVE: "Rezervasyon tamamlanamadı.",
    AI_CALL: "Yanıt oluşturulurken bir hata oluştu.",
    UNKNOWN: "Bir hata oluştu. Lütfen tekrar deneyin.",
  },
  en: {
    VALIDATION: "Invalid request. Please try again.",
    TOURS_LOAD: "Failed to load tours.",
    AGENCY_LOAD: "Failed to load agency information.",
    CONVERSATION_SAVE: "Could not save your message. Please try again.",
    RESERVATION_SAVE: "Could not complete reservation.",
    AI_CALL: "Error generating response.",
    UNKNOWN: "An error occurred. Please try again.",
  },
};

export function getUserFriendlyMessage(errorType: ErrorType, language: string = "tr"): string {
  const messages = ERROR_MESSAGES[language] || ERROR_MESSAGES.tr;
  return messages[errorType] || messages.UNKNOWN;
}

export function createErrorResponse(
  errorType: ErrorType,
  statusCode: number = 500,
  language: string = "tr",
  internalError?: unknown
): Response {
  if (internalError) {
    logger.error(`Request failed (${errorType})`, internalError);
  }
  
  const userMessage = getUserFriendlyMessage(errorType, language);
  
  return new Response(
    JSON.stringify({ error: userMessage }),
    {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

export function createSuccessResponse(data: unknown): Response {
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export class DemoChatError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "DemoChatError";
  }
}
