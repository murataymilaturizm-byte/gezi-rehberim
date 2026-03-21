// Reservation Service

import { CONFIG } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import type { ConversationContext } from "../../shared/fsm/types.ts";

interface ReservationResult {
  success: boolean;
  error?: string;
}

/**
 * Save completed reservation to database
 */
export async function saveReservation(
  supabase: any,
  context: ConversationContext,
  agencyId: string = CONFIG.DEMO_AGENCY_ID
): Promise<ReservationResult> {
  const { fullName, phone, dateId, paxAdult } = context.reservationInfo || {};
  const tour = context.currentTour;

  // Validate all required fields
  if (!tour || !dateId || !fullName || !phone || !paxAdult) {
    logger.warn("Missing required fields for reservation", {
      hasTour: !!tour,
      hasDateId: !!dateId,
      hasFullName: !!fullName,
      hasPhone: !!phone,
      hasPaxAdult: !!paxAdult,
    });
    return { success: false, error: "Missing required fields" };
  }

  try {
    logger.info("Saving reservation to database...");

    const { error } = await supabase.from("registrations").insert({
      agency_id: agencyId,
      tour_id: tour.id,
      tour_date_id: dateId,
      full_name: fullName,
      phone: phone,
      pax: paxAdult,
      status: CONFIG.DEFAULT_STATUS,
      source_channel: CONFIG.SOURCE_CHANNEL,
      payment_status: CONFIG.DEFAULT_PAYMENT_STATUS,
      note: "Demo chat reservation",
    });

    if (error) {
      logger.error("Error saving reservation", error);
      return { success: false, error: error.message };
    }

    logger.info("Reservation saved successfully");
    return { success: true };
  } catch (err) {
    logger.error("Unexpected error saving reservation", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Save complaint to database
 */
export async function saveComplaint(
  supabase: any,
  sessionId: string,
  message: string,
  agencyId: string = CONFIG.DEMO_AGENCY_ID
): Promise<ReservationResult> {
  logger.info("Saving complaint to database...");

  const { error } = await supabase.from("complaints").insert({
    agency_id: agencyId,
    phone: sessionId,
    message: message,
    type: "complaint",
    status: "new",
  });

  if (error) {
    logger.error("Error saving complaint", error);
    return { success: false, error: error.message };
  }

  logger.info("Complaint saved successfully");
  return { success: true };
}

/**
 * Save conversation messages to database
 */
export async function saveConversation(
  supabase: any,
  sessionId: string,
  userMessage: string,
  assistantResponse: string,
  agencyId: string = CONFIG.DEMO_AGENCY_ID
): Promise<void> {
  const { error } = await supabase.from("whatsapp_conversations").insert([
    {
      phone: sessionId,
      role: "user",
      content: userMessage,
      agency_id: agencyId,
    },
    {
      phone: sessionId,
      role: "assistant",
      content: assistantResponse,
      agency_id: agencyId,
    },
  ]);

  if (error) {
    logger.warn("Error saving conversation", error);
  }
}

/**
 * Get conversation history from database
 */
export async function getConversationHistory(
  supabase: any,
  sessionId: string,
  agencyId: string = CONFIG.DEMO_AGENCY_ID,
  limit: number = CONFIG.CONVERSATION_HISTORY_LIMIT
): Promise<Array<{ role: string; content: string }>> {
  const { data: history } = await supabase
    .from("whatsapp_conversations")
    .select("role, content, created_at")
    .eq("phone", sessionId)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (history || []).map((msg: any) => ({
    role: msg.role === "user" ? "user" : "assistant",
    content: msg.content,
  }));
}
