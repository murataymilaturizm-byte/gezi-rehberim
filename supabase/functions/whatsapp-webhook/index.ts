// WhatsApp webhook - Clean FSM with shared core
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

// WhatsApp-specific utilities
import { createTwiMLResponse, createTwiMLHeaders } from "./utils/twilio.ts";
import { truncateForWhatsApp } from "./utils/format.ts";
import { validateTwilioWebhook } from "./utils/signature-validation.ts";

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

  try {
    const formData = await req.formData();

    // Initialize Supabase client first (needed for validation)
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // === MULTI-TENANT SECURITY: Validate Twilio Signature ===
    const validation = await validateTwilioWebhook(req, formData, supabase);

    if (!validation.isValid) {
      console.error(`🚫 Unauthorized request: ${validation.error} (AccountSid: ${validation.accountSid})`);
      return new Response(JSON.stringify({ error: "Unauthorized", details: validation.error }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agency = validation.agency;

    // 🔐 Ödeme / para birimi ile ilgili alanları agency’den çek
    const paymentInstructions = agency.payment_instructions ?? null;
    const languageCurrencies = agency.language_currencies ?? null;
    const primaryCurrency = agency.primary_currency ?? "TRY";

    // System prompt içinde kullanılacak sade paymentInfo metni (opsiyonel)
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

    // Extract request data
    const userPhone = formData.get("From")?.toString() || "";
    const rawMessage = formData.get("Body")?.toString() || "";

    if (!userPhone || !rawMessage) {
      return new Response("Missing required fields", { status: 400 });
    }

    const message = sanitizeInput(rawMessage);
    console.log("📱 WhatsApp FSM:", userPhone.slice(-4));

    console.log(`🏢 Agency: ${agency.name}`);

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

          // Handle explicit language change request
          if (languageChangeIntent && languageChangeIntent !== context.language) {
            console.log(`🌐 Language change: ${context.language} → ${languageChangeIntent}`);
            context.language = languageChangeIntent;
            context.tone = getDefaultToneForLanguage(languageChangeIntent) as ConversationTone;
          } else if (runtimeDetectedLang && runtimeDetectedLang !== context.language) {
            // Update language if detected language is different
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

    // Localized tours
    const tours = toursRaw.map((tour: any) => ({
      id: tour.id,
      title: pickLocalized(tour, "title", context.language),
      destination: pickLocalized(tour, "destination", context.language),
      type: tour.type,
      currency: tour.currency,
      program_kisa: pickLocalized(tour, "program_kisa", context.language),
      gezilecek_yerler: tour.gezilecek_yerler,
      dates: tour.dates || [],
    }));

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
          return new Response(createTwiMLResponse(truncateForWhatsApp(response)), {
            status: 200,
            headers: createTwiMLHeaders(),
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
        return new Response(createTwiMLResponse(truncateForWhatsApp(faqResponse)), {
          status: 200,
          headers: createTwiMLHeaders(),
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

    // Analyze with NLU
    const nluResult = await analyzeUserMessage(message, conversationSummary, context.stage, context.currentTour, tours);

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
    // Strategy 1: NLU entities (tour_name, destination)
    // Strategy 2: Direct matching (numbers, keywords) via matchTour
    let selectedTour: any = null;

    if (nluResult.entities.tour_name) {
      const found = tours.find((t) => t.title.toLowerCase().includes(nluResult.entities.tour_name!.toLowerCase()));
      if (found) {
        selectedTour = {
          id: found.id,
          title: found.title,
          destination: found.destination,
          dates: found.dates,
          program_kisa: found.program_kisa,
          gezilecek_yerler: found.gezilecek_yerler,
        };
        console.log("🎫 Tour matched by NLU name:", selectedTour.title);
      }
    } else if (nluResult.entities.destination) {
      const found = tours.find((t) =>
        t.destination.toLowerCase().includes(nluResult.entities.destination!.toLowerCase()),
      );
      if (found) {
        selectedTour = {
          id: found.id,
          title: found.title,
          destination: found.destination,
          dates: found.dates,
          program_kisa: found.program_kisa,
          gezilecek_yerler: found.gezilecek_yerler,
        };
        console.log("🎫 Tour matched by NLU destination:", selectedTour.title);
      }
    }

    // FALLBACK: direct matching
    if (!selectedTour) {
      const expectedInput = getNextExpectedInput(context);
      const matchedTour = matchTour(message, tours, expectedInput);
      if (matchedTour) {
        const fullTour = findTourById(matchedTour.id, tours);
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

    // Extract info
    const extractedInfo: any = { ...nluResult.updates };
    if (nluResult.entities.dates && nluResult.entities.dates.length > 0) {
      extractedInfo.selectedDate = nluResult.entities.dates[0];
    }

    const simpleExtraction = extractNameAndPhone(message);
    if (simpleExtraction.fullName && !extractedInfo.fullName) {
      extractedInfo.fullName = simpleExtraction.fullName;
    }
    if (simpleExtraction.phone && !extractedInfo.phone) {
      extractedInfo.phone = simpleExtraction.phone;
    }

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

    // Store detected intent for conversation insights
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
    };

    // CRITICAL: Prevent accidental tour switching during reservation
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

      // Get selected tour date to calculate price
      const tourForReservation = toursRaw.find((t: any) => t.id === newContext.reservationInfo.tourId);

      const selectedTourDate = tourForReservation?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId);

      if (selectedTourDate) {
        const paxAdult = newContext.reservationInfo.paxAdult || 0;
        const paxChild = newContext.reservationInfo.paxChild || 0;
        const priceAdult = selectedTourDate.price_adult || 0;
        const priceChild = selectedTourDate.price_child || priceAdult;

        const totalPrice = paxAdult * priceAdult + paxChild * priceChild;
        const depositAmount = Math.ceil((totalPrice * depositPercentage) / 100);

        // Turun kendi para birimi
        const tourCurrency = tourForReservation?.currency || "TRY";

        // Yeni async, çoklu para birimi destekli payment message
        const paymentMessage = await generatePaymentMessage(
          paymentInstructions,
          newContext.language,
          totalPrice,
          depositAmount,
          tourCurrency,
          {
            languageCurrencies,
            primaryCurrency,
          },
        );

        if (paymentMessage) {
          finalReply = reply + paymentMessage;
          newContext.paymentInfoSent = true;
          console.log("✅ Payment info appended");
        }
      }
    }

    // Save reservation if completed and get template BEFORE saving response
    if (newContext.stage === "COMPLETED" && newContext.reservationConfirmed) {
      console.log("💾 Saving reservation...");

      const { data: newRegistration, error: regError } = await supabase
        .from("registrations")
        .insert({
          tour_id: newContext.reservationInfo.tourId,
          tour_date_id: newContext.reservationInfo.dateId,
          full_name: newContext.reservationInfo.fullName,
          phone: newContext.reservationInfo.phone || userPhone,
          pax: (newContext.reservationInfo.paxAdult || 0) + (newContext.reservationInfo.paxChild || 0),
          agency_id: agency.id,
          status: "NEW",
        })
        .select()
        .single();

      if (regError) {
        console.error("❌ Save error:", regError);
      } else {
        console.log("✅ Reservation saved");

        // Send reservation confirmation template if available (only if templates enabled)
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
            console.log("📧 Sending reservation confirmation template...");

            // Replace template variables
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

            // Append template message to final reply BEFORE saving
            finalReply = finalReply + "\n\n" + templateContent;
            console.log("✅ Template message appended");
          }
        }
      }

      // Update profile (only if user profiles feature is enabled)
      if (planFeatures?.has_user_profiles) {
        await supabase.from("whatsapp_user_profiles").upsert(
          {
            phone: userPhone,
            agency_id: agency.id,
            full_name: newContext.reservationInfo.fullName,
            total_bookings: 1,
            last_interaction_at: new Date().toISOString(),
          },
          {
            onConflict: "phone,agency_id",
          },
        );
        console.log("✅ User profile updated with booking");
      }
    }

    // Save response (now includes template/payment if applicable)
    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone,
      role: "assistant",
      content: finalReply,
      agency_id: agency.id,
    });

    // Enrich conversation insights (only if user profiles feature is enabled)
    if (planFeatures?.has_user_profiles) {
      await enrichConversationInsights(
        supabase,
        userPhone,
        agency.id,
        message,
        finalReply,
        detectedIntent || "general",
      );
      console.log("✅ Conversation insights enriched");
    }

    // Save context
    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone,
      role: "system",
      content: JSON.stringify(newContext),
      agency_id: agency.id,
    });

    return new Response(createTwiMLResponse(truncateForWhatsApp(finalReply)), {
      status: 200,
      headers: createTwiMLHeaders(),
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(createTwiMLResponse("Üzgünüm, bir hata oluştu."), {
      status: 200,
      headers: createTwiMLHeaders(),
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
