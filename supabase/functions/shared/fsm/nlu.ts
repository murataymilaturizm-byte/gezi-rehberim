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

const NLU_TIMEOUT_MS = 15000;
const NLU_MAX_RETRIES = 2;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function detectFallbackLanguage(message: string): string {
  const lower = message.toLowerCase();
  if (/hello|hi|when|price|book/.test(lower)) return "en";
  if (/hallo|wann|preis|buchen/.test(lower)) return "de";
  if (/привет|когда|сколько/.test(lower)) return "ru";
  if (/مرحبا|متى|كم/.test(lower)) return "ar";
  if (/bonjour|quand|prix/.test(lower)) return "fr";
  if (/hola|cuándo|precio/.test(lower)) return "es";
  return "tr";
}

function buildFallbackNLU(userMessage: string, availableTours?: any[]): NLUResult {
  const lower = userMessage.toLowerCase().trim();
  const language = detectFallbackLanguage(userMessage);
  const matchedTour = availableTours?.find(
    (tour) =>
      lower.includes(String(tour.title || "").toLowerCase()) ||
      lower.includes(String(tour.destination || "").toLowerCase()),
  );

  if (/merhaba|selam|günaydın|iyi akşamlar|hello|hi|hallo|bonjour|hola|привет|مرحبا/.test(lower)) {
    return { intent: "greeting", language, entities: {}, updates: {} };
  }

  if (/turlar|turları|hangi turlar|listele|show tours|available tours/.test(lower)) {
    return { intent: "browse_tours", language, entities: {}, updates: {} };
  }

  if (matchedTour) {
    const entities = {
      destination: matchedTour.destination,
      tour_name: matchedTour.title,
    };

    if (/katılmak istiyorum|rezervasyon|ayırt|book|join|reserve|booking/.test(lower)) {
      return { intent: "reservation_intent", language, entities, updates: {} };
    }

    return { intent: "tour_search", language, entities, updates: {} };
  }

  if (/\b\d+\b/.test(lower) || /\+?\d[\d\s()-]{8,}/.test(lower)) {
    return { intent: "provide_info", language, entities: {}, updates: {} };
  }

  // Değişiklik talebi: "isim yanlış", "değiştir", "X olsun", "modify" vb. — BUG 5
  if (/değiştir|olsun|olarak\s+değiştir|change|modify|edit|düzelt|yanlış|wrong|incorrect|hatalı|değil|farklı|ändern|falsch|corriger|corregir|корректировать|تعديل/i.test(lower)) {
    return { intent: "change_info", language, entities: {}, updates: {} };
  }

  // Kısa onay — NLU fail durumunda detectConfirmation() FSM'de zaten çalışır, bu ekstra güvenlik
  if (/^(evet|tamam|onayl\S*|yes|confirm|okay|ok|sure|ja|oui|s[ií]|да|نعم|موافق)\b/i.test(lower)) {
    return { intent: "confirm_reservation", language, entities: {}, updates: {} };
  }

  // Şikayet / geri bildirim
  if (/şikayet|memnun\s+değil|complaint|beschwerde|жалоба|شكوى|plainte|queja/i.test(lower)) {
    return { intent: "complaint_feedback", language, entities: {}, updates: {} };
  }

  return { intent: "general", language, entities: {}, updates: {} };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  meta?: { messageLength?: number; attempt?: number },
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.warn("NLU_TIMEOUT", {
        timeoutMs,
        messageLength: meta?.messageLength,
        attempt: meta?.attempt,
      });
      throw new Error("NLU_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

**POST-RESERVATION STATE GUIDANCE (stage=COMPLETED or reservationConfirmed=true):**

A completed reservation does NOT lock the user. They can naturally start over, ask for info, or book another tour. Use context to distinguish:

CASE 1 — User wants to START OVER / NEW RESERVATION:
  - "yeni rezervasyon", "başka tur", "baştan başla", "iptal", "vazgeçtim", "merhaba", "konuşmaya yeniden başlayalım", "rezervasyon yapmak istiyorum"
  - → Return 'reservation_intent' OR 'greeting' OR 'browse_tours' (whichever fits best)
  - DO NOT force these to 'general' or 'faq_general'

CASE 2 — User asks INFORMATIONAL question about existing reservation or general info:
  - "ödeme ne zaman?", "nerede toplanacağız?", "saat kaçta?", "iptal şartı nedir?"
  - → Return 'faq_general' or 'after_sales' or 'agency_info'

CASE 3 — User wants a DIFFERENT tour:
  - "Antalya tur var mı?", "başka bir tur istiyorum", "Pamukkale turu"
  - → Return 'tour_search' or 'browse_tours'

NEVER assume the user wants to stay in COMPLETED forever. Trust their words.

**CRITICAL: INFORMATIONAL QUESTIONS vs PROVIDING INFO:**
- Questions like "tarih ne zaman", "ne zaman", "tarihleri nedir", "fiyat ne kadar", "kaç lira", 
  "nereden kalkıyor", "saat kaçta", "kaç gün sürer", "program nedir" are INFORMATIONAL → use "general" or "faq_general"
- These are NOT "provide_info" - the user is ASKING, not PROVIDING information
- "provide_info" is ONLY when user gives concrete data: "2 kişi", "Ali Yılmaz", "05551234567", "12 aralık"
- If the message contains question words (ne zaman, kaç, nedir, nereden, nasıl, hangi, var mı, müsait mi) → it's a QUESTION, not provide_info

**Intents:**
- greeting: User says hello or starts conversation
- browse_tours: User wants to see available tours
- tour_search: User searches for specific destination/tour (ONLY when explicitly asking about tours; after COMPLETED use only for actual new tour searches, NOT for post-reservation info questions)
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

**CRITICAL: SHORT NUMBERS AND COLLECTING INFO:**
- If user message is ONLY a number (1–50) — e.g. "3", "2", "5" — or a number + person word ("3 kişi", "2 person", "4 yetişkin", "1 çocuk") → intent MUST be "provide_info". NEVER "tour_search".
- A single number cannot be a tour name or destination. Do not extract tour_name or destination from it.
- If conversation shows stage=COLLECTING_INFO or CONFIRMING (or collectionStep is set), strongly prefer "provide_info" or "confirm_reservation" over "tour_search" or "general" — unless user explicitly names a DIFFERENT tour/destination that is not the currently selected one.
- Only return "tour_search" in COLLECTING_INFO/CONFIRMING if user clearly says they want a completely different tour (e.g. "başka bir tur istiyorum", "Bodrum turuna geçelim").

**CRITICAL CONTEXT RULES FOR SHORT CONFIRMATIONS:**
1. If conversation summary contains "TOUR_SELECTED" or "Currently selected tour" AND user says: "tamam/ok/evet/olur/yapabiliriz/sure/yes/let's go/haydi/hadi" → MUST return reservation_intent
2. If conversation summary contains "CONFIRMING" or "ready for confirmation" or "onay bekliyor" AND user says ANY positive word like "evet/tamam/onaylıyorum/yes/confirm/ok/doğru" → MUST return confirm_reservation
3. Short positive responses WITHOUT tour context → general
4. "evet onaylıyorum" or just "evet" in CONFIRMING stage → confirm_reservation
5. If stage is COMPLETED and user asks an INFORMATIONAL question → faq_general. But if user wants to START OVER ("merhaba", "yeni rezervasyon", "başka tur") → return appropriate intent (greeting / browse_tours / reservation_intent), NOT general

**Entities to extract:**
- destination: City or country name (ONLY when user is asking about tours, NOT for visa/payment/agency questions)
- tour_name: Specific tour name mentioned (ONLY when user is asking about tours AND intent is NOT faq_general/general after COMPLETED)
- dates: Any dates mentioned
- people_count: Number of adults and children
- full_name: Customer's full name (ONLY 2-3 word combinations that are clearly proper names, NOT common words or phrases)
- phone: Phone number

**CRITICAL RULE — NEGATED DESTINATIONS / TOUR NAMES (do NOT extract negated targets):**
If the user is REJECTING or EXCLUDING a destination/tour, DO NOT extract it as their target. Extract ONLY destinations the user wants AFFIRMATIVELY.

Negation/exclusion patterns to recognize across languages (semantic, not literal):
- The user says they do NOT want X, X is NOT acceptable, somewhere/something OTHER THAN X, EXCEPT X, BESIDES X, ANYTHING BUT X.
- Turkish: "X dışında", "X değil başka", "X hariç", "X olmasın", "X istemiyorum", "X yerine başka"
- English: "not X", "other than X", "anywhere but X", "except X", "besides X", "no X please", "I don't want X"
- German: "nicht X", "außer X", "kein X", "etwas anderes als X"
- Russian: "не X", "кроме X", "что-нибудь кроме X", "не хочу X"
- French: "pas X", "autre que X", "sauf X", "pas de X", "à part X"
- Spanish: "no X", "otro que X", "excepto X", "menos X", "que no sea X"
- Arabic: "ليس X", "غير X", "ما عدا X", "بدون X", "لا أريد X"

When a destination/tour appears ONLY in a negation context, leave the destination and tour_name fields EMPTY (do not return the negated value). The user's actual intent is "show me OTHER options" — intent should be browse_tours or tour_search with NO entities (the system will list available tours).

Examples (negated → DO NOT extract):
- "antalya dışında nereler var" → intent: browse_tours, destination: (empty). NOT destination=antalya.
- "antalya değil başka biryer" → intent: browse_tours, destination: (empty).
- "not Cappadocia, somewhere else" → intent: browse_tours, destination: (empty).
- "nicht Istanbul" → intent: browse_tours, destination: (empty).
- "что-нибудь кроме Антальи" → intent: browse_tours, destination: (empty).

Examples (affirmative → DO extract):
- "antalya turuna katılmak istiyorum" → destination: antalya.
- "Pamukkale hakkında bilgi" → destination/tour_name: pamukkale.
- "I want to book Cappadocia" → destination: cappadocia.

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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
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

    // NOT: availableTours BİLİNÇLİ olarak NLU prompt'una EKLENMEZ.
    // NLU sadece niyet/dil/entity (destination/tour_name string) sınıflıyor — bunlar kullanıcı
    // mesajından çıkar, listeden değil. Asıl tur EŞLEŞTİRME services/tour-matching.ts'te kodda
    // fuzzy + token match ile yapılıyor; NLU'nun listeye ihtiyacı yok. Parametre fonksiyon imzasında
    // kalıyor çünkü `buildFallbackNLU` (API fail durumu) tur ismi tahmini için kullanıyor (aşağıda).
    // Çağrı başına ~5 turda ~50-150 token tasarruf (Haiku input).

    // Anthropic tool format: top-level name/description/input_schema (no nested "function" wrapper)
    const nluTool = {
      name: "analyze_message",
      description: "Analyze user message and extract intent and entities",
      input_schema: {
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
    };

    let lastError: Error | null = null;
    let toolUseBlock: any = null;

    for (let attempt = 1; attempt <= NLU_MAX_RETRIES; attempt++) {
      const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
          // Prompt caching artık GA, defensive olarak beta header'ı bırakıyoruz.
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          // PROMPT CACHING: NLU_SYSTEM_PROMPT tamamen statik (kullanıcı/agency'ye bağımlı değil),
          // ephemeral cache hedefi. Tüm NLU çağrılarında aynı prefix → kalıcı %90 indirim.
          system: [
            {
              type: "text",
              text: NLU_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            { role: "user", content: contextPrompt },
          ],
          tools: [nluTool],
          // Force the model to use the analyze_message tool
          tool_choice: { type: "tool", name: "analyze_message" },
        }),
      }, NLU_TIMEOUT_MS, { messageLength: userMessage.length, attempt });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`NLU API error (attempt ${attempt}/${NLU_MAX_RETRIES}):`, response.status, errorText);
        lastError = new Error(`AI API error: ${response.status}`);

        const isTransient = response.status === 503 || response.status === 529;
        if (!isTransient || attempt === NLU_MAX_RETRIES) {
          throw lastError;
        }
        await delay(500 * attempt);
        continue;
      }

      const data = await response.json();
      // DEBUG: prompt caching doğrulaması — NLU_SYSTEM_PROMPT'un cache'lenip lendiğini gösterir.
      // İlk çağrı: cache_creation_input_tokens > 0. Sonraki 5 dk içinde aynı prefix: cache_read > 0.
      if (data.usage) {
        console.log("[nlu] CACHE_USAGE", {
          input: data.usage.input_tokens,
          output: data.usage.output_tokens,
          cache_creation_input_tokens: data.usage.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: data.usage.cache_read_input_tokens ?? 0,
        });
      }
      // Anthropic returns content as an array of blocks; find the tool_use block
      toolUseBlock = (data.content || []).find((b: any) => b?.type === "tool_use");

      if (!toolUseBlock) {
        // No tool call returned — treat as a soft fallback
        return { intent: "general", language: "tr", entities: {}, updates: {} };
      }
      break;
    }

    if (!toolUseBlock) {
      throw lastError || new Error("NLU_NO_TOOL_USE");
    }

    // Anthropic returns tool input as a parsed object (not a JSON string)
    const analysis = toolUseBlock.input || {};
    const entities = analysis.entities || {};

    const updates: Partial<ReservationInfo> = {};
    // Pax: NLU'dan gelen değer 50'yi geçemez — BUG 2
    if (entities.people_count?.adults) {
      const _pax = Number(entities.people_count.adults);
      if (_pax >= 1 && _pax <= 50) updates.paxAdult = _pax;
    }
    if (entities.people_count?.children) updates.paxChild = entities.people_count.children;
    // FullName: en az 2 kelime olmalı — BUG 3
    if (entities.full_name) {
      const _fnWords = String(entities.full_name).trim().split(/\s+/);
      if (_fnWords.length >= 2) updates.fullName = entities.full_name;
    }
    if (entities.phone) updates.phone = entities.phone;

    // NLU_ENTITIES — tarih extraction debug için kritik
    // K6: PII masking — full_name/phone maskelenir, sadece "var/yok" durumu loglanır
    console.info("NLU_ENTITIES", {
      intent: analysis.intent,
      language: analysis.language,
      dates: entities.dates,
      date_singular: entities.date,
      tour_name: entities.tour_name,
      destination: entities.destination,
      people_count: entities.people_count,
      has_full_name: !!entities.full_name,
      has_phone: !!entities.phone,
      // updates objesi de phone/fullName içerebilir — maskele
      updates: {
        ...updates,
        ...(updates.phone ? { phone: "***" + String(updates.phone).slice(-4) } : {}),
        ...(updates.fullName ? { fullName: String(updates.fullName).charAt(0) + "***" } : {}),
      },
    });

    return {
      intent: analysis.intent,
      language: analysis.language,
      entities,
      updates,
      clarification_needed: analysis.clarification_needed,
    };
  } catch (error) {
    console.error("NLU error:", error);
    return buildFallbackNLU(userMessage, availableTours);
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
