// Demo chat endpoint - Clean FSM v3.0.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared FSM
import { createInitialContext, processTransition, getNextExpectedInput } from "../shared/fsm/state-machine.ts";
import { sanitizeInput } from "../shared/fsm/validator.ts";
import { buildSystemPrompt } from "../shared/fsm/prompt-builder.ts";
import { detectLanguage } from "../shared/fsm/language.ts";
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from "../shared/fsm/nlu.ts";
import { extractNameAndPhone } from "../shared/fsm/simple-extractor.ts";
import { pickLocalized, detectLanguageChangeIntent, getDefaultToneForLanguage } from "../shared/fsm/localization.ts";
import type { ConversationContext, ProcessingInput } from "../shared/fsm/types.ts";

// Demo-specific services
import { callAI } from "./services/ai.ts";
import { matchTour, findTourById } from "./services/tour-matcher.ts";

// Config
import { DEMO_AGENCY_ID, DEMO_TOURS, DEMO_PAYMENT_INSTRUCTIONS } from "./config/demo-tours.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message: rawMessage, sessionId, conversationState: clientState, conversationStyle } = await req.json();
    const message = sanitizeInput(rawMessage);

    if (!sessionId) {
      throw new Error("Session ID required");
    }

    console.log("🚀 DEMO CHAT FSM v3.0.0 - CLEAN START");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load tours from database for demo agency
    const { data: dbTours, error: toursError } = await supabase
      .from("tours")
      .select(
        `
        *,
        dates:tour_dates(*)
      `,
      )
      .eq("agency_id", DEMO_AGENCY_ID)
      .order('created_at', { ascending: true }); // TUTARLI SIRALAMA İÇİN

    if (toursError) {
      console.error("❌ Error loading tours:", toursError);
      throw new Error("Failed to load tours");
    }

    // Helper function to create localized tour object
    const createLocalizedTour = (tour: any, lang: string) => ({
      id: tour.id,
      title: pickLocalized(tour, 'title', lang),
      destination: pickLocalized(tour, 'destination', lang),
      type: tour.type,
      currency: tour.currency,
      program_kisa: pickLocalized(tour, 'program_kisa', lang),
      gezilecek_yerler: tour.gezilecek_yerler,
      toplanma_saati: tour.toplanma_saati,
      hareket_noktasi: tour.hareket_noktasi,
      tur_sure: tour.tur_sure,
      ulasim: tour.ulasim,
      konaklama: tour.konaklama,
      dates: tour.dates || [],
      // Keep raw tour object for later re-localization if language changes
      _raw: tour
    });

    // 🔎 Check for explicit language change intent FIRST
    const languageChangeIntent = detectLanguageChangeIntent(message);
    
    // 🔎 Then detect language from message content
    const runtimeDetectedLang = await detectLanguage(message);
    console.log("🌐 Detected language (runtime):", runtimeDetectedLang);
    console.log("🔄 Language change intent:", languageChangeIntent);

    // Load or initialize context
    let context: ConversationContext;

    if (clientState && isValidContext(clientState)) {
      console.log("✅ Using client state");
      context = clientState;

      // Priority 1: Explicit language change request
      if (languageChangeIntent && languageChangeIntent !== context.language) {
        console.log(`🔄 EXPLICIT language change: ${context.language} → ${languageChangeIntent}`);
        context.language = languageChangeIntent;
        (context as any).detectedLanguage = languageChangeIntent;
        // Also update tone to language-appropriate default
        context.tone = getDefaultToneForLanguage(languageChangeIntent) as any;
        console.log(`🎯 Tone updated to: ${context.tone}`);
      }
      // Priority 2: Automatic detection (only if different and no explicit change)
      else if (runtimeDetectedLang && runtimeDetectedLang !== context.language && !languageChangeIntent) {
        console.log(`🌍 AUTO language update: ${context.language} → ${runtimeDetectedLang}`);
        context.language = runtimeDetectedLang;
        (context as any).detectedLanguage = runtimeDetectedLang;
      }
    } else {
      console.log("🆕 Initializing fresh context");
      const initialLang = runtimeDetectedLang || "tr";
      // Use conversationStyle from frontend if provided, otherwise use language default
      const tone = conversationStyle || getDefaultToneForLanguage(initialLang);

      context = createInitialContext(initialLang, tone as any);
      (context as any).detectedLanguage = runtimeDetectedLang || undefined;

      console.log(`🌍 Language: ${initialLang}, Tone: ${tone} (from: ${conversationStyle ? 'frontend' : 'auto'})`);
    }
    
    // Update tone from conversationStyle if provided in existing context
    if (conversationStyle && clientState && isValidContext(clientState)) {
      if (context.tone !== conversationStyle) {
        console.log(`🎨 Updating tone from frontend: ${context.tone} → ${conversationStyle}`);
        context.tone = conversationStyle as any;
      }
    }

    // 🌐 Create localized tours based on current context language
    const availableTours = (dbTours || []).map((tour: any) => 
      createLocalizedTour(tour, context.language)
    );

    console.log(`📦 Using ${availableTours.length} tours (localized to: ${context.language})`);
    

    console.log("📨 Message:", { message, stage: context.stage, lang: context.language, tone: context.tone });

    // === NEW: Use AI-based NLU for understanding ===
    const nluResult = await analyzeUserMessage(
      message,
      `Current stage: ${context.stage}. ${context.currentTour ? `Selected tour: ${context.currentTour.title}` : ""}`,
      context.stage,
      context.currentTour,
      DEMO_TOURS,
    );

    console.log("🧠 NLU Intent:", nluResult.intent);
    console.log("🧠 NLU Entities:", JSON.stringify(nluResult.entities));

    // Map NLU intent to FSM intent
    const detectedIntent = mapNLUIntentToFSMIntent(nluResult.intent);
    console.log("🎯 FSM Intent:", detectedIntent);

    const expectedInput = getNextExpectedInput(context);
    console.log("⏭️ Expected:", expectedInput);

    // CRITICAL: Always try to match tour using multiple strategies
    // Strategy 1: NLU entities (tour_name, destination)
    // Strategy 2: Direct matching (numbers, keywords) via matchTour
    let selectedTour = null;
    const tourRelatedIntents = ['browse_tours', 'tour_search', 'select_tour', 'hotel_details', 'transport_details'];
    const shouldMatchTour = tourRelatedIntents.includes(nluResult.intent);

    if (shouldMatchTour) {
      // Match by tour name from NLU
      if (nluResult.entities.tour_name) {
        const foundTour = availableTours.find((t) =>
          t.title.toLowerCase().includes(nluResult.entities.tour_name!.toLowerCase()),
        );
        if (foundTour) {
          selectedTour = {
            id: foundTour.id,
            title: foundTour.title,
            destination: foundTour.destination,
            dates: foundTour.dates,
            program_kisa: foundTour.program_kisa,
            gezilecek_yerler: foundTour.gezilecek_yerler,
          };
          console.log("🎫 Tour matched by NLU name:", selectedTour.title);
        }
      } else if (nluResult.entities.destination) {
        // Match by destination from NLU
        const foundTour = availableTours.find((t) =>
          t.destination.toLowerCase().includes(nluResult.entities.destination!.toLowerCase()),
        );
        if (foundTour) {
          selectedTour = {
            id: foundTour.id,
            title: foundTour.title,
            destination: foundTour.destination,
            dates: foundTour.dates,
            program_kisa: foundTour.program_kisa,
            gezilecek_yerler: foundTour.gezilecek_yerler,
          };
          console.log("🎫 Tour matched by NLU destination:", selectedTour.title);
        }
      }
    }
    
    // FALLBACK: If NLU didn't find a tour, try direct matching (numbers, keywords)
    // This catches cases like "1", "2", "Kapadokya" that NLU might miss
    if (!selectedTour) {
      const matchedTour = matchTour(message, availableTours, expectedInput);
      if (matchedTour) {
        const fullTour = findTourById(matchedTour.id, availableTours);
        if (fullTour) {
          selectedTour = {
            id: fullTour.id,
            title: fullTour.title,
            destination: fullTour.destination,
            dates: fullTour.dates,
            program_kisa: fullTour.program_kisa,
            gezilecek_yerler: fullTour.gezilecek_yerler,
          };
          console.log("🎯 Tour matched by direct matching:", selectedTour.title);
        }
      } else {
        console.log("❌ No tour match found via NLU or direct matching");
      }
    }

    // Extract reservation info from NLU updates (already processed by NLU)
    const extractedInfo: any = { ...nluResult.updates };

    // Handle dates if provided
    if (nluResult.entities.dates && nluResult.entities.dates.length > 0) {
      extractedInfo.selectedDate = nluResult.entities.dates[0];
      console.log("📅 Date from NLU:", nluResult.entities.dates[0]);
    }

    // Simple fallback for name and phone (NLU sometimes misses these)
    const simpleExtraction = extractNameAndPhone(message);
    if (simpleExtraction.fullName && !extractedInfo.fullName) {
      extractedInfo.fullName = simpleExtraction.fullName;
      console.log("👤 Name from regex:", simpleExtraction.fullName);
    }
    if (simpleExtraction.phone && !extractedInfo.phone) {
      extractedInfo.phone = simpleExtraction.phone;
      console.log("📞 Phone from regex:", simpleExtraction.phone);
    }

    // Resolve date if selected by number
    if (extractedInfo.selectedDate?.startsWith("date_") && context.currentTour) {
      const tour = findTourById(context.currentTour.id, availableTours);
      if (tour?.dates) {
        const dateIndex = parseInt(extractedInfo.selectedDate.split("_")[1]);
        if (dateIndex >= 0 && dateIndex < tour.dates.length) {
          const selectedDate = tour.dates[dateIndex];
          extractedInfo.selectedDate = selectedDate.departure_date;
          extractedInfo.dateId = selectedDate.id;
          console.log("📅 Resolved date:", selectedDate.departure_date);
        }
      }
    }

    // Auto-select date if there's only one and user is confirming/providing info
    if (
      !extractedInfo.dateId &&
      !extractedInfo.selectedDate &&
      context.currentTour?.dates?.length === 1 &&
      (detectedIntent === "provide_info" || detectedIntent === "confirm" || detectedIntent === "reservation_intent")
    ) {
      const singleDate = context.currentTour.dates[0];
      extractedInfo.selectedDate = singleDate.departure_date;
      extractedInfo.dateId = singleDate.id;
      console.log("📅 Auto-selected single available date:", singleDate.departure_date);
    }

    console.log("📝 Extracted info:", extractedInfo);

    // Process FSM transition
    const input: ProcessingInput = {
      userMessage: message,
      detectedIntent,
      extractedInfo,
      selectedTour,
      language: context.language,
    };

    const newContext = processTransition(context, input);
    console.log(`🔄 Transition: ${context.stage} → ${newContext.stage}`);

    // Get agency data from database
    const { data: agencyData, error: agencyError } = await supabase
      .from("agencies")
      .select("name, city, payment_instructions, primary_currency, language_currencies, address, phone_public, website_url, working_hours, maps_url, cancellation_policy")
      .eq("id", "00000000-0000-0000-0000-000000000000")
      .single();

    if (agencyError) {
      console.error("⚠️ Agency data error:", agencyError.message);
    }

    const agencyName = agencyData?.name ?? "Demo Travel Agency";
    const agencyCity = agencyData?.city ?? undefined;
    const agencyAddress = agencyData?.address ?? undefined;
    const agencyPhone = agencyData?.phone_public ?? undefined;
    const agencyWebsite = agencyData?.website_url ?? undefined;
    const agencyWorkingHours = agencyData?.working_hours ?? undefined;
    const agencyMapsUrl = agencyData?.maps_url ?? undefined;
    const agencyCancellationPolicy = agencyData?.cancellation_policy ?? undefined;
    const paymentInstructions = agencyData?.payment_instructions ?? null;
    const languageCurrencies = agencyData?.language_currencies ?? null;
    const primaryCurrency = agencyData?.primary_currency ?? 'TRY';

    // paymentInfo: prompt-builder içinde (özellikle EN tarafında) gösterilmek istenen düz metin
    let paymentInfo: string | undefined = undefined;
    if (typeof paymentInstructions === "string") {
      paymentInfo = paymentInstructions;
    } else if (
      paymentInstructions &&
      typeof paymentInstructions === "object" &&
      typeof (paymentInstructions as any).text === "string"
    ) {
      paymentInfo = (paymentInstructions as any).text;
    }

    // Build system prompt
    const currentTourData = newContext.currentTour ? findTourById(newContext.currentTour.id, availableTours) : null;
    
    // CRITICAL: Prevent accidental tour switching during reservation
    let tourSwitchWarning = '';
    
    // If user is in COLLECTING_INFO and mentions different tour
    if (newContext.stage === 'COLLECTING_INFO' && selectedTour && newContext.currentTour && selectedTour.id !== newContext.currentTour.id) {
      tourSwitchWarning = newContext.language === 'tr' 
        ? `\n\n🚨 KRİTİK UYARI: Kullanıcı şu anda "${newContext.currentTour.title}" için rezervasyon YAPIYOR (tarih: ${newContext.reservationInfo.selectedDate || 'belirtilmedi'}, kişi: ${newContext.reservationInfo.paxAdult || 'belirtilmedi'}).
        
Ama kullanıcı "${selectedTour.title}" hakkında bir şey söyledi.

MUTLAKA ŞUNU SOR:
"Şu anda ${newContext.currentTour.title} için rezervasyon yapıyoruz. ${selectedTour.title} turuna geçmek ister misiniz? 
Geçerseniz mevcut rezervasyon bilgileriniz (${newContext.reservationInfo.selectedDate ? 'tarih: ' + newContext.reservationInfo.selectedDate : 'girdiğiniz bilgiler'}) silinecek.

Cevabınız: 
- Evet, ${selectedTour.title} turuna geç → Ben tur değiştirme yapacağım
- Hayır, ${newContext.currentTour.title} ile devam → Mevcut rezervasyona devam"

ASLA tur değişikliği yapma, sadece kullanıcıdan onay iste!`
        : `\n\n🚨 CRITICAL WARNING: User is currently making a reservation for "${newContext.currentTour.title}" (date: ${newContext.reservationInfo.selectedDate || 'not specified'}, pax: ${newContext.reservationInfo.paxAdult || 'not specified'}).

But user mentioned "${selectedTour.title}".

YOU MUST ASK:
"You're currently making a reservation for ${newContext.currentTour.title}. Would you like to switch to ${selectedTour.title}? 
If you switch, your current reservation info (${newContext.reservationInfo.selectedDate ? 'date: ' + newContext.reservationInfo.selectedDate : 'entered details'}) will be deleted.

Your answer:
- Yes, switch to ${selectedTour.title} → I'll switch the tour
- No, continue with ${newContext.currentTour.title} → Continue current reservation"

NEVER switch tours automatically, only ask for confirmation!`;
    }
    
    // If user is in TOUR_SELECTED but has info already, also warn
    else if (newContext.stage === 'TOUR_SELECTED' && selectedTour && newContext.currentTour && 
             selectedTour.id !== newContext.currentTour.id && 
             Object.keys(newContext.reservationInfo).length > 2) {
      tourSwitchWarning = newContext.language === 'tr'
        ? `\n\n⚠️ DİKKAT: Kullanıcı "${newContext.currentTour.title}" seçmişti, şimdi "${selectedTour.title}" sordu. Netleştir: "Hangi tur için devam etmek istersiniz?"`
        : `\n\n⚠️ ATTENTION: User had selected "${newContext.currentTour.title}", now asked about "${selectedTour.title}". Clarify: "Which tour would you like to continue with?"`;
    }

    const systemPrompt = buildSystemPrompt({
      stage: newContext.stage,
      collectionStep: newContext.collectionStep,
      currentTour: currentTourData,
      reservationInfo: newContext.reservationInfo,
      availableTours,
      language: newContext.language,
      tone: newContext.tone,
      agencyName,
      agencyCity,
      agencyAddress,
      agencyPhone,
      agencyWebsite,
      agencyWorkingHours,
      agencyMapsUrl,
      agencyCancellationPolicy,
      paymentInfo,
    }) + tourSwitchWarning;

    // Get conversation history
    const { data: history } = await supabase
      .from("whatsapp_conversations")
      .select("role, content, created_at")
      .eq("phone", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const conversationHistory = (history || []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    // Call AI
    const messagesForAI = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    console.log("🤖 Calling AI...");
    const aiResponse = await callAI(messagesForAI, 0.7);

    // If reservation is completed and payment info not sent yet, add payment details
    let finalResponse = aiResponse;

    if (newContext.stage === "COMPLETED" && !newContext.paymentInfoSent && paymentInstructions) {
      const { generatePaymentMessage } = await import("./services/payment.ts");

      // Calculate prices
      const priceAdult =
        newContext.currentTour?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId)?.price_adult || 0;

      const paxAdult = newContext.reservationInfo.paxAdult || 1;
      const totalPrice = priceAdult * paxAdult;

      const depositPercentage =
        typeof paymentInstructions === "object" &&
        paymentInstructions !== null &&
        typeof (paymentInstructions as any).deposit_percentage === "number"
          ? (paymentInstructions as any).deposit_percentage
          : 30;

      const depositAmount = Math.round((totalPrice * depositPercentage) / 100);

      // Get tour currency from current tour data
      const tourCurrency = currentTourData?.currency || 'TRY';

      const paymentMessage = await generatePaymentMessage(
        paymentInstructions,
        newContext.language,
        totalPrice,
        depositAmount,
        tourCurrency,
        {
          languageCurrencies: languageCurrencies,
          primaryCurrency: primaryCurrency
        }
      );

      if (paymentMessage) {
        finalResponse = aiResponse + paymentMessage;
        newContext.paymentInfoSent = true;
      }
    }

    // === Save reservation to database if completed ===
    if (newContext.stage === "COMPLETED" && newContext.reservationInfo) {
      const { fullName, phone, dateId, paxAdult } = newContext.reservationInfo;
      const tour = newContext.currentTour;

      if (tour && dateId && fullName && phone && paxAdult) {
        console.log("💾 Saving reservation to database...");

        const { error: regError } = await supabase.from("registrations").insert({
          agency_id: DEMO_AGENCY_ID,
          tour_id: tour.id,
          tour_date_id: dateId,
          full_name: fullName,
          phone: phone,
          pax: paxAdult,
          status: "NEW",
          note: "Demo chat reservation",
        });

        if (regError) {
          console.error("❌ Error saving reservation:", regError);
        } else {
          console.log("✅ Reservation saved successfully");
        }
      }
    }

    // === Save complaint to database if detected ===
    if (nluResult.intent === "complaint_feedback") {
      console.log("📝 Saving complaint to database...");

      const { error: complaintError } = await supabase.from("complaints").insert({
        agency_id: DEMO_AGENCY_ID,
        phone: sessionId,
        message: message,
        type: "complaint",
        status: "new",
      });

      if (complaintError) {
        console.error("❌ Error saving complaint:", complaintError);
      } else {
        console.log("✅ Complaint saved successfully");
      }
    }

    // Save messages
    await supabase.from("whatsapp_conversations").insert([
      {
        phone: sessionId,
        role: "user",
        content: message,
        agency_id: DEMO_AGENCY_ID,
      },
      {
        phone: sessionId,
        role: "assistant",
        content: finalResponse,
        agency_id: DEMO_AGENCY_ID,
      },
    ]);

    return new Response(
      JSON.stringify({
        response: finalResponse,
        conversationState: newContext,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function isValidContext(ctx: any): ctx is ConversationContext {
  return (
    ctx &&
    typeof ctx === "object" &&
    typeof ctx.stage === "string" &&
    typeof ctx.language === "string" &&
    typeof ctx.tone === "string" &&
    typeof ctx.messageCount === "number"
  );
}
