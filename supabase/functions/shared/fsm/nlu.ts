// Natural Language Understanding with AI tool calling
import type { ReservationInfo } from "./types.ts";

export interface NLUResult {
  intent: string;
  language: string;
  entities: {
    destination?: string;
    tour_name?: string;
    dates?: string[];
    people_count?: { adults?: number; children?: number };
  };
  updates: Partial<ReservationInfo>;
  clarification_needed?: string;
}

const NLU_SYSTEM_PROMPT = `You are an NLU (Natural Language Understanding) system for a travel agency chatbot. 
Your job is to analyze user messages and extract intents and entities.

**CRITICAL RULES FOR TOUR MATCHING:**
- Only extract destination/tour_name when user is EXPLICITLY asking about tours or destinations
- DO NOT extract destination/tour_name for general agency questions like:
  * Visa questions (vize, visa requirements, passport)
  * Payment questions (ödeme, payment, kredi kartı, havale, euro, dolar, currency)
  * Cancellation/refund questions (iptal, iade, refund, cancellation)
  * Agency info (adres, telefon, çalışma saatleri, iletişim, contact)
  * Working hours (saat kaçta, ne zaman açık, working hours)
- If a location is mentioned in context of visa/payment/agency questions, DO NOT extract it as destination

**CRITICAL RULE FOR POST-RESERVATION STATE:**
If the conversation shows a reservation is already COMPLETED (stage=COMPLETED or reservationConfirmed=true) 
and the user asks ANY informational question about tours (ne zaman, tarih, fiyat, program, detay, kaç gün, 
nerede, hangi otel, nasıl, kaç kişi, müsait mi, uygun mu, var mı, vb.) → intent MUST be 'faq_general' or 'general'.
NEVER return 'tour_search', 'reservation_intent', or 'select_tour' for informational questions after a completed reservation.
The user is just browsing/asking for info, NOT starting a new reservation.

**CRITICAL: INFORMATIONAL QUESTIONS vs PROVIDING INFO:**
- Questions like "tarih ne zaman", "ne zaman", "tarihleri nedir", "fiyat ne kadar", "kaç lira", 
  "nereden kalkıyor", "saat kaçta", "kaç gün sürer", "program nedir" are INFORMATIONAL → use "general" or "faq_general"
- These are NOT "provide_info" - the user is ASKING, not PROVIDING information
- "provide_info" is ONLY when user gives concrete data: "2 kişi", "Ali Yılmaz", "05551234567", "12 aralık"
- If the message contains question words (ne zaman, kaç, nedir, nereden, nasıl, hangi, var mı, müsait mi) → it's a QUESTION, not provide_info

**Intents:**
- greeting: User says hello or starts conversation
- browse_tours: User wants to see available tours
- tour_search: User searches for specific destination/tour (ONLY when explicitly asking about tours AND no reservation is completed)
- select_tour: User selects a specific tour
- reservation_intent: User wants to make a reservation. CRITICAL RULES:
  * EXPLICIT requests: "I want to book", "rezervasyon yapmak istiyorum", "book this tour", "let's book"
  * CONTEXT-AWARE (when current state = "TOUR_SELECTED"): Simple confirmations like "tamam", "olur", "evet", "yapabiliriz", "ok", "yes", "sure", "let's do it", "evet yapalım", "hadi", "kabul", "haydi" → ALL MEAN reservation_intent
  * When a tour is already selected and user says ANY positive short confirmation → reservation_intent (NOT general!)
  * NEVER return reservation_intent for informational questions after a completed reservation
- confirm_reservation: User confirms FINAL booking. CRITICAL RULES:
  * This is for CONFIRMING stage when ALL info is collected (date, pax, name, phone)
  * Trigger words: "evet", "onaylıyorum", "tamam", "onayla", "evet onaylıyorum", "yes", "confirm", "yes confirm", "doğru", "kesinleştir"
  * Simple "evet" or "tamam" in CONFIRMING stage = confirm_reservation
  * If conversation summary contains "CONFIRMING" or "ready for confirmation" or "onay bekliyor" → short positive responses are confirm_reservation
- provide_info: User provides concrete reservation data (date, pax count, name, phone number)
- change_info: User wants to modify information
- agency_info: User asks about agency details (name, address, phone, website, contact)
- working_hours: User asks about business hours
- payment_methods: User asks about payment options, currencies accepted
- cancellation_policy: User asks about cancellation/refund rules
- visa_support: User asks about visa requirements or support
- hotel_details: User asks about hotel/accommodation
- transport_details: User asks about transportation
- custom_package: User wants a custom/private tour package
- after_sales: User wants to modify/check existing reservation
- complaint_feedback: User has a complaint or wants to give feedback
- faq_general: General tour-related questions, informational questions about tours
- human_handover: User wants to speak with a real person
- general: General questions or chat

**CRITICAL CONTEXT RULES FOR SHORT CONFIRMATIONS:**
1. If conversation summary contains "TOUR_SELECTED" or "Currently selected tour" AND user says: "tamam/ok/evet/olur/yapabiliriz/sure/yes/let's go/haydi/hadi" → MUST return reservation_intent
2. If conversation summary contains "CONFIRMING" or "ready for confirmation" or "onay bekliyor" AND user says ANY positive word like "evet/tamam/onaylıyorum/yes/confirm/ok/doğru" → MUST return confirm_reservation
3. Short positive responses WITHOUT tour context → general
4. "evet onaylıyorum" or just "evet" in CONFIRMING stage → confirm_reservation
5. If stage is COMPLETED and user asks about any tour → faq_general (NOT reservation_intent or tour_search)

**Entities to extract:**
- destination: City or country name (ONLY when user is asking about tours, NOT for visa/payment/agency questions)
- tour_name: Specific tour name mentioned (ONLY when user is asking about tours AND intent is NOT faq_general/general after COMPLETED)
- dates: Any dates mentioned
- people_count: Number of adults and children
- full_name: Customer's full name (ONLY 2-3 word combinations that are clearly proper names, NOT common words or phrases)
- phone: Phone number

**CRITICAL RULE FOR FULL_NAME EXTRACTION:**
- Only extract full_name when the message clearly contains a personal name
- Do NOT extract full_name from: questions, confirmations, tour names, city names, common words
- A valid full_name consists of 2-3 proper noun words, each capitalized, with no numbers
- Examples of VALID names: "Ahmet Yılmaz", "Ali Kaya Demir", "John Smith"
- Examples of INVALID (do not extract): "This Is", "Kapadokya Turu", "Evet Tamam", "19 Nisan"

Return your analysis as structured data.`;

export async function analyzeUserMessage(
  userMessage: string,
  conversationSummary?: string,
  currentState?: string,
  selectedTour?: any,
  availableTours?: any[],
): Promise<NLUResult> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    let contextPrompt = `User message: "${userMessage}"\n\n`;

    if (conversationSummary) {
      contextPrompt += `Conversation so far: ${conversationSummary}\n\n`;
    }

    if (currentState) {
      contextPrompt += `Current state: ${currentState}\n\n`;
    }

    if (selectedTour) {
      contextPrompt += `Currently selected tour: ${selectedTour.title} (${selectedTour.destination})\n\n`;
    }

    if (availableTours && availableTours.length > 0) {
      contextPrompt += `Available tours:\n${availableTours.map((t) => `- ${t.title} (${t.destination})`).join("\n")}\n\n`;
    }

    const nluTool = {
      type: "function" as const,
      function: {
        name: "analyze_message",
        description: "Analyze user message and extract intent and entities",
        parameters: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: [
                "greeting",
                "browse_tours",
                "tour_search",
                "select_tour",
                "reservation_intent",
                "provide_info",
                "confirm_reservation",
                "change_info",
                "agency_info",
                "working_hours",
                "payment_methods",
                "cancellation_policy",
                "visa_support",
                "hotel_details",
                "transport_details",
                "custom_package",
                "after_sales",
                "complaint_feedback",
                "faq_general",
                "human_handover",
                "general",
              ],
              description: "The detected user intent",
            },
            language: {
              type: "string",
              enum: ["tr", "en", "de", "ru", "ar", "fr", "es"],
              description: "The detected language",
            },
            entities: {
              type: "object",
              properties: {
                destination: { type: "string" },
                tour_name: { type: "string" },
                dates: { type: "array", items: { type: "string" } },
                people_count: {
                  type: "object",
                  properties: {
                    adults: { type: "number" },
                    children: { type: "number" },
                  },
                },
                full_name: { type: "string" },
                phone: { type: "string" },
              },
            },
            clarification_needed: { type: "string" },
          },
          required: ["intent", "language", "entities"],
        },
      },
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: NLU_SYSTEM_PROMPT },
          { role: "user", content: contextPrompt },
        ],
        tools: [nluTool],
        tool_choice: { type: "function", function: { name: "analyze_message" } },
        
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return { intent: "general", language: "tr", entities: {}, updates: {} };
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    const updates: Partial<ReservationInfo> = {};
    if (analysis.entities.people_count?.adults) updates.paxAdult = analysis.entities.people_count.adults;
    if (analysis.entities.people_count?.children) updates.paxChild = analysis.entities.people_count.children;
    if (analysis.entities.full_name) updates.fullName = analysis.entities.full_name;
    if (analysis.entities.phone) updates.phone = analysis.entities.phone;

    return {
      intent: analysis.intent,
      language: analysis.language,
      entities: analysis.entities,
      updates,
      clarification_needed: analysis.clarification_needed,
    };
  } catch (error) {
    console.error("NLU error:", error);
    return { intent: "general", language: "tr", entities: {}, updates: {} };
  }
}

export function mapNLUIntentToFSMIntent(nluIntent: string): string {
  const mapping: Record<string, string> = {
    browse_tours: "browse_tours",
    tour_search: "tour_search",
    select_tour: "tour_selected",
    reservation_intent: "reservation_intent",
    provide_info: "provide_info",
    confirm_reservation: "confirm_reservation",
    change_info: "change_info",
    greeting: "greeting",
    agency_info: "general_question",
    working_hours: "general_question",
    payment_methods: "general_question",
    cancellation_policy: "general_question",
    visa_support: "general_question",
    hotel_details: "general_question",
    transport_details: "general_question",
    custom_package: "support_request",
    after_sales: "support_request",
    complaint_feedback: "support_request",
    faq_general: "general_question",
    human_handover: "support_request",
    general: "general",
  };

  return mapping[nluIntent] || "general";
}
