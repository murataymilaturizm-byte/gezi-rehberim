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
    AI_CALL: "Şu an teknik bir sorun yaşıyorum. Lütfen birkaç dakika sonra tekrar deneyin.",
    UNKNOWN: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.",
  },
  en: {
    VALIDATION: "Invalid request. Please try again.",
    TOURS_LOAD: "Failed to load tours.",
    AGENCY_LOAD: "Failed to load agency information.",
    CONVERSATION_SAVE: "Could not save your message. Please try again.",
    RESERVATION_SAVE: "Could not complete reservation.",
    AI_CALL: "I'm experiencing a technical issue right now. Please try again in a few minutes.",
    UNKNOWN: "Sorry, an error occurred. Please try again.",
  },
  de: {
    VALIDATION: "Ungültige Anfrage. Bitte versuchen Sie es erneut.",
    TOURS_LOAD: "Touren konnten nicht geladen werden.",
    AGENCY_LOAD: "Agenturinformationen konnten nicht geladen werden.",
    CONVERSATION_SAVE: "Ihre Nachricht konnte nicht gespeichert werden. Bitte erneut versuchen.",
    RESERVATION_SAVE: "Buchung konnte nicht abgeschlossen werden.",
    AI_CALL: "Ich habe gerade ein technisches Problem. Bitte versuchen Sie es in wenigen Minuten erneut.",
    UNKNOWN: "Entschuldigung, ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
  },
  ru: {
    VALIDATION: "Неверный запрос. Пожалуйста, попробуйте снова.",
    TOURS_LOAD: "Не удалось загрузить туры.",
    AGENCY_LOAD: "Не удалось загрузить информацию об агентстве.",
    CONVERSATION_SAVE: "Не удалось сохранить ваше сообщение. Попробуйте снова.",
    RESERVATION_SAVE: "Не удалось завершить бронирование.",
    AI_CALL: "У меня сейчас техническая проблема. Пожалуйста, попробуйте через несколько минут.",
    UNKNOWN: "Извините, произошла ошибка. Пожалуйста, попробуйте снова.",
  },
  ar: {
    VALIDATION: "طلب غير صالح. يرجى المحاولة مجدداً.",
    TOURS_LOAD: "فشل تحميل الجولات.",
    AGENCY_LOAD: "فشل تحميل معلومات الوكالة.",
    CONVERSATION_SAVE: "تعذر حفظ رسالتك. يرجى المحاولة مجدداً.",
    RESERVATION_SAVE: "تعذر إتمام الحجز.",
    AI_CALL: "أواجه مشكلة تقنية حالياً. يرجى المحاولة بعد بضع دقائق.",
    UNKNOWN: "آسف، حدث خطأ. يرجى المحاولة مجدداً.",
  },
  fr: {
    VALIDATION: "Requête invalide. Veuillez réessayer.",
    TOURS_LOAD: "Impossible de charger les circuits.",
    AGENCY_LOAD: "Impossible de charger les informations de l'agence.",
    CONVERSATION_SAVE: "Votre message n'a pas pu être enregistré. Veuillez réessayer.",
    RESERVATION_SAVE: "La réservation n'a pas pu être finalisée.",
    AI_CALL: "Je rencontre un problème technique. Veuillez réessayer dans quelques minutes.",
    UNKNOWN: "Désolé, une erreur s'est produite. Veuillez réessayer.",
  },
  es: {
    VALIDATION: "Solicitud inválida. Por favor intenta de nuevo.",
    TOURS_LOAD: "No se pudieron cargar los tours.",
    AGENCY_LOAD: "No se pudo cargar la información de la agencia.",
    CONVERSATION_SAVE: "No se pudo guardar tu mensaje. Por favor intenta de nuevo.",
    RESERVATION_SAVE: "No se pudo completar la reserva.",
    AI_CALL: "Tengo un problema técnico ahora. Por favor intenta de nuevo en unos minutos.",
    UNKNOWN: "Lo siento, ocurrió un error. Por favor intenta de nuevo.",
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

/**
 * Kritik hata durumunda frontend'e 200 ile kullanıcı dostu mesaj döndürür.
 * Frontend bunu chat balonu olarak gösterir (500 değil).
 */
export function createUserFacingErrorResponse(
  errorType: ErrorType,
  language: string = "tr",
  internalError?: unknown
): Response {
  if (internalError) {
    logger.error(`Critical error (${errorType})`, internalError);
  }
  const userMessage = getUserFriendlyMessage(errorType, language);
  return new Response(
    JSON.stringify({ response: userMessage, isError: true }),
    {
      status: 200,
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
