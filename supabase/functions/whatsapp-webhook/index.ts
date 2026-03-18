// WhatsApp webhook - Clean FSM with shared core (Meta Cloud API)
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
import { matchTour, findTourById } from "../shared/fsm/tour-matcher.ts";
import type { ConversationContext, ProcessingInput, ConversationTone } from "../shared/fsm/types.ts";

// Meta Cloud API utilities
import { extractMetaWebhookData, sendWhatsAppMessage, resolveAgencyByPhoneNumberId, getMetaCredentials } from "../_shared/metaWhatsapp.ts";
import { truncateForWhatsApp } from "./utils/format.ts";

// WhatsApp services
import { generatePaymentMessage } from "./services/payment-message.ts";
import { upsertUserProfile, enrichConversationInsights } from "./services/profile.ts";

// Legacy services (backward compatibility)
import { checkFAQ } from "./services/faq.ts";
import { detectCannedResponseTrigger, getCannedResponse } from "./services/canned-responses.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Meta webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ Webhook verified");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();

    // Initialize Supabase client
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // === Test Mode: Send a direct message via Meta API ===
    if (body?.testMode === true) {
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
      
      if (!phoneNumberId || !accessToken) {
        return new Response(JSON.stringify({ error: "Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const testPhone = body.testPhone?.replace('+', '').trim();
      const testMessage = body.testMessage || "🧪 Test mesajı";

      console.log(`📤 Test mode: Sending message to ${testPhone}`);
      
      const result = await sendWhatsAppMessage(phoneNumberId, accessToken, testPhone, testMessage);
      
      return new Response(JSON.stringify({ success: result.success, ...result }), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message from Meta Cloud API webhook format
    const webhookData = extractMetaWebhookData(body);

    if (!webhookData) {
      return new Response(JSON.stringify({ error: "Invalid webhook data" }), {
        status: 200, // Always return 200 to Meta
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Status updates - just acknowledge
    if (webhookData.isStatus) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPhone = webhookData.from;
    const rawMessage = webhookData.message;

    if (!userPhone || !rawMessage) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve agency from webhook metadata
    console.log(`🔍 Webhook phoneNumberId: "${webhookData.phoneNumberId}", from: "${userPhone}"`);
    const { agency, error: agencyError } = await resolveAgencyByPhoneNumberId(supabase, webhookData.phoneNumberId);

    if (agencyError || !agency) {
      console.error(`🚫 Agency not found: ${agencyError}`);
      return new Response(JSON.stringify({ error: "Agency not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Meta WhatsApp credentials
    const metaCredentials = getMetaCredentials(agency);
    if (!metaCredentials.accessToken || !metaCredentials.phoneNumberId) {
      console.error(`❌ Agency ${agency.name} has no Meta WhatsApp credentials configured`);
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = sanitizeInput(rawMessage);
    console.log("📱 WhatsApp FSM:", userPhone.slice(-4));
    console.log(`🏢 Agency: ${agency.name}`);

    // 🔐 Payment fields from agency
    const paymentInstructions = agency.payment_instructions ?? null;
    const languageCurrencies = agency.language_currencies ?? null;
    const primaryCurrency = agency.primary_currency ?? "TRY";

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

    // Get plan features
    const { data: planFeatures } = await supabase
      .from("plan_features")
      .select("*")
      .eq("plan_type", agency.plan_type)
      .single();

    console.log("📊 Plan:", agency.plan_type, "Features:", {
      user_profiles: planFeatures?.has_user_profiles,
      reminders: planFeatures?.has_reminders,
      follow_ups: planFeatures?.has_follow_ups,
      templates: planFeatures?.has_templates,
      feedback: planFeatures?.has_feedback,
      analytics: planFeatures?.has_analytics,
    });

    // Save incoming message
    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone,
      role: "user",
      content: message,
      agency_id: agency.id,
    });

    // Upsert user profile (only if user profiles feature is enabled)
    if (planFeatures?.has_user_profiles) {
      await upsertUserProfile(supabase, userPhone, agency.id, message, agency?.enabled_languages || ["tr"]);
      console.log("✅ User profile updated");
    } else {
      console.log("⏭️ User profiles disabled for plan:", agency.plan_type);
    }

    // Load tours
    const { data: dbTours } = await supabase
      .from("tours")
      .select(
        `
        *,
        dates:tour_dates(
          id,
          departure_date,
          return_date,
          price_adult,
          price_child,
          quota
        )
      `,
      )
      .eq("agency_id", agency.id);

    const toursRaw = dbTours || [];
    console.log(`📦 Tours: ${toursRaw.length}`);

    // === FSM-based conversation ===

    // Load context (sessionId = phone)
    const { data: existingState } = await supabase
      .from("whatsapp_conversations")
      .select("content")
      .eq("phone", userPhone)
      .eq("agency_id", agency.id)
      .eq("role", "system")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let context: ConversationContext;

    // Detect language change intent and runtime language
    const languageChangeIntent = detectLanguageChangeIntent(message);
    const runtimeDetectedLang = await detectLanguage(message);

    if (existingState?.content) {
      try {
        const parsed = JSON.parse(existingState.content);
        if (isValidContext(parsed)) {
          context = parsed;

          if (languageChangeIntent && languageChangeIntent !== context.language) {
            console.log(`🌐 Language change: ${context.language} → ${languageChangeIntent}`);
            context.language = languageChangeIntent;
            context.tone = getDefaultToneForLanguage(languageChangeIntent) as ConversationTone;
          } else if (runtimeDetectedLang && runtimeDetectedLang !== context.language) {
            console.log(`🌐 Language detected: ${context.language} → ${runtimeDetectedLang}`);
            context.language = runtimeDetectedLang;
          }

          console.log(`✅ Loaded context - Stage: ${context.stage}, Lang: ${context.language}`);
        } else {
          throw new Error("Invalid context");
        }
      } catch (_e) {
        console.log("⚠️ Creating fresh context");
        const initialLang = languageChangeIntent || runtimeDetectedLang || "tr";
        const tone = getDefaultToneForLanguage(initialLang) as ConversationTone;
        context = createInitialContext(initialLang, tone);
      }
    } else {
      console.log("🆕 Fresh context");
      const initialLang = languageChangeIntent || runtimeDetectedLang || "tr";
      const tone = getDefaultToneForLanguage(initialLang) as ConversationTone;
      context = createInitialContext(initialLang, tone);
    }

    // Check if detected language is enabled for this agency
    const enabledLanguages = (agency as any).enabled_languages || ["tr"];
    if (!enabledLanguages.includes(context.language)) {
      console.log(
        `⚠️ Language ${context.language} not enabled for agency. Falling back to first enabled: ${enabledLanguages[0]}`,
      );
      context.language = enabledLanguages[0];
      context.tone = getDefaultToneForLanguage(context.language) as ConversationTone;
    }

    // Localized tours - filter out past dates
    const today = new Date().toISOString().split('T')[0];
    const tours = toursRaw
      .map((tour: any) => ({
        id: tour.id,
        title: pickLocalized(tour, "title", context.language),
        destination: pickLocalized(tour, "destination", context.language),
        type: tour.type,
        currency: tour.currency,
        program_kisa: pickLocalized(tour, "program_kisa", context.language),
        gezilecek_yerler: tour.gezilecek_yerler,
        dates: (tour.dates || []).filter((d: any) => d.departure_date >= today),
      }))
      .filter((tour: any) => tour.dates.length > 0);

    // === Legacy features (canned responses, FAQ) - with dynamic language ===
    const currentLang = context.language || "tr";

    if (planFeatures?.has_templates) {
      const cannedTrigger = detectCannedResponseTrigger(message, currentLang);
      if (cannedTrigger) {
        const response = getCannedResponse(cannedTrigger, currentLang);
        if (response) {
          await supabase.from("whatsapp_conversations").insert({
            phone: userPhone,
            role: "assistant",
            content: response,
            agency_id: agency.id,
          });
          // Send via Meta Cloud API
          await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(response));
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const faqResponse = await checkFAQ(supabase, message, agency.id, currentLang);
      if (faqResponse) {
        await supabase.from("whatsapp_conversations").insert({
          phone: userPhone,
          role: "assistant",
          content: faqResponse,
          agency_id: agency.id,
        });
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(faqResponse));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get conversation history
    const { data: recentMessages } = await supabase
      .from("whatsapp_conversations")
      .select("role, content")
      .eq("phone", userPhone)
      .eq("agency_id", agency.id)
      .neq("role", "system")
      .order("created_at", { ascending: false })
      .limit(10);

    const conversationSummary = (recentMessages || [])
      .reverse()
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    // === Build rich context for NLU ===
    let nluContext = conversationSummary;
    nluContext += `\n\nCurrent stage: ${context.stage}.`;
    if (context.collectionStep) {
      nluContext += ` Collection step: ${context.collectionStep}.`;
    }
    if (context.currentTour) {
      nluContext += ` Selected tour: ${context.currentTour.title}.`;
    }
    if (context.reservationInfo) {
      const info = context.reservationInfo;
      const collected = [];
      if (info.selectedDate) collected.push(`date: ${info.selectedDate}`);
      if (info.paxAdult) collected.push(`pax: ${info.paxAdult}`);
      if (info.fullName) collected.push(`name: ${info.fullName}`);
      if (info.phone) collected.push(`phone: ${info.phone}`);
      if (collected.length > 0) {
        nluContext += ` Reservation info collected: ${collected.join(', ')}.`;
      }
    }
    if (context.collectionStep === 'ready_for_confirmation' || 
        (context.reservationInfo?.fullName && context.reservationInfo?.phone && 
         context.reservationInfo?.paxAdult && context.reservationInfo?.dateId)) {
      nluContext += ` STATUS: READY FOR CONFIRMATION - waiting for user to confirm booking.`;
    }

    console.log("📋 NLU Context (stage):", context.stage, context.collectionStep);

    // Analyze with NLU
    const nluResult = await analyzeUserMessage(message, nluContext, context.stage, context.currentTour, tours);
    console.log("🧠 Intent:", nluResult.intent);

    const fsmIntent = mapNLUIntentToFSMIntent(nluResult.intent);

    // === Save complaint to database if detected ===
    if (nluResult.intent === "complaint_feedback") {
      console.log("📝 Saving complaint to database...");
      const { error: complaintError } = await supabase.from("complaints").insert({
        agency_id: agency.id,
        phone: userPhone,
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

    // Match tours - CRITICAL: Two-layer strategy
    let selectedTour: any = null;
    let multipleTourMatches: any[] = [];

    if (nluResult.entities.tour_name) {
      const matchingTours = tours.filter((t) => t.title.toLowerCase().includes(nluResult.entities.tour_name!.toLowerCase()));
      
      if (matchingTours.length === 1) {
        const found = matchingTours[0];
        selectedTour = {
          id: found.id, title: found.title, destination: found.destination,
          dates: found.dates, program_kisa: found.program_kisa, gezilecek_yerler: found.gezilecek_yerler,
        };
        console.log("🎫 Tour matched by NLU name (single):", selectedTour.title);
      } else if (matchingTours.length > 1) {
        multipleTourMatches = matchingTours;
        console.log("🎫 Multiple tours matched by NLU name:", matchingTours.map(t => t.title).join(", "));
      }
    } 
    
    if (!selectedTour && !multipleTourMatches.length && nluResult.entities.destination) {
      const matchingTours = tours.filter((t) =>
        t.destination.toLowerCase().includes(nluResult.entities.destination!.toLowerCase()) ||
        t.title.toLowerCase().includes(nluResult.entities.destination!.toLowerCase()),
      );
      
      if (matchingTours.length === 1) {
        const found = matchingTours[0];
        selectedTour = {
          id: found.id, title: found.title, destination: found.destination,
          dates: found.dates, program_kisa: found.program_kisa, gezilecek_yerler: found.gezilecek_yerler,
        };
        console.log("🎫 Tour matched by NLU destination (single):", selectedTour.title);
      } else if (matchingTours.length > 1) {
        multipleTourMatches = matchingTours;
        console.log("🎫 Multiple tours matched by destination:", matchingTours.map(t => t.title).join(", "));
      }
    }

    // FALLBACK: direct matching
    if (!selectedTour && multipleTourMatches.length === 0) {
      const expectedInput = getNextExpectedInput(context);
      const matchedTour = matchTour(message, tours, expectedInput);
      if (matchedTour) {
        const lowerMessage = message.toLowerCase().trim();
        const allMatches = tours.filter(tour => 
          tour.title.toLowerCase().includes(lowerMessage) ||
          tour.destination.toLowerCase().includes(lowerMessage)
        );
        
        if (allMatches.length > 1) {
          multipleTourMatches = allMatches;
          console.log("🎫 Fallback found multiple matches:", allMatches.map(t => t.title).join(", "));
        } else {
          const fullTour = findTourById(matchedTour.id, tours);
          if (fullTour) {
            selectedTour = {
              id: fullTour.id, title: fullTour.title, destination: fullTour.destination,
              dates: fullTour.dates, program_kisa: fullTour.program_kisa, gezilecek_yerler: fullTour.gezilecek_yerler,
            };
            console.log("🎯 Tour matched by direct matching:", selectedTour.title);
          }
        }
      } else {
        console.log("❌ No tour match found via NLU or direct matching");
      }
    } else if (multipleTourMatches.length > 0) {
      console.log("⏭️ Skipping fallback - multiple tour matches found");
    }

    // Extract info
    const extractedInfo: any = { ...nluResult.updates };
    if (nluResult.entities.dates && nluResult.entities.dates.length > 0) {
      extractedInfo.selectedDate = nluResult.entities.dates[0];
      console.log("📅 Date from NLU:", nluResult.entities.dates[0]);
    }

    const simpleExtraction = extractNameAndPhone(message);
    if (simpleExtraction.fullName && !extractedInfo.fullName) {
      extractedInfo.fullName = simpleExtraction.fullName;
    }
    if (simpleExtraction.phone && !extractedInfo.phone) {
      extractedInfo.phone = simpleExtraction.phone;
    }
    if (simpleExtraction.paxAdult && !extractedInfo.paxAdult) {
      extractedInfo.paxAdult = simpleExtraction.paxAdult;
    }
    if (simpleExtraction.selectedDate && !extractedInfo.selectedDate) {
      extractedInfo.selectedDate = simpleExtraction.selectedDate;
    }

    const expectedInput = getNextExpectedInput(context);

    // Handle plain number input when expecting pax
    if (!extractedInfo.paxAdult && expectedInput === 'pax') {
      const plainNumber = parseInt(message.trim());
      if (!isNaN(plainNumber) && plainNumber >= 1 && plainNumber <= 50) {
        extractedInfo.paxAdult = plainNumber;
      }
    }

    // Resolve date_X format
    if (extractedInfo.selectedDate?.startsWith("date_") && context.currentTour) {
      const tour = findTourById(context.currentTour.id, tours);
      if (tour?.dates) {
        const dateIndex = parseInt(extractedInfo.selectedDate.split("_")[1]);
        if (dateIndex >= 0 && dateIndex < tour.dates.length) {
          const selectedDate = tour.dates[dateIndex];
          extractedInfo.selectedDate = selectedDate.departure_date;
          extractedInfo.dateId = selectedDate.id;
        }
      }
    }

    // Handle numeric date selection
    if (!extractedInfo.dateId && context.currentTour && 
        (expectedInput === 'date' || expectedInput === 'date_selection')) {
      const dateNumber = parseInt(message.trim());
      if (!isNaN(dateNumber) && dateNumber >= 1) {
        const tour = findTourById(context.currentTour.id, tours);
        if (tour?.dates && dateNumber <= tour.dates.length) {
          const selectedDate = tour.dates[dateNumber - 1];
          extractedInfo.selectedDate = selectedDate.departure_date;
          extractedInfo.dateId = selectedDate.id;
        }
      }
    }

    // Match ISO date with available tour dates
    if (extractedInfo.selectedDate && !extractedInfo.dateId && context.currentTour) {
      const tour = findTourById(context.currentTour.id, tours);
      if (tour?.dates && tour.dates.length > 0) {
        const matchedDate = tour.dates.find((d: any) => {
          if (d.departure_date === extractedInfo.selectedDate) return true;
          try {
            const targetDate = new Date(extractedInfo.selectedDate);
            const tourDate = new Date(d.departure_date);
            return targetDate.getDate() === tourDate.getDate() && 
                   targetDate.getMonth() === tourDate.getMonth();
          } catch {
            return false;
          }
        });
        
        if (matchedDate) {
          extractedInfo.selectedDate = matchedDate.departure_date;
          extractedInfo.dateId = matchedDate.id;
        }
      }
    }

    // Auto-select date if only one available
    if (!extractedInfo.dateId && !extractedInfo.selectedDate && 
        context.currentTour?.dates?.length === 1 &&
        (fsmIntent === "provide_info" || fsmIntent === "confirm" || fsmIntent === "reservation_intent")) {
      const singleDate = context.currentTour.dates[0];
      extractedInfo.selectedDate = singleDate.departure_date;
      extractedInfo.dateId = singleDate.id;
    }

    console.log("📝 Extracted info:", extractedInfo);

    // Process transition
    const input: ProcessingInput = {
      userMessage: message,
      detectedIntent: fsmIntent,
      extractedInfo,
      selectedTour,
      language: context.language,
    };

    const newContext = processTransition(context, input);
    console.log(`🔄 ${context.stage} → ${newContext.stage}`);

    const detectedIntent = fsmIntent;

    // Build prompt
    const currentTourFull = newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null;

    const promptContext = {
      stage: newContext.stage,
      collectionStep: newContext.collectionStep,
      currentTour: currentTourFull || newContext.currentTour,
      reservationInfo: newContext.reservationInfo,
      availableTours: tours,
      language: newContext.language,
      tone: newContext.tone,
      agencyName: agency.name,
      agencyCity: agency.city,
      agencyAddress: agency.address,
      agencyPhone: agency.phone_public,
      agencyWebsite: agency.website_url,
      agencyWorkingHours: agency.working_hours,
      agencyMapsUrl: agency.maps_url,
      agencyCancellationPolicy: agency.cancellation_policy,
      paymentInfo: paymentInfo,
      multipleTourMatches: multipleTourMatches.length > 1 ? multipleTourMatches : undefined,
    };

    // Tour switch warning
    let tourSwitchWarning = "";

    if (
      newContext.stage === "COLLECTING_INFO" &&
      selectedTour &&
      newContext.currentTour &&
      selectedTour.id !== newContext.currentTour.id
    ) {
      tourSwitchWarning =
        newContext.language === "tr"
          ? `\n\n🚨 KRİTİK UYARI: Kullanıcı şu anda "${newContext.currentTour.title}" için rezervasyon YAPIYOR (tarih: ${
              newContext.reservationInfo.selectedDate || "belirtilmedi"
            }, kişi: ${newContext.reservationInfo.paxAdult || "belirtilmedi"}).
        
Ama kullanıcı "${selectedTour.title}" hakkında bir şey söyledi.

MUTLAKA ŞUNU SOR:
"Şu anda ${newContext.currentTour.title} için rezervasyon yapıyoruz. ${selectedTour.title} turuna geçmek ister misiniz? 
Geçerseniz mevcut rezervasyon bilgileriniz (${
              newContext.reservationInfo.selectedDate
                ? "tarih: " + newContext.reservationInfo.selectedDate
                : "girdiğiniz bilgiler"
            }) silinecek.

Cevabınız: 
- Evet, ${selectedTour.title} turuna geç → Ben tur değiştirme yapacağım
- Hayır, ${newContext.currentTour.title} ile devam → Mevcut rezervasyona devam"

ASLA tur değişikliği yapma, sadece kullanıcıdan onay iste!`
          : `\n\n🚨 CRITICAL WARNING: User is currently making a reservation for "${
              newContext.currentTour.title
            }" (date: ${newContext.reservationInfo.selectedDate || "not specified"}, pax: ${
              newContext.reservationInfo.paxAdult || "not specified"
            }).

But user mentioned "${selectedTour.title}".

YOU MUST ASK:
"You're currently making a reservation for ${newContext.currentTour.title}. Would you like to switch to ${selectedTour.title}? 
If you switch, your current reservation info (${
              newContext.reservationInfo.selectedDate
                ? "date: " + newContext.reservationInfo.selectedDate
                : "entered details"
            }) will be deleted.

Your answer:
- Yes, switch to ${selectedTour.title} → I'll switch the tour
- No, continue with ${newContext.currentTour.title} → Continue current reservation"

NEVER switch tours automatically, only ask for confirmation!`;
    } else if (
      newContext.stage === "TOUR_SELECTED" &&
      selectedTour &&
      newContext.currentTour &&
      selectedTour.id !== newContext.currentTour.id &&
      Object.keys(newContext.reservationInfo).length > 2
    ) {
      tourSwitchWarning =
        newContext.language === "tr"
          ? `\n\n⚠️ DİKKAT: Kullanıcı "${newContext.currentTour.title}" seçmişti, şimdi "${selectedTour.title}" sordu. Netleştir: "Hangi tur için devam etmek istersiniz?"`
          : `\n\n⚠️ ATTENTION: User had selected "${newContext.currentTour.title}", now asked about "${selectedTour.title}". Clarify: "Which tour would you like to continue with?"`;
    }

    const systemPrompt = buildSystemPrompt(promptContext) + tourSwitchWarning;

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let reply: string = aiData.choices[0].message.content;
    console.log("🤖 Reply:", reply.substring(0, 80));

    // === APPEND PAYMENT MESSAGE IF COMPLETED ===
    let finalReply = reply;

    if (
      newContext.stage === "COMPLETED" &&
      newContext.reservationConfirmed &&
      !newContext.paymentInfoSent &&
      paymentInstructions
    ) {
      console.log("💳 Appending payment info...");

      const depositPercentage =
        (paymentInstructions &&
          typeof paymentInstructions === "object" &&
          (paymentInstructions as any).deposit_percentage) ||
        30;

      const tourForReservation = toursRaw.find((t: any) => t.id === newContext.reservationInfo.tourId);
      const selectedTourDate = tourForReservation?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId);

      if (selectedTourDate) {
        const paxAdult = newContext.reservationInfo.paxAdult || 0;
        const paxChild = newContext.reservationInfo.paxChild || 0;
        const priceAdult = selectedTourDate.price_adult || 0;
        const priceChild = selectedTourDate.price_child || priceAdult;

        const totalPrice = paxAdult * priceAdult + paxChild * priceChild;
        const depositAmount = Math.ceil((totalPrice * depositPercentage) / 100);

        const tourCurrency = tourForReservation?.currency || "TRY";

        const paymentMessage = await generatePaymentMessage(
          paymentInstructions,
          newContext.language,
          totalPrice,
          depositAmount,
          tourCurrency,
          { languageCurrencies, primaryCurrency },
        );

        if (paymentMessage) {
          finalReply = reply + paymentMessage;
          newContext.paymentInfoSent = true;
          console.log("✅ Payment info appended");
        }
      }
    }

    // Save reservation if JUST transitioned to COMPLETED
    const justCompletedReservation = newContext.stage === "COMPLETED" && 
                                      newContext.reservationConfirmed && 
                                      context.stage !== "COMPLETED";
    
    if (justCompletedReservation) {
      const { tourId, dateId, fullName, phone: regPhone, paxAdult } = newContext.reservationInfo;
      const reservationPhone = regPhone || userPhone;
      
      if (tourId && dateId && fullName && reservationPhone && paxAdult) {
        console.log("💾 Saving reservation...", { tourId, dateId, fullName, paxAdult });

        const { data: newRegistration, error: regError } = await supabase
          .from("registrations")
          .insert({
            tour_id: tourId,
            tour_date_id: dateId,
            full_name: fullName,
            phone: reservationPhone,
            pax: (paxAdult || 0) + (newContext.reservationInfo.paxChild || 0),
            agency_id: agency.id,
            status: "NEW",
            source_channel: "WHATSAPP",
            payment_status: "UNPAID"
          })
          .select()
          .single();

      if (regError) {
        console.error("❌ Save error:", regError);
        // Override AI response - don't confirm a reservation that wasn't saved
        const agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : '';
        const errorMsgs: Record<string, string> = {
          tr: `Rezervasyonunuz oluşturulurken bir sorun yaşandı. Lütfen ${agency.name} ile iletişime geçiniz.${agPhone}`,
          en: `There was an issue creating your reservation. Please contact ${agency.name} directly.${agPhone}`,
          de: `Bei der Erstellung Ihrer Reservierung ist ein Problem aufgetreten. Bitte kontaktieren Sie ${agency.name}.${agPhone}`,
          ru: `При создании бронирования возникла проблема. Пожалуйста, свяжитесь с ${agency.name}.${agPhone}`,
          ar: `حدثت مشكلة أثناء إنشاء حجزك. يرجى التواصل مع ${agency.name}.${agPhone}`,
          fr: `Un problème est survenu lors de la création de votre réservation. Veuillez contacter ${agency.name}.${agPhone}`,
          es: `Hubo un problema al crear su reserva. Por favor contacte a ${agency.name}.${agPhone}`,
        };
        finalReply = errorMsgs[newContext.language] || errorMsgs.tr;
        // Reset context so user can retry
        newContext.stage = context.stage;
        newContext.reservationConfirmed = false;
        console.log("✅ Reservation saved");

        if (planFeatures?.has_templates) {
          const { data: template } = await supabase
            .from("message_templates")
            .select("*")
            .eq("agency_id", agency.id)
            .eq("template_key", "reservation_confirmed")
            .eq("language", newContext.language)
            .eq("is_active", true)
            .maybeSingle();

          if (template && newRegistration) {
            const selectedTourForTemplate = tours.find((t) => t.id === newContext.reservationInfo.tourId);
            const selectedDateForTemplate = selectedTourForTemplate?.dates?.find(
              (d: any) => d.id === newContext.reservationInfo.dateId,
            );

            let templateContent = template.content;
            templateContent = templateContent.replace("{customer_name}", newContext.reservationInfo.fullName || "");
            templateContent = templateContent.replace("{tour_name}", selectedTourForTemplate?.title || "");
            templateContent = templateContent.replace("{tour_date}", selectedDateForTemplate?.departure_date || "");
            templateContent = templateContent.replace(
              "{pax}",
              String((newContext.reservationInfo.paxAdult || 0) + (newContext.reservationInfo.paxChild || 0)),
            );

            finalReply = finalReply + "\n\n" + templateContent;
            console.log("✅ Template message appended");
          }
        }
      }

        if (planFeatures?.has_user_profiles) {
          await supabase.from("whatsapp_user_profiles").upsert(
            {
              phone: userPhone,
              agency_id: agency.id,
              full_name: newContext.reservationInfo.fullName,
              total_bookings: 1,
              last_interaction_at: new Date().toISOString(),
            },
            { onConflict: "phone,agency_id" },
          );
          console.log("✅ User profile updated with booking");
        }
      } else {
        console.error("❌ Missing required fields for reservation:", { tourId, dateId, fullName, paxAdult });
      }
    }

    // Save response
    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone,
      role: "assistant",
      content: finalReply,
      agency_id: agency.id,
    });

    // Enrich conversation insights
    if (planFeatures?.has_user_profiles) {
      await enrichConversationInsights(
        supabase, userPhone, agency.id, message, finalReply, detectedIntent || "general",
      );
    }

    // Save context
    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone,
      role: "system",
      content: JSON.stringify(newContext),
      agency_id: agency.id,
    });

    // Send reply via Meta Cloud API
    const truncatedReply = truncateForWhatsApp(finalReply);
    await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncatedReply);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function isValidContext(obj: any): obj is ConversationContext {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.stage === "string" &&
    typeof obj.language === "string" &&
    typeof obj.tone === "string"
  );
}
