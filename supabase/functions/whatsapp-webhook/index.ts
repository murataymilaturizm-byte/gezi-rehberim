// WhatsApp webhook - Clean FSM with shared core (Meta Cloud API)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createInitialContext, processTransition, getNextExpectedInput } from "../shared/fsm/state-machine.ts";
import { sanitizeInput } from "../shared/fsm/validator.ts";
import { buildSystemPrompt } from "../shared/fsm/prompt-builder.ts";
import { detectLanguage } from "../shared/fsm/language.ts";
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from "../shared/fsm/nlu.ts";
import { extractNameAndPhone } from "../shared/fsm/simple-extractor.ts";
import {
  pickLocalized,
  detectLanguageChangeIntent,
  getDefaultToneForLanguage,
  formatDateForLanguage,
} from "../shared/fsm/localization.ts";
import { matchTour, findTourById } from "../shared/fsm/tour-matcher.ts";
import type { ConversationContext, ProcessingInput, ConversationTone } from "../shared/fsm/types.ts";

import {
  extractMetaWebhookData,
  sendWhatsAppMessage,
  resolveAgencyByPhoneNumberId,
  getMetaCredentials,
} from "../_shared/metaWhatsapp.ts";
import { truncateForWhatsApp } from "./utils/format.ts";
import { generatePaymentMessage } from "./services/payment-message.ts";
import { upsertUserProfile, enrichConversationInsights } from "./services/profile.ts";
import { checkFAQ } from "./services/faq.ts";
import { detectCannedResponseTrigger, getCannedResponse } from "./services/canned-responses.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// === MESAJ TEKRARı ÖNLEMESİ ===
const recentMessageIds = new Map<string, number>();
function isDuplicateMessage(messageId: string): boolean {
  const now = Date.now();
  const lastSeen = recentMessageIds.get(messageId);
  if (lastSeen && now - lastSeen < 5000) return true;
  recentMessageIds.set(messageId, now);
  if (recentMessageIds.size > 100) {
    for (const [key, time] of recentMessageIds.entries()) {
      if (now - time > 60000) recentMessageIds.delete(key);
    }
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // === Test Mode ===
    if (body?.testMode === true) {
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
      if (!phoneNumberId || !accessToken) {
        return new Response(JSON.stringify({ error: "Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const testPhone = body.testPhone?.replace("+", "").trim();
      const testMessage = body.testMessage || "🧪 Test mesajı";
      const result = await sendWhatsAppMessage(phoneNumberId, accessToken, testPhone, testMessage);
      return new Response(JSON.stringify({ success: result.success, ...result }), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookData = extractMetaWebhookData(body);
    if (!webhookData) {
      return new Response(JSON.stringify({ error: "Invalid webhook data" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (webhookData.isStatus) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === MESAJ TEKRARı ÖNLEMESİ ===
    if (webhookData.messageId && isDuplicateMessage(webhookData.messageId)) {
      console.log(`⚡ Duplicate message ignored: ${webhookData.messageId}`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPhone = webhookData.from;
    const rawMessage = webhookData.message;

    if (!userPhone || !rawMessage) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🔍 Webhook phoneNumberId: "${webhookData.phoneNumberId}", from: "${userPhone}"`);
    const { agency, error: agencyError } = await resolveAgencyByPhoneNumberId(supabase, webhookData.phoneNumberId);

    if (agencyError || !agency) {
      console.error(`🚫 Agency not found: ${agencyError}`);
      return new Response(JSON.stringify({ error: "Agency not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone,
      role: "user",
      content: message,
      agency_id: agency.id,
    });

    // === KULLANICI PROFİLİ - SADECE İSİMLE SELAMLAMA ===
    let returningUserName: string | null = null;
    if (planFeatures?.has_user_profiles) {
      await upsertUserProfile(supabase, userPhone, agency.id, message, agency?.enabled_languages || ["tr"]);
      console.log("✅ User profile updated");

      const { data: userProfile } = await supabase
        .from("whatsapp_user_profiles")
        .select("full_name, total_bookings")
        .eq("phone", userPhone)
        .eq("agency_id", agency.id)
        .single();

      if (userProfile?.full_name && userProfile?.total_bookings > 0) {
        returningUserName = userProfile.full_name.split(" ")[0];
        console.log(`👤 Returning user: ${returningUserName}`);
      }
    } else {
      console.log("⏭️ User profiles disabled for plan:", agency.plan_type);
    }

    const { data: dbTours } = await supabase
      .from("tours")
      .select(`*, dates:tour_dates(id, departure_date, return_date, price_adult, price_child, quota)`)
      .eq("agency_id", agency.id);

    const toursRaw = dbTours || [];
    console.log(`📦 Tours: ${toursRaw.length}`);

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
    const languageChangeIntent = detectLanguageChangeIntent(message);
    const runtimeDetectedLang = await detectLanguage(message);

    if (existingState?.content) {
      try {
        const parsed = JSON.parse(existingState.content);
        if (isValidContext(parsed)) {
          context = parsed;
          if (languageChangeIntent && languageChangeIntent !== context.language) {
            context.language = languageChangeIntent;
            context.tone = getDefaultToneForLanguage(languageChangeIntent) as ConversationTone;
          } else if (runtimeDetectedLang && runtimeDetectedLang !== context.language) {
            context.language = runtimeDetectedLang;
          }
          console.log(`✅ Loaded context - Stage: ${context.stage}, Lang: ${context.language}`);
        } else {
          throw new Error("Invalid context");
        }
      } catch (_e) {
        console.log("⚠️ Creating fresh context");
        const initialLang = languageChangeIntent || runtimeDetectedLang || "tr";
        context = createInitialContext(initialLang, getDefaultToneForLanguage(initialLang) as ConversationTone);
      }
    } else {
      console.log("🆕 Fresh context");
      const initialLang = languageChangeIntent || runtimeDetectedLang || "tr";
      context = createInitialContext(initialLang, getDefaultToneForLanguage(initialLang) as ConversationTone);
    }

    const enabledLanguages = (agency as any).enabled_languages || ["tr"];
    if (!enabledLanguages.includes(context.language)) {
      context.language = enabledLanguages[0];
      context.tone = getDefaultToneForLanguage(context.language) as ConversationTone;
    }

    const today = new Date().toISOString().split("T")[0];

    // Enrich tour dates with sold pax for accurate quota display
    const allDateIds = toursRaw.flatMap((t: any) => (t.dates || []).map((d: any) => d.id));
    let soldMap: Record<string, number> = {};
    if (allDateIds.length > 0) {
      const { data: regData } = await supabase
        .from("registrations")
        .select("tour_date_id, pax")
        .in("tour_date_id", allDateIds)
        .neq("status", "CANCELLED");
      if (regData) {
        for (const reg of regData) {
          soldMap[reg.tour_date_id] = (soldMap[reg.tour_date_id] || 0) + reg.pax;
        }
      }
    }

    const tours = toursRaw
      .map((tour: any) => ({
        id: tour.id,
        title: pickLocalized(tour, "title", context.language),
        destination: pickLocalized(tour, "destination", context.language),
        type: tour.type,
        currency: tour.currency,
        program_kisa: pickLocalized(tour, "program_kisa", context.language),
        gezilecek_yerler: tour.gezilecek_yerler,
        toplanma_saati: tour.toplanma_saati,
        hareket_noktasi: tour.hareket_noktasi,
        tur_sure: tour.tur_sure,
        konaklama: tour.konaklama,
        ulasim: tour.ulasim,
        dates: (tour.dates || [])
          .map((d: any) => ({
            ...d,
            sold_pax: soldMap[d.id] || 0,
            remaining_quota: d.quota - (soldMap[d.id] || 0),
          }))
          .filter((d: any) => d.departure_date >= today && d.remaining_quota > 0),
      }))
      .filter((tour: any) => tour.dates.length > 0);

    const currentLang = context.language || "tr";

    if (planFeatures?.has_templates) {
      const cannedTrigger = detectCannedResponseTrigger(message, currentLang);
      if (cannedTrigger) {
        const response = getCannedResponse(cannedTrigger, currentLang);
        if (response) {
          await supabase
            .from("whatsapp_conversations")
            .insert({ phone: userPhone, role: "assistant", content: response, agency_id: agency.id });
          await sendWhatsAppMessage(
            metaCredentials.phoneNumberId,
            metaCredentials.accessToken,
            userPhone,
            truncateForWhatsApp(response),
          );
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const faqResponse = await checkFAQ(supabase, message, agency.id, currentLang);
      if (faqResponse) {
        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "assistant", content: faqResponse, agency_id: agency.id });
        await sendWhatsAppMessage(
          metaCredentials.phoneNumberId,
          metaCredentials.accessToken,
          userPhone,
          truncateForWhatsApp(faqResponse),
        );
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: recentMsgs } = await supabase
      .from("whatsapp_conversations")
      .select("role, content")
      .eq("phone", userPhone)
      .eq("agency_id", agency.id)
      .neq("role", "system")
      .order("created_at", { ascending: false })
      .limit(10);

    const conversationSummary = (recentMsgs || [])
      .reverse()
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    let nluContext = conversationSummary;
    nluContext += `\n\nCurrent stage: ${context.stage}.`;
    if (context.collectionStep) nluContext += ` Collection step: ${context.collectionStep}.`;
    if (context.currentTour) nluContext += ` Selected tour: ${context.currentTour.title}.`;
    if (context.reservationInfo) {
      const info = context.reservationInfo;
      const collected = [];
      if (info.selectedDate) collected.push(`date: ${info.selectedDate}`);
      if (info.paxAdult) collected.push(`pax: ${info.paxAdult}`);
      if (info.fullName) collected.push(`name: ${info.fullName}`);
      if (info.phone) collected.push(`phone: ${info.phone}`);
      if (collected.length > 0) nluContext += ` Reservation info collected: ${collected.join(", ")}.`;
    }
    if (context.stage === "COMPLETED" && context.reservationConfirmed) {
      nluContext += ` STATUS: RESERVATION COMPLETED - any tour questions are purely informational.`;
    }
    if (
      context.collectionStep === "ready_for_confirmation" ||
      (context.reservationInfo?.fullName &&
        context.reservationInfo?.phone &&
        context.reservationInfo?.paxAdult &&
        context.reservationInfo?.dateId)
    ) {
      nluContext += ` STATUS: READY FOR CONFIRMATION - waiting for user to confirm booking.`;
    }

    console.log("📋 NLU Context (stage):", context.stage, context.collectionStep);

    const nluResult = await analyzeUserMessage(message, nluContext, context.stage, context.currentTour, tours);
    console.log("🧠 Intent:", nluResult.intent);

    const fsmIntent = mapNLUIntentToFSMIntent(nluResult.intent);

    if (nluResult.intent === "complaint_feedback") {
      const { error: complaintError } = await supabase.from("complaints").insert({
        agency_id: agency.id,
        phone: userPhone,
        message: message,
        type: "complaint",
        status: "new",
      });
      if (complaintError) console.error("❌ Error saving complaint:", complaintError);
      else console.log("✅ Complaint saved successfully");
    }

    let selectedTour: any = null;
    let multipleTourMatches: any[] = [];

    if (nluResult.entities.tour_name) {
      const matchingTours = tours.filter((t) =>
        t.title.toLowerCase().includes(nluResult.entities.tour_name!.toLowerCase()),
      );
      if (matchingTours.length === 1) {
        const found = matchingTours[0];
        selectedTour = {
          id: found.id,
          title: found.title,
          destination: found.destination,
          dates: found.dates,
          program_kisa: found.program_kisa,
          gezilecek_yerler: found.gezilecek_yerler,
        };
        console.log("🎫 Tour matched by NLU name:", selectedTour.title);
      } else if (matchingTours.length > 1) {
        multipleTourMatches = matchingTours;
      }
    }

    if (!selectedTour && !multipleTourMatches.length && nluResult.entities.destination) {
      const matchingTours = tours.filter(
        (t) =>
          t.destination.toLowerCase().includes(nluResult.entities.destination!.toLowerCase()) ||
          t.title.toLowerCase().includes(nluResult.entities.destination!.toLowerCase()),
      );
      if (matchingTours.length === 1) {
        const found = matchingTours[0];
        selectedTour = {
          id: found.id,
          title: found.title,
          destination: found.destination,
          dates: found.dates,
          program_kisa: found.program_kisa,
          gezilecek_yerler: found.gezilecek_yerler,
        };
        console.log("🎫 Tour matched by NLU destination:", selectedTour.title);
      } else if (matchingTours.length > 1) {
        multipleTourMatches = matchingTours;
      }
    }

    if (!selectedTour && multipleTourMatches.length === 0) {
      const expectedInput = getNextExpectedInput(context);
      const matchedTour = matchTour(message, tours, expectedInput);
      if (matchedTour) {
        const lowerMessage = message.toLowerCase().trim();
        const allMatches = tours.filter(
          (tour) =>
            tour.title.toLowerCase().includes(lowerMessage) || tour.destination.toLowerCase().includes(lowerMessage),
        );
        if (allMatches.length > 1) {
          multipleTourMatches = allMatches;
        } else {
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
        }
      } else {
        console.log("❌ No tour match found via NLU or direct matching");
      }
    }

    const extractedInfo: any = { ...nluResult.updates };
    if (nluResult.entities.dates && nluResult.entities.dates.length > 0) {
      extractedInfo.selectedDate = nluResult.entities.dates[0];
    }

    // === İSİM ÇIKARMA - collectionStep'i geç ===
    const simpleExtraction = extractNameAndPhone(message, context.collectionStep);
    if (simpleExtraction.fullName && !extractedInfo.fullName) extractedInfo.fullName = simpleExtraction.fullName;
    if (simpleExtraction.phone && !extractedInfo.phone) extractedInfo.phone = simpleExtraction.phone;
    if (simpleExtraction.paxAdult && !extractedInfo.paxAdult) extractedInfo.paxAdult = simpleExtraction.paxAdult;
    if (simpleExtraction.selectedDate && !extractedInfo.selectedDate)
      extractedInfo.selectedDate = simpleExtraction.selectedDate;

    const expectedInput = getNextExpectedInput(context);

    // waiting_for_name aşamasında isim NLU'dan da gelmemişse mesajı direkt isim kabul et
    if (expectedInput === "name" && !extractedInfo.fullName) {
      const words = message.trim().split(/\s+/);
      if (
        words.length >= 2 &&
        words.length <= 4 &&
        !message.includes("?") &&
        !/\d/.test(message) &&
        words.every((w) => w.length >= 2)
      ) {
        const basicBlacklist = [
          "evet",
          "hayır",
          "tamam",
          "olur",
          "haydi",
          "hadi",
          "rezervasyon",
          "onaylıyorum",
          "iptal",
          "cancel",
        ];
        const lowerMsg = message.toLowerCase();
        if (!basicBlacklist.some((w) => lowerMsg.includes(w))) {
          extractedInfo.fullName = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
          console.log("📝 Name extracted (loose mode):", extractedInfo.fullName);
        }
      }
    }

    if (!extractedInfo.paxAdult && expectedInput === "pax") {
      const plainNumber = parseInt(message.trim());
      if (!isNaN(plainNumber) && plainNumber >= 1 && plainNumber <= 50) {
        extractedInfo.paxAdult = plainNumber;
      }
    }

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

    if (
      !extractedInfo.dateId &&
      context.currentTour &&
      (expectedInput === "date" || expectedInput === "date_selection")
    ) {
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

    if (extractedInfo.selectedDate && !extractedInfo.dateId && context.currentTour) {
      const tour = findTourById(context.currentTour.id, tours);
      if (tour?.dates && tour.dates.length > 0) {
        const matchedDate = tour.dates.find((d: any) => {
          if (d.departure_date === extractedInfo.selectedDate) return true;
          try {
            const targetDate = new Date(extractedInfo.selectedDate);
            const tourDate = new Date(d.departure_date);
            return targetDate.getDate() === tourDate.getDate() && targetDate.getMonth() === tourDate.getMonth();
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

    if (
      !extractedInfo.dateId &&
      !extractedInfo.selectedDate &&
      context.currentTour?.dates?.length === 1 &&
      (fsmIntent === "provide_info" || fsmIntent === "confirm" || fsmIntent === "reservation_intent")
    ) {
      const singleDate = context.currentTour.dates[0];
      extractedInfo.selectedDate = singleDate.departure_date;
      extractedInfo.dateId = singleDate.id;
    }

    console.log("📝 Extracted info:", extractedInfo);

    const input: ProcessingInput = {
      userMessage: message,
      detectedIntent: fsmIntent,
      extractedInfo,
      selectedTour,
      language: context.language,
    };

    const newContext = processTransition(context, input);
    console.log(`🔄 ${context.stage} → ${newContext.stage}`);

    // Deterministic date listing (do not depend on AI for this step)
    if (
      newContext.stage === "COLLECTING_INFO" &&
      newContext.collectionStep === "waiting_for_date" &&
      newContext.currentTour
    ) {
      const selectedTourForDates = findTourById(newContext.currentTour.id, tours);
      if (selectedTourForDates?.dates?.length) {
        const dateLines = selectedTourForDates.dates
          .map((d: any, idx: number) => {
            const dateText = formatDateForLanguage(d.departure_date, newContext.language);
            const priceText = d.price_adult ? ` - ${d.price_adult} ${selectedTourForDates.currency || "TRY"}` : "";
            const remaining = d.remaining_quota !== undefined ? d.remaining_quota : d.quota;
            const quotaText =
              remaining !== undefined
                ? newContext.language === "tr"
                  ? ` (${remaining} kişilik yer)`
                  : ` (${remaining} spots)`
                : "";
            return `${idx + 1}) ${dateText}${priceText}${quotaText}`;
          })
          .join("\n");

        const dateSelectionMessages: Record<string, string> = {
          tr: `*${selectedTourForDates.title}* için müsait tarihler:\n${dateLines}\n\nHangi tarihi tercih edersiniz?`,
          en: `Available dates for *${selectedTourForDates.title}*:\n${dateLines}\n\nWhich date do you prefer?`,
          de: `Verfügbare Termine für *${selectedTourForDates.title}*:\n${dateLines}\n\nWelches Datum bevorzugen Sie?`,
          ru: `Доступные даты для *${selectedTourForDates.title}*:\n${dateLines}\n\nКакую дату вы предпочитаете?`,
          ar: `التواريخ المتاحة لـ *${selectedTourForDates.title}*:\n${dateLines}\n\nما التاريخ الذي تفضله؟`,
          fr: `Dates disponibles pour *${selectedTourForDates.title}* :\n${dateLines}\n\nQuelle date préférez-vous ?`,
          es: `Fechas disponibles para *${selectedTourForDates.title}*:\n${dateLines}\n\n¿Qué fecha prefieres?`,
        };

        const dateReply = dateSelectionMessages[newContext.language] || dateSelectionMessages.tr;

        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "assistant", content: dateReply, agency_id: agency.id });

        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "system", content: JSON.stringify(newContext), agency_id: agency.id });

        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(dateReply));

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === KOTA KONTROLÜ ===
    if (newContext.stage === "COMPLETED" && newContext.reservationConfirmed && context.stage !== "COMPLETED") {
      const { dateId, paxAdult } = newContext.reservationInfo;
      if (dateId && paxAdult) {
        const { data: tourDate } = await supabase.from("tour_dates").select("quota").eq("id", dateId).single();
        if (tourDate?.quota !== null && tourDate?.quota !== undefined) {
          const { count: existingPax } = await supabase
            .from("registrations")
            .select("pax", { count: "exact" })
            .eq("tour_date_id", dateId)
            .neq("status", "CANCELLED");

          const usedQuota = existingPax || 0;
          const remainingQuota = tourDate.quota - usedQuota;

          if (remainingQuota < paxAdult) {
            console.log(`⚠️ Quota exceeded: ${remainingQuota} remaining, ${paxAdult} requested`);
            const agencyPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";

            // Aynı turun diğer müsait tarihlerini bul
            const currentTourData = toursRaw.find((t: any) => t.id === newContext.reservationInfo.tourId);
            const otherAvailableDates = (currentTourData?.dates || []).filter((d: any) => {
              if (d.id === dateId) return false; // Dolu olan tarihi atla
              if (d.departure_date < today) return false; // Geçmiş tarihleri atla
              return true;
            });

            // Her tarih için kota kontrolü yap
            const availableDatesList: string[] = [];
            for (const d of otherAvailableDates) {
              const { count: usedForDate } = await supabase
                .from("registrations")
                .select("pax", { count: "exact" })
                .eq("tour_date_id", d.id)
                .neq("status", "CANCELLED");

              const usedCount = usedForDate || 0;
              const available = (d.quota || 999) - usedCount;
              if (available >= paxAdult) {
                // Tarihi formatla
                const dateStr = new Date(d.departure_date).toLocaleDateString(
                  newContext.language === "tr"
                    ? "tr-TR"
                    : newContext.language === "de"
                      ? "de-DE"
                      : newContext.language === "ru"
                        ? "ru-RU"
                        : "en-GB",
                  { day: "numeric", month: "long", year: "numeric" },
                );
                const priceStr = d.price_adult ? ` (${d.price_adult} ${currentTourData?.currency || "TRY"})` : "";
                availableDatesList.push(`• ${dateStr}${priceStr}`);
              }
            }

            // Mesajı oluştur
            let quotaMsg = "";
            const lang = newContext.language || "tr";

            if (availableDatesList.length > 0) {
              const dateListStr = availableDatesList.join("\n");
              const msgs: Record<string, string> = {
                tr: `Üzgünüz, seçtiğiniz tarih için yeterli kontenjan bulunmamaktadır (kalan: ${remainingQuota} kişi).\n\n📅 *Müsait Diğer Tarihler:*\n${dateListStr}\n\nBu tarihlerden birini seçmek ister misiniz?`,
                en: `Sorry, the selected date doesn't have enough spots (remaining: ${remainingQuota}).\n\n📅 *Available Dates:*\n${dateListStr}\n\nWould you like to choose one of these dates?`,
                de: `Das gewählte Datum hat leider nicht genügend Plätze (verbleibend: ${remainingQuota}).\n\n📅 *Verfügbare Termine:*\n${dateListStr}\n\nMöchten Sie einen dieser Termine wählen?`,
                ru: `К сожалению, на выбранную дату недостаточно мест (осталось: ${remainingQuota}).\n\n📅 *Доступные даты:*\n${dateListStr}\n\nХотите выбрать одну из этих дат?`,
                ar: `عذراً، لا توجد أماكن كافية للتاريخ المحدد (المتبقي: ${remainingQuota}).\n\n📅 *التواريخ المتاحة:*\n${dateListStr}\n\nهل تريد اختيار أحد هذه التواريخ؟`,
              };
              quotaMsg = msgs[lang] || msgs["tr"];
            } else {
              // Hiç müsait tarih yok — acenteyle iletişime geç
              const msgs: Record<string, string> = {
                tr: `Üzgünüz, seçtiğiniz tarih için yeterli kontenjan bulunmamaktadır (kalan: ${remainingQuota} kişi). Şu an bu tur için müsait başka tarih de bulunmuyor.\n\nLütfen ${agency.name} ile iletişime geçiniz.${agencyPhone}`,
                en: `Sorry, there are not enough spots for your selected date (remaining: ${remainingQuota}). There are no other available dates for this tour at the moment.\n\nPlease contact ${agency.name}.${agencyPhone}`,
                de: `Für das gewählte Datum sind nicht genügend Plätze verfügbar (verbleibend: ${remainingQuota}). Aktuell sind keine weiteren Termine verfügbar.\n\nBitte kontaktieren Sie ${agency.name}.${agencyPhone}`,
                ru: `На выбранную дату недостаточно мест (осталось: ${remainingQuota}). Других доступных дат для этого тура нет.\n\nПожалуйста, свяжитесь с ${agency.name}.${agencyPhone}`,
                ar: `لا توجد أماكن كافية للتاريخ المحدد (المتبقي: ${remainingQuota}). لا توجد تواريخ أخرى متاحة حالياً.\n\nيرجى التواصل مع ${agency.name}.${agencyPhone}`,
              };
              quotaMsg = msgs[lang] || msgs["tr"];
            }
            await supabase
              .from("whatsapp_conversations")
              .insert({ phone: userPhone, role: "assistant", content: quotaMsg, agency_id: agency.id });
            await sendWhatsAppMessage(
              metaCredentials.phoneNumberId,
              metaCredentials.accessToken,
              userPhone,
              truncateForWhatsApp(quotaMsg),
            );
            newContext.stage = "COLLECTING_INFO";
            newContext.reservationConfirmed = false;
            newContext.reservationInfo.dateId = undefined;
            newContext.reservationInfo.selectedDate = undefined;
            newContext.collectionStep = "waiting_for_date";
            await supabase
              .from("whatsapp_conversations")
              .insert({ phone: userPhone, role: "system", content: JSON.stringify(newContext), agency_id: agency.id });
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    // Deterministic completion handling (save first, then respond)
    const justCompletedReservation =
      newContext.stage === "COMPLETED" && newContext.reservationConfirmed && context.stage !== "COMPLETED";

    if (justCompletedReservation) {
      const { tourId, dateId, fullName, phone: regPhone, paxAdult } = newContext.reservationInfo;
      const reservationPhone = regPhone || userPhone;

      const missingOrder = !dateId
        ? "waiting_for_date"
        : !paxAdult
          ? "waiting_for_pax"
          : !fullName
            ? "waiting_for_name"
            : !reservationPhone
              ? "waiting_for_phone"
              : null;

      if (missingOrder) {
        const missingMsgs: Record<string, string> = {
          tr: "Rezervasyonu tamamlayabilmem için eksik bilgileri adım adım tamamlayalım.",
          en: "Let's complete the missing details step by step to finalize your reservation.",
        };
        newContext.stage = "COLLECTING_INFO";
        newContext.reservationConfirmed = false;
        newContext.collectionStep = missingOrder as any;

        const missingReply = missingMsgs[newContext.language] || missingMsgs.tr;
        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "assistant", content: missingReply, agency_id: agency.id });
        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "system", content: JSON.stringify(newContext), agency_id: agency.id });
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(missingReply));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingReservation } = await supabase
        .from("registrations")
        .select("id")
        .eq("tour_date_id", dateId)
        .eq("phone", reservationPhone)
        .neq("status", "CANCELLED")
        .maybeSingle();

      if (existingReservation) {
        const agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
        const dupMessages: Record<string, string> = {
          tr: `Bu tura zaten kayıtlısınız! Rezervasyon bilgileriniz için lütfen ${agency.name} ile iletişime geçin.${agPhone}`,
          en: `You are already registered for this tour! Please contact ${agency.name}.${agPhone}`,
        };
        const duplicateReply = dupMessages[newContext.language] || dupMessages.tr;

        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "assistant", content: duplicateReply, agency_id: agency.id });
        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "system", content: JSON.stringify(newContext), agency_id: agency.id });
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(duplicateReply));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
          payment_status: "UNPAID",
        })
        .select()
        .single();

      if (regError) {
        const agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
        const errorMsgs: Record<string, string> = {
          tr: `Rezervasyonunuz oluşturulurken bir sorun yaşandı. Lütfen ${agency.name} ile iletişime geçiniz.${agPhone}`,
          en: `There was an issue creating your reservation. Please contact ${agency.name} directly.${agPhone}`,
          de: `Bei der Erstellung Ihrer Reservierung ist ein Problem aufgetreten. Bitte kontaktieren Sie ${agency.name}.${agPhone}`,
          ru: `При создании бронирования возникла проблема. Пожалуйста, свяжитесь с ${agency.name}.${agPhone}`,
          ar: `حدثت مشكلة أثناء إنشاء حجزك. يرجى التواصل مع ${agency.name}.${agPhone}`,
          fr: `Un problème est survenu. Veuillez contacter ${agency.name}.${agPhone}`,
          es: `Hubo un problema. Por favor contacte a ${agency.name}.${agPhone}`,
        };

        newContext.stage = "COLLECTING_INFO";
        newContext.reservationConfirmed = false;
        newContext.collectionStep = "waiting_for_date";

        const errorReply = errorMsgs[newContext.language] || errorMsgs.tr;
        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "assistant", content: errorReply, agency_id: agency.id });
        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "system", content: JSON.stringify(newContext), agency_id: agency.id });
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(errorReply));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const selectedTourForSummary = tours.find((t: any) => t.id === tourId);
      const selectedDateForSummary = selectedTourForSummary?.dates?.find((d: any) => d.id === dateId);
      const formattedDate = selectedDateForSummary?.departure_date
        ? formatDateForLanguage(selectedDateForSummary.departure_date, newContext.language)
        : newContext.reservationInfo.selectedDate || "-";

      const adultCount = newContext.reservationInfo.paxAdult || 0;
      const childCount = newContext.reservationInfo.paxChild || 0;
      const paxText =
        newContext.language === "tr"
          ? `${adultCount} yetişkin${childCount ? `, ${childCount} çocuk` : ""}`
          : `${adultCount} adult${childCount ? `, ${childCount} child` : ""}`;

      const completionMessages: Record<string, string> = {
        tr: `Bilgilerinizi aldım ${fullName || ""}, çok teşekkür ederim! 😊\n*${selectedTourForSummary?.title || newContext.reservationInfo.tourTitle || "Tur"}* için ön kaydınızı başarıyla gerçekleştirdim.\n\n*Kayıt Özetiniz:*\n• *Tur:* ${selectedTourForSummary?.title || newContext.reservationInfo.tourTitle || "-"}\n• *Tarih:* ${formattedDate}\n• *Kişi:* ${paxText}\n• *İsim:* ${fullName || "-"}\n• *Telefon:* ${reservationPhone || "-"}\n\nKesin rezervasyon ve ödeme detayları için ekip arkadaşlarımız size en kısa sürede ulaşacaktır.",
        en: `Thank you ${fullName || ""}! 😊\nYour pre-registration for *${selectedTourForSummary?.title || newContext.reservationInfo.tourTitle || "Tour"}* is completed.\n\n*Reservation Summary:*\n• *Tour:* ${selectedTourForSummary?.title || newContext.reservationInfo.tourTitle || "-"}\n• *Date:* ${formattedDate}\n• *People:* ${paxText}\n• *Name:* ${fullName || "-"}\n• *Phone:* ${reservationPhone || "-"}\n\nOur team will contact you shortly for final booking and payment details.",
      };

      let finalReply = completionMessages[newContext.language] || completionMessages.tr;

      if (paymentInstructions && selectedDateForSummary) {
        const depositPercentage =
          (paymentInstructions &&
            typeof paymentInstructions === "object" &&
            (paymentInstructions as any).deposit_percentage) ||
          30;
        const totalPrice =
          adultCount * (selectedDateForSummary.price_adult || 0) +
          childCount * (selectedDateForSummary.price_child || selectedDateForSummary.price_adult || 0);
        const depositAmount = Math.ceil((totalPrice * depositPercentage) / 100);

        if (totalPrice > 0) {
          const paymentMessage = await generatePaymentMessage(
            paymentInstructions,
            newContext.language,
            totalPrice,
            depositAmount,
            selectedTourForSummary?.currency || "TRY",
            { languageCurrencies, primaryCurrency },
          );
          if (paymentMessage) {
            finalReply += paymentMessage;
            newContext.paymentInfoSent = true;
          }
        }
      }

      if (planFeatures?.has_templates && newRegistration) {
        const { data: template } = await supabase
          .from("message_templates")
          .select("*")
          .eq("agency_id", agency.id)
          .eq("template_key", "reservation_confirmed")
          .eq("language", newContext.language)
          .eq("is_active", true)
          .maybeSingle();

        if (template) {
          let templateContent = template.content;
          templateContent = templateContent.replace("{customer_name}", fullName || "");
          templateContent = templateContent.replace("{tour_name}", selectedTourForSummary?.title || "");
          templateContent = templateContent.replace("{tour_date}", selectedDateForSummary?.departure_date || "");
          templateContent = templateContent.replace("{pax}", String(adultCount + childCount));
          finalReply += "\n\n" + templateContent;
        }
      }

      if (planFeatures?.has_user_profiles) {
        await supabase
          .from("whatsapp_user_profiles")
          .upsert(
            {
              phone: userPhone,
              agency_id: agency.id,
              full_name: fullName,
              total_bookings: 1,
              last_interaction_at: new Date().toISOString(),
            },
            { onConflict: "phone,agency_id" },
          );
      }

      await supabase
        .from("whatsapp_conversations")
        .insert({ phone: userPhone, role: "assistant", content: finalReply, agency_id: agency.id });

      await supabase
        .from("whatsapp_conversations")
        .insert({ phone: userPhone, role: "system", content: JSON.stringify(newContext), agency_id: agency.id });

      await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(finalReply));

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Tur değişikliği uyarısı
    let tourSwitchWarning = "";
    if (
      newContext.stage === "COLLECTING_INFO" &&
      selectedTour &&
      newContext.currentTour &&
      selectedTour.id !== newContext.currentTour.id
    ) {
      tourSwitchWarning =
        newContext.language === "tr"
          ? `\n\n🚨 KRİTİK UYARI: Kullanıcı "${newContext.currentTour.title}" için rezervasyon yapıyor ama "${selectedTour.title}" hakkında bir şey söyledi. Tur değişikliği için onay iste, otomatik değiştirme!`
          : `\n\n🚨 CRITICAL: User is booking "${newContext.currentTour.title}" but mentioned "${selectedTour.title}". Ask for confirmation before switching. NEVER switch automatically!`;
    }

    // === COMPLETED AŞAMASI: ESKİ REZERVASYONDAN BAHSETME ===
    let completedStagePrompt = "";
    if (context.stage === "COMPLETED" && newContext.stage === "COMPLETED") {
      // Aynı tur hakkında soru - bilgi ver
      completedStagePrompt =
        newContext.language === "tr"
          ? `\n\n✅ TAMAMLANAN REZERVASYon SONRASI:
Kullanıcının ${context.currentTour?.title || "önceki tur"} için rezervasyonu tamamlandı.
Kullanıcı şu an soru soruyor. Sadece sorusunu yanıtla.
KESİNLİKLE "rezervasyonunuz tamamlandı" veya "kaydınız oluşturuldu" DEME - bu zaten yapıldı.
Doğal bir konuşma gibi devam et.`
          : `\n\n✅ POST-RESERVATION STATE:
User's reservation for ${context.currentTour?.title || "previous tour"} is already completed.
User is asking a question now. Just answer their question naturally.
DO NOT say "your reservation is confirmed" or "booking completed" - that already happened.
Continue naturally.`;
    } else if (context.stage === "COMPLETED" && newContext.stage === "TOUR_SELECTED") {
      // Farklı tura geçiş - eski rezervasyondan hiç bahsetme
      completedStagePrompt =
        newContext.language === "tr"
          ? `\n\n🔄 YENİ TUR SEÇİLDİ:
Kullanıcı yeni bir tur seçti: ${newContext.currentTour?.title}.
Önceki rezervasyondan (${context.currentTour?.title}) KESİNLİKLE bahsetme.
Sanki yeni bir konuşma başlıyormuş gibi sadece yeni tura odaklan.
"Kaydınız tamamlandı" veya önceki tura dair HİÇBİR ŞEY söyleme.`
          : `\n\n🔄 NEW TOUR SELECTED:
User selected a new tour: ${newContext.currentTour?.title}.
DO NOT mention the previous reservation (${context.currentTour?.title}) at all.
Focus only on the new tour as if starting fresh.
Never say anything about the previous booking.`;
    }

    // === DÖNEN KULLANICI SELAMLAMA ===
    let returningUserPrompt = "";
    if (returningUserName && context.stage === "GREETING") {
      returningUserPrompt =
        newContext.language === "tr"
          ? `\n\n👤 DÖNEN MÜŞTERİ: Adı "${returningUserName}". Sadece selamlarken adıyla hitap et. Önceki rezervasyon bilgilerini ASLA hatırlatma veya sorma. Sıfırdan başla.`
          : `\n\n👤 RETURNING CUSTOMER: Name is "${returningUserName}". Only greet by name. NEVER mention previous reservations. Start fresh.`;
    }

    const systemPrompt =
      buildSystemPrompt(promptContext) + tourSwitchWarning + completedStagePrompt + returningUserPrompt;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build conversation history for AI context
    const conversationMessages = (recentMsgs || [])
      .reverse()
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
          { role: "user", content: message },
        ],
      }),
    });

    if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);

    const aiData = await aiResponse.json();
    let reply: string = aiData.choices[0].message.content;
    console.log("🤖 Reply:", reply.substring(0, 80));

    let finalReply = reply;

    // Ödeme mesajı ekle
    if (
      newContext.stage === "COMPLETED" &&
      newContext.reservationConfirmed &&
      !newContext.paymentInfoSent &&
      paymentInstructions
    ) {
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
        const totalPrice =
          paxAdult * (selectedTourDate.price_adult || 0) +
          paxChild * (selectedTourDate.price_child || selectedTourDate.price_adult || 0);
        const depositAmount = Math.ceil((totalPrice * depositPercentage) / 100);
        const paymentMessage = await generatePaymentMessage(
          paymentInstructions,
          newContext.language,
          totalPrice,
          depositAmount,
          tourForReservation?.currency || "TRY",
          { languageCurrencies, primaryCurrency },
        );
        if (paymentMessage) {
          finalReply = reply + paymentMessage;
          newContext.paymentInfoSent = true;
        }
      }
    }

    // Reservation completion save/response is handled deterministically above.

    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone,
      role: "assistant",
      content: finalReply,
      agency_id: agency.id,
    });

    if (planFeatures?.has_user_profiles) {
      await enrichConversationInsights(supabase, userPhone, agency.id, message, finalReply, fsmIntent || "general");
    }

    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone,
      role: "system",
      content: JSON.stringify(newContext),
      agency_id: agency.id,
    });

    await sendWhatsAppMessage(
      metaCredentials.phoneNumberId,
      metaCredentials.accessToken,
      userPhone,
      truncateForWhatsApp(finalReply),
    );

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
