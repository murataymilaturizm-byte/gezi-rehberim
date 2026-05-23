import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { subscribeAppToWabaWithRetry, verifyWabaSubscription } from "../_shared/metaWhatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAppSecret = Deno.env.get("META_APP_SECRET");

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Return app config for frontend SDK initialization
    if (action === "get-config") {
      const metaAppId = Deno.env.get("META_APP_ID");
      // META_CONFIG_ID = Embedded Signup Configuration ID (öncelikli)
      // META_BUSINESS_ID = fallback (eski secret adı)
      const metaConfigId = Deno.env.get("META_CONFIG_ID") || Deno.env.get("META_BUSINESS_ID");

      if (!metaAppId) {
        return new Response(
          JSON.stringify({ error: "META_APP_ID not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ appId: metaAppId, configId: metaConfigId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange the code from Embedded Signup for a long-lived token
    if (action === "exchange-token") {
      const { code, agencyId } = body;

      if (!code || !agencyId) {
        return new Response(
          JSON.stringify({ error: "Missing code or agencyId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify agency belongs to user
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .select("id, user_id")
        .eq("id", agencyId)
        .eq("user_id", user.id)
        .single();

      if (agencyError || !agency) {
        return new Response(
          JSON.stringify({ error: "Agency not found or unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metaAppId = Deno.env.get("META_APP_ID")!;

      if (!metaAppSecret) {
        return new Response(
          JSON.stringify({ error: "META_APP_SECRET not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Exchange code for short-lived token
      const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${metaAppId}&client_secret=${metaAppSecret}&code=${code}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error("❌ Token exchange failed:", tokenData.error);
        return new Response(
          JSON.stringify({ error: "Token exchange failed", details: tokenData.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const shortLivedToken = tokenData.access_token;

      // Step 2: Exchange for long-lived token
      const longTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}&fb_exchange_token=${shortLivedToken}`;
      const longTokenRes = await fetch(longTokenUrl);
      const longTokenData = await longTokenRes.json();

      const accessToken = longTokenData.access_token || shortLivedToken;

      // Step 3: Get shared WABA info — debug_token öncelikli, fallback /me/businesses
      const wabaInfo = await getSharedWABAInfo(accessToken, metaAppId, metaAppSecret!);

      // Step 4: Get phone number info from WABA
      let phoneNumberId = "";
      let phoneNumber = "";

      if (wabaInfo.wabaId) {
        const phoneInfo = await getWABAPhoneNumbers(wabaInfo.wabaId, accessToken);
        phoneNumberId = phoneInfo.phoneNumberId || "";
        phoneNumber = phoneInfo.phoneNumber || "";
      }

      // Validation: waba_id ve phone_id zorunlu — null yazılmasına izin verme
      if (!wabaInfo.wabaId || !phoneNumberId) {
        console.error("[exchange-token] Critical IDs missing after all resolution attempts", {
          wabaId: wabaInfo.wabaId || "MISSING",
          phoneNumberId: phoneNumberId || "MISSING",
          agencyId,
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: "Could not retrieve phone number or WABA ID from Meta. Please contact support.",
            needsManualSetup: true,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // L5: Meta yanıtı defansif TRIM (Meta normalde clean döner ama belt-and-suspenders;
      // bugün trailing-space sorunu DB'de manuel girilen bir kayıttan geldi ama buradan
      // da gelebileceği için aynı temizliği uygula).
      const cleanWabaId = String(wabaInfo.wabaId).trim();
      const cleanPhoneNumberId = String(phoneNumberId).trim();
      const cleanPhoneNumber = phoneNumber ? String(phoneNumber).trim() : "";

      // L2: DUPLICATE ÖN-KONTROL — aynı meta_phone_number_id BAŞKA acentede zaten var mı?
      // UNIQUE constraint (L1) DB seviyesinde de yakalar ama burada erkenden anlamlı hata mesajı veririz.
      // Mevcut acentenin kendi numarası tekrar bağlanırsa OK (sadece UPDATE).
      const { data: conflictAgencies, error: conflictErr } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("meta_phone_number_id", cleanPhoneNumberId)
        .neq("id", agencyId);

      if (conflictErr) {
        console.error("[exchange-token] L2 duplicate check query error:", conflictErr.message);
        // Query hatası → yine de devam etme (DB seviyesi UNIQUE yakalar)
        return new Response(
          JSON.stringify({ success: false, error: "DB query failed during duplicate check" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (conflictAgencies && conflictAgencies.length > 0) {
        const _conflictNames = conflictAgencies.map((a: any) => a.name).join(", ");
        console.warn(`[exchange-token] L2: phone_number_id ${cleanPhoneNumberId} already used by: ${_conflictNames}`);
        // L2: 200 + success:false + errorCode pattern — Supabase functions.invoke 4xx'i
        // 'error' field'ına çevirip body'i kaybedebiliyor (K1 send-template-message'da
        // aynı sorun yaşandı). 200 ile body kontrolü frontend için daha güvenilir.
        return new Response(
          JSON.stringify({
            success: false,
            error: "This WhatsApp number is already registered to another agency. Please disconnect it from that agency first.",
            errorCode: "DUPLICATE_PHONE_NUMBER",
            conflictAgencies: conflictAgencies.map((a: any) => ({ id: a.id, name: a.name })),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 6: Webhook subscription — retry'lı + doğrulamalı
      let webhookSubscribed = false;
      webhookSubscribed = await subscribeAppToWabaWithRetry(cleanWabaId, accessToken);

      if (!webhookSubscribed) {
        console.error(`[exchange-token] Webhook subscription FAILED for agency ${agencyId}, WABA ${cleanWabaId}`);
      }

      // Step 5: Save to agency — her iki ID garanti dolu, TRIM edilmiş, duplicate yok.
      const updateData: Record<string, any> = {
        meta_access_token: accessToken,
        meta_waba_id: cleanWabaId,
        meta_phone_number_id: cleanPhoneNumberId,
        whatsapp_phone_number: cleanPhoneNumber || null,
        whatsapp_status: "active",
        whatsapp_connected_at: new Date().toISOString(),
        webhook_subscribed: webhookSubscribed,
      };

      const { error: updateError } = await supabase
        .from("agencies")
        .update(updateData)
        .eq("id", agencyId);

      if (updateError) {
        console.error("❌ Failed to save credentials:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to save credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Also update whatsapp_integrations if exists — TRIM'li değerlerle
      await supabase
        .from("whatsapp_integrations")
        .update({
          status: "active",
          meta_access_token: accessToken,
          meta_waba_id: cleanWabaId || null,
          meta_phone_number_id: cleanPhoneNumberId || null,
          whatsapp_phone: cleanPhoneNumber || null,
          activated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId);

      // Step 7: Phone number'ı Cloud API'ye register et (non-blocking) — TRIM'li phoneNumberId
      let registerStatus = "skipped";
      let needsManualPin = false;

      if (cleanPhoneNumberId) {
        try {
          const registerRes = await fetch(
            `https://graph.facebook.com/v18.0/${cleanPhoneNumberId}/register`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                pin: "000000",
              }),
            }
          );
          const registerData = await registerRes.json();

          if (registerRes.ok && registerData?.success) {
            console.log("✅ Phone number registered successfully:", cleanPhoneNumberId);
            registerStatus = "success";
          } else {
            const errCode = registerData?.error?.code;
            const errMsg = (registerData?.error?.message || "").toLowerCase();
            console.warn("⚠️ Register failed:", JSON.stringify(registerData));

            if (errMsg.includes("already registered") || errCode === 133010) {
              registerStatus = "already_registered";
            } else if (errCode === 133005 || errCode === 133006 || errCode === 100) {
              // PIN uyuşmazlığı veya 2FA zorunlu
              needsManualPin = true;
              registerStatus = "needs_pin";
            } else {
              registerStatus = "failed";
            }
          }
        } catch (regErr) {
          console.warn("⚠️ Register exception (non-blocking):", regErr);
          registerStatus = "failed";
        }
      }

      console.log(`✅ Embedded Signup completed for agency: ${agencyId} | register: ${registerStatus}`);

      return new Response(
        JSON.stringify({
          success: true,
          // L5: response'ta da clean değerler — frontend her zaman trimmed alır
          phoneNumber: cleanPhoneNumber,
          phoneNumberId: cleanPhoneNumberId,
          wabaId: cleanWabaId,
          registerStatus,
          needsManualPin,
          webhookSubscribed,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Disconnect WhatsApp — Meta bilgilerini temizle
    if (action === "disconnect") {
      const { agencyId } = body;

      if (!agencyId) {
        return new Response(
          JSON.stringify({ error: "agencyId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Agency sahipliği doğrula
      const { data: agencyCheck } = await supabase
        .from("agencies")
        .select("id")
        .eq("id", agencyId)
        .eq("user_id", user.id)
        .single();

      if (!agencyCheck) {
        return new Response(
          JSON.stringify({ error: "Agency not found or unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: agencyError } = await supabase
        .from("agencies")
        .update({
          meta_access_token: null,
          meta_phone_number_id: null,
          meta_waba_id: null,
          whatsapp_phone_number: null,
          whatsapp_status: "pending",
          whatsapp_connected_at: null,
        })
        .eq("id", agencyId);

      if (agencyError) {
        console.error("[disconnect] Agency update failed:", agencyError);
        return new Response(
          JSON.stringify({ error: "Failed to disconnect" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // whatsapp_integrations tablosunu da temizle
      await supabase
        .from("whatsapp_integrations")
        .update({ status: "pending", meta_access_token: null, meta_phone_number_id: null, meta_waba_id: null, whatsapp_phone: null })
        .eq("agency_id", agencyId);

      console.info("[disconnect] WhatsApp disconnected for agency:", agencyId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Acente girdiği PIN ile register tekrar dener
    if (action === "register-with-pin") {
      const { agencyId, pin } = body;

      if (!agencyId || !pin) {
        return new Response(
          JSON.stringify({ error: "agencyId and pin required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!/^\d{6}$/.test(pin)) {
        return new Response(
          JSON.stringify({ error: "PIN must be exactly 6 digits" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: agency, error: agencyErr } = await supabase
        .from("agencies")
        .select("id, user_id, meta_phone_number_id, meta_access_token")
        .eq("id", agencyId)
        .eq("user_id", user.id)
        .single();

      if (agencyErr || !agency) {
        return new Response(
          JSON.stringify({ error: "Agency not found or unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!agency.meta_phone_number_id) {
        return new Response(
          JSON.stringify({ error: "No phone number ID found for this agency" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = agency.meta_access_token || Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      if (!token) {
        return new Response(
          JSON.stringify({ error: "No access token available" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const registerRes = await fetch(
        `https://graph.facebook.com/v18.0/${agency.meta_phone_number_id}/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messaging_product: "whatsapp", pin }),
        }
      );
      const registerData = await registerRes.json();

      if (registerRes.ok && registerData?.success) {
        console.log("✅ Phone registered with manual PIN for agency:", agencyId);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errMsg = registerData?.error?.message || "Register failed";
      console.warn("⚠️ Manual PIN register failed:", JSON.stringify(registerData));
      return new Response(
        JSON.stringify({ success: false, error: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mevcut bozuk acenteleri kurtarır: subscribed_apps + register yeniden tetikler
    if (action === "repair-subscription") {
      const { agencyId } = body;

      if (!agencyId) {
        return new Response(
          JSON.stringify({ error: "agencyId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: repairAgency } = await supabase
        .from("agencies")
        .select("id, user_id, meta_waba_id, meta_phone_number_id, meta_access_token")
        .eq("id", agencyId)
        .eq("user_id", user.id)
        .single();

      if (!repairAgency) {
        return new Response(
          JSON.stringify({ error: "Agency not found or unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!repairAgency.meta_waba_id) {
        return new Response(
          JSON.stringify({ error: "No WABA ID configured — run Embedded Signup first" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const repairToken = repairAgency.meta_access_token || Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      if (!repairToken) {
        return new Response(
          JSON.stringify({ error: "No access token available" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 1. Subscribe (retry'lı)
      console.info(`[repair] Starting for agency ${agencyId}, WABA ${repairAgency.meta_waba_id}`);
      const subscribed = await subscribeAppToWabaWithRetry(repairAgency.meta_waba_id, repairToken);

      // 2. Register (phone varsa)
      let registered = false;
      if (repairAgency.meta_phone_number_id) {
        try {
          const regRes = await fetch(
            `https://graph.facebook.com/v18.0/${repairAgency.meta_phone_number_id}/register`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${repairToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ messaging_product: "whatsapp", pin: "000000" }),
            }
          );
          const regData = await regRes.json();
          // already_registered (133010) = başarılı say
          registered = regRes.ok || regData?.error?.code === 133010 ||
            (regData?.error?.message || "").toLowerCase().includes("already registered");
          if (!registered) {
            console.warn("[repair] Register failed:", JSON.stringify(regData));
          }
        } catch (regErr) {
          console.warn("[repair] Register exception:", regErr);
        }
      }

      // DB flag güncelle
      await supabase.from("agencies")
        .update({ webhook_subscribed: subscribed })
        .eq("id", agencyId);

      console.info(`[repair] Done — subscribed=${subscribed} registered=${registered}`);

      return new Response(
        JSON.stringify({ success: true, subscribed, registered }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Meta Embedded Signup error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Get shared WABA info from the Embedded Signup flow.
 *
 * Strategy 1 — debug_token granular_scopes (en güvenilir Embedded Signup yöntemi):
 *   App token ile /debug_token?input_token=USER_TOKEN&fields=granular_scopes
 *   whatsapp_business_management scope'unun target_ids → WABA ID'leri
 *
 * Strategy 2 — /me/owned_whatsapp_business_accounts (System User token için çalışır)
 * Strategy 3 — /me/client_whatsapp_business_accounts (shared WABAs)
 */
async function getSharedWABAInfo(
  accessToken: string,
  appId: string,
  appSecret: string
): Promise<{ wabaId: string }> {
  try {
    // ── Strategy 1: debug_token granular_scopes ──────────────────────────────
    try {
      const appToken = `${appId}|${appSecret}`;
      const debugRes = await fetch(
        `https://graph.facebook.com/v18.0/debug_token?input_token=${accessToken}&access_token=${encodeURIComponent(appToken)}&fields=granular_scopes`
      );
      const debugData = await debugRes.json();
      const wabaScope = (debugData?.data?.granular_scopes as any[] || [])
        .find((s: any) => s.scope === "whatsapp_business_management");

      if (wabaScope?.target_ids?.[0]) {
        const wabaId = String(wabaScope.target_ids[0]);
        console.log("✅ [waba-discovery] debug_token granular_scopes → WABA:", wabaId);
        return { wabaId };
      }
      console.warn("⚠️ [waba-discovery] debug_token: no whatsapp_business_management target_ids", debugData?.data);
    } catch (dbgErr) {
      console.warn("⚠️ [waba-discovery] debug_token failed:", dbgErr);
    }

    // ── Strategy 2 & 3: /me + owned/client endpoints ─────────────────────────
    const meRes = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}`
    );
    const meData = await meRes.json();
    console.log("📘 [waba-discovery] /me →", meData?.id, meData?.name);

    if (!meData?.id) {
      console.warn("⚠️ [waba-discovery] /me returned no id");
      return { wabaId: "" };
    }

    const ownedRes = await fetch(
      `https://graph.facebook.com/v18.0/${meData.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`
    );
    const ownedData = await ownedRes.json();
    if (ownedData?.data?.[0]?.id) {
      console.log("✅ [waba-discovery] owned_whatsapp_business_accounts → WABA:", ownedData.data[0].id);
      return { wabaId: ownedData.data[0].id };
    }
    console.warn("⚠️ [waba-discovery] owned_whatsapp_business_accounts:", ownedData?.error || "empty");

    const clientRes = await fetch(
      `https://graph.facebook.com/v18.0/${meData.id}/client_whatsapp_business_accounts?access_token=${accessToken}`
    );
    const clientData = await clientRes.json();
    if (clientData?.data?.[0]?.id) {
      console.log("✅ [waba-discovery] client_whatsapp_business_accounts → WABA:", clientData.data[0].id);
      return { wabaId: clientData.data[0].id };
    }
    console.warn("⚠️ [waba-discovery] client_whatsapp_business_accounts:", clientData?.error || "empty");

    console.error("❌ [waba-discovery] All strategies failed — WABA ID could not be resolved");
    return { wabaId: "" };
  } catch (error) {
    console.error("❌ [waba-discovery] Exception:", error);
    return { wabaId: "" };
  }
}

/**
 * Get phone numbers registered under a WABA.
 * Öncelik: sandbox olmayan numara (VERIFIED veya PENDING — ikisi de kabul edilir).
 * PENDING numaralar Step 7'de /register ile aktif edilecek.
 * Sandbox (+1 555... veya NOT_APPLICABLE) son çare olarak seçilir.
 */
async function getWABAPhoneNumbers(
  wabaId: string,
  accessToken: string
): Promise<{ phoneNumberId: string; phoneNumber: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type&access_token=${accessToken}`
    );
    const data = await res.json();
    const phones: any[] = data?.data || [];

    console.info(`[phone-resolution] WABA ${wabaId}: ${phones.length} phone(s) found`);
    for (const p of phones) {
      console.info(`[phone-resolution]  → ${p.display_phone_number} | status=${p.code_verification_status} | platform=${p.platform_type}`);
    }

    if (phones.length === 0) {
      console.warn("[phone-resolution] No phones returned from WABA");
      return { phoneNumberId: "", phoneNumber: "" };
    }

    const isSandbox = (p: any) =>
      p.platform_type === "NOT_APPLICABLE" ||
      (p.display_phone_number || "").startsWith("+1 555");

    // VERIFIED şartı kaldırıldı — PENDING de kabul edilir (Step 7 register eder)
    const nonSandbox = phones.filter((p) => !isSandbox(p));
    const best = nonSandbox[0] || phones[0];

    console.info(`[phone-resolution] selected: ${best.display_phone_number} | id=${best.id} | status=${best.code_verification_status}`);

    return {
      phoneNumberId: best.id || "",
      phoneNumber: best.display_phone_number?.replace(/[\s\-+]/g, "") || "",
    };
  } catch (error) {
    console.error("❌ [phone-resolution] Exception:", error);
    return { phoneNumberId: "", phoneNumber: "" };
  }
}
