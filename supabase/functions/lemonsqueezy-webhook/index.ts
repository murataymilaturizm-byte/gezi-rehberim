import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Variant ID → Plan mapping (sabit) ───────────────────────────────────────
// Güncelleme: Lemon Squeezy Dashboard'dan alınan variant ID'leri
const VARIANT_MAP: Record<number, { plan: string; messageLimit: number; billing: "monthly" | "yearly" }> = {
  1031857: { plan: "starter",      messageLimit: 1000, billing: "monthly" },
  1031887: { plan: "starter",      messageLimit: 1000, billing: "yearly"  },
  1031861: { plan: "professional", messageLimit: 5000, billing: "monthly" },
  1031891: { plan: "professional", messageLimit: 5000, billing: "yearly"  }, // VERIFY: kurumsal yıllık da bu ID'yi verdi
  1031867: { plan: "enterprise",   messageLimit: -1,   billing: "monthly" },
  1031893: { plan: "enterprise",   messageLimit: -1,   billing: "yearly"  },
};

// ─── Yardımcı: HMAC-SHA256 imza doğrulama ───────────────────────────────────
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = new Uint8Array(
      (signature.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)),
    );
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(body));
  } catch {
    return false;
  }
}

// ─── Yardımcı: Agency bul (birden fazla yol ile) ────────────────────────────
async function findAgency(
  supabase: any,
  agencyId?: string,
  lsCustomerId?: number,
  lsSubscriptionId?: string,
): Promise<any | null> {
  if (agencyId) {
    const { data } = await supabase.from("agencies").select("*").eq("id", agencyId).single();
    if (data) return data;
  }
  if (lsCustomerId) {
    const { data } = await supabase
      .from("agencies")
      .select("*")
      .eq("lemonsqueezy_customer_id", String(lsCustomerId))
      .maybeSingle();
    if (data) return data;
  }
  if (lsSubscriptionId) {
    const { data } = await supabase
      .from("agencies")
      .select("*")
      .eq("lemonsqueezy_subscription_id", lsSubscriptionId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

// ─── Event handler'lar ───────────────────────────────────────────────────────

async function handleOrderCreated(supabase: any, payload: any, agencyId?: string) {
  const attrs = payload.data?.attributes ?? {};
  const lsCustomerId: number = attrs.customer_id;

  const agency = await findAgency(supabase, agencyId, lsCustomerId);
  if (!agency) {
    console.warn("LS_ORDER_CREATED_NO_AGENCY", { agencyId, lsCustomerId });
    return;
  }

  // Müşteri ID'sini kaydet (henüz kaydedilmediyse)
  if (!agency.lemonsqueezy_customer_id) {
    await supabase
      .from("agencies")
      .update({ lemonsqueezy_customer_id: String(lsCustomerId) })
      .eq("id", agency.id);
    console.info("LS_CUSTOMER_ID_SAVED", { agencyId: agency.id, lsCustomerId });
  }
}

async function handleSubscriptionCreated(supabase: any, payload: any, agencyId?: string) {
  const attrs = payload.data?.attributes ?? {};
  const lsSubscriptionId: string = String(payload.data?.id ?? "");
  const lsCustomerId: number = attrs.customer_id;
  const variantId: number = attrs.variant_id;
  const renewsAt: string | null = attrs.renews_at;

  const planInfo = VARIANT_MAP[variantId];
  if (!planInfo) {
    console.error("LS_UNKNOWN_VARIANT", { variantId });
    return;
  }

  const agency = await findAgency(supabase, agencyId, lsCustomerId, lsSubscriptionId);
  if (!agency) {
    console.error("LS_SUBSCRIPTION_CREATED_NO_AGENCY", { agencyId, lsCustomerId });
    return;
  }

  const subscriptionEndsAt = renewsAt ?? (() => {
    const d = new Date();
    planInfo.billing === "yearly" ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  })();

  await supabase.from("agencies").update({
    subscription_status:          "active",
    plan_type:                    planInfo.plan,
    subscription_ends_at:         subscriptionEndsAt,
    trial_ends_at:                null,
    message_limit:                planInfo.messageLimit,
    lemonsqueezy_customer_id:     String(lsCustomerId),
    lemonsqueezy_subscription_id: lsSubscriptionId,
    lemonsqueezy_variant_id:      String(variantId),
  }).eq("id", agency.id);

  await supabase.from("subscription_history").insert({
    agency_id:      agency.id,
    event_type:     "subscription_activated",
    plan_type:      planInfo.plan,
    status:         "success",
    payment_method: "credit_card",
    notes:          `Lemon Squeezy abonelik başlatıldı: ${planInfo.plan} (${planInfo.billing})`,
  });

  console.info("LS_SUBSCRIPTION_CREATED", { agencyId: agency.id, plan: planInfo.plan, billing: planInfo.billing });
}

async function handleSubscriptionUpdated(supabase: any, payload: any, agencyId?: string) {
  const attrs = payload.data?.attributes ?? {};
  const lsSubscriptionId: string = String(payload.data?.id ?? "");
  const lsCustomerId: number = attrs.customer_id;
  const variantId: number = attrs.variant_id;
  const renewsAt: string | null = attrs.renews_at;
  const lsStatus: string = attrs.status; // active, cancelled, expired, vb.

  const planInfo = VARIANT_MAP[variantId];

  const agency = await findAgency(supabase, agencyId, lsCustomerId, lsSubscriptionId);
  if (!agency) {
    console.warn("LS_SUBSCRIPTION_UPDATED_NO_AGENCY", { agencyId, lsSubscriptionId });
    return;
  }

  const update: Record<string, any> = {
    lemonsqueezy_variant_id: String(variantId),
  };

  if (planInfo) {
    update.plan_type     = planInfo.plan;
    update.message_limit = planInfo.messageLimit;
  }

  if (renewsAt) {
    update.subscription_ends_at = renewsAt;
  }

  // LS status'ü aktif ise subscription_status'ü koru, değilse güncelle
  if (lsStatus === "active") {
    update.subscription_status = "active";
  } else if (lsStatus === "cancelled") {
    update.subscription_status = "cancelled";
  }

  await supabase.from("agencies").update(update).eq("id", agency.id);

  if (planInfo) {
    await supabase.from("subscription_history").insert({
      agency_id:  agency.id,
      event_type: "plan_changed",
      plan_type:  planInfo.plan,
      status:     "success",
      notes:      `Lemon Squeezy plan güncellendi: ${planInfo.plan} (${planInfo.billing})`,
    });
  }

  console.info("LS_SUBSCRIPTION_UPDATED", { agencyId: agency.id, variantId, lsStatus });
}

async function handleSubscriptionCancelled(supabase: any, payload: any, agencyId?: string) {
  const attrs = payload.data?.attributes ?? {};
  const lsSubscriptionId: string = String(payload.data?.id ?? "");
  const lsCustomerId: number = attrs.customer_id;

  const agency = await findAgency(supabase, agencyId, lsCustomerId, lsSubscriptionId);
  if (!agency) {
    console.warn("LS_SUBSCRIPTION_CANCELLED_NO_AGENCY", { agencyId, lsSubscriptionId });
    return;
  }

  await supabase.from("agencies").update({ subscription_status: "cancelled" }).eq("id", agency.id);

  await supabase.from("subscription_history").insert({
    agency_id:  agency.id,
    event_type: "subscription_cancelled",
    plan_type:  agency.plan_type,
    status:     "success",
    notes:      "Lemon Squeezy üzerinden abonelik iptal edildi",
  });

  console.info("LS_SUBSCRIPTION_CANCELLED", { agencyId: agency.id });
}

async function handleSubscriptionExpired(supabase: any, payload: any, agencyId?: string) {
  const attrs = payload.data?.attributes ?? {};
  const lsSubscriptionId: string = String(payload.data?.id ?? "");
  const lsCustomerId: number = attrs.customer_id;

  const agency = await findAgency(supabase, agencyId, lsCustomerId, lsSubscriptionId);
  if (!agency) {
    console.warn("LS_SUBSCRIPTION_EXPIRED_NO_AGENCY", { agencyId, lsSubscriptionId });
    return;
  }

  await supabase.from("agencies").update({
    subscription_status: "expired",
    message_limit:       0,
  }).eq("id", agency.id);

  await supabase.from("subscription_history").insert({
    agency_id:  agency.id,
    event_type: "subscription_expired",
    plan_type:  agency.plan_type,
    status:     "success",
    notes:      "Lemon Squeezy abonelik süresi doldu",
  });

  console.info("LS_SUBSCRIPTION_EXPIRED", { agencyId: agency.id });
}

async function handlePaymentSuccess(
  supabase: any,
  payload: any,
  agencyId: string | undefined,
  eventId: string,
) {
  const attrs = payload.data?.attributes ?? {};
  const lsSubscriptionId: string = String(payload.data?.id ?? "");
  const lsCustomerId: number = attrs.customer_id;
  const renewsAt: string | null = attrs.renews_at;
  const total: number = attrs.total ?? 0;
  const currency: string = attrs.currency ?? "TRY";

  const agency = await findAgency(supabase, agencyId, lsCustomerId, lsSubscriptionId);
  if (!agency) {
    console.warn("LS_PAYMENT_SUCCESS_NO_AGENCY", { agencyId, lsSubscriptionId });
    return;
  }

  // subscription_ends_at uzat
  if (renewsAt) {
    await supabase.from("agencies").update({
      subscription_status:  "active",
      subscription_ends_at: renewsAt,
    }).eq("id", agency.id);
  }

  // Ödeme kaydı — idempotency event_id ile sağlanır
  await supabase.from("payment_transactions").insert({
    agency_id:      agency.id,
    order_id:       `LS-${eventId}`,
    plan_type:      agency.plan_type,
    amount:         total / 100, // LS cent cinsinden verir
    currency,
    is_yearly:      agency.lemonsqueezy_variant_id
                      ? [String(1031887), String(1031891), String(1031893)].includes(agency.lemonsqueezy_variant_id)
                      : false,
    status:         "completed",
    transaction_id: lsSubscriptionId,
  });

  await supabase.from("subscription_history").insert({
    agency_id:      agency.id,
    event_type:     "payment_success",
    plan_type:      agency.plan_type,
    amount:         total / 100,
    currency,
    payment_method: "credit_card",
    status:         "success",
    notes:          "Lemon Squeezy abonelik ödemesi başarılı",
  });

  console.info("LS_PAYMENT_SUCCESS", { agencyId: agency.id, amount: total / 100, currency });
}

async function handlePaymentFailed(
  supabase: any,
  payload: any,
  agencyId: string | undefined,
  eventId: string,
) {
  const attrs = payload.data?.attributes ?? {};
  const lsSubscriptionId: string = String(payload.data?.id ?? "");
  const lsCustomerId: number = attrs.customer_id;
  const total: number = attrs.total ?? 0;
  const currency: string = attrs.currency ?? "TRY";

  const agency = await findAgency(supabase, agencyId, lsCustomerId, lsSubscriptionId);
  if (!agency) {
    console.warn("LS_PAYMENT_FAILED_NO_AGENCY", { agencyId, lsSubscriptionId });
    return;
  }

  await supabase.from("payment_transactions").insert({
    agency_id:      agency.id,
    order_id:       `LS-${eventId}`,
    plan_type:      agency.plan_type,
    amount:         total / 100,
    currency,
    is_yearly:      false,
    status:         "failed",
    transaction_id: lsSubscriptionId,
  });

  await supabase.from("subscription_history").insert({
    agency_id:  agency.id,
    event_type: "payment_failed",
    plan_type:  agency.plan_type,
    status:     "failed",
    notes:      "Lemon Squeezy abonelik ödemesi başarısız — LS retry yapacak",
  });

  console.error("LS_PAYMENT_FAILED", { agencyId: agency.id });
}

// ─── Ana handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("X-Signature") ?? "";
  const webhookSecret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";

  const isValid = await verifySignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    console.error("LS_INVALID_SIGNATURE");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const eventName: string = payload.meta?.event_name ?? "";
  const eventId: string   = payload.meta?.webhook_id ?? `${eventName}-${Date.now()}`;
  const agencyId: string | undefined = payload.meta?.custom_data?.agency_id;

  console.info("LS_WEBHOOK_RECEIVED", { eventName, eventId, agencyId });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency: payment olayları için aynı event tekrar işlenmesin
  if (eventName === "subscription_payment_success" || eventName === "subscription_payment_failed") {
    const { data: existing } = await supabase
      .from("payment_transactions")
      .select("id")
      .eq("order_id", `LS-${eventId}`)
      .maybeSingle();

    if (existing) {
      console.info("LS_EVENT_DUPLICATE_SKIP", { eventId });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  }

  try {
    switch (eventName) {
      case "order_created":                await handleOrderCreated(supabase, payload, agencyId); break;
      case "subscription_created":         await handleSubscriptionCreated(supabase, payload, agencyId); break;
      case "subscription_updated":         await handleSubscriptionUpdated(supabase, payload, agencyId); break;
      case "subscription_cancelled":       await handleSubscriptionCancelled(supabase, payload, agencyId); break;
      case "subscription_expired":         await handleSubscriptionExpired(supabase, payload, agencyId); break;
      case "subscription_payment_success": await handlePaymentSuccess(supabase, payload, agencyId, eventId); break;
      case "subscription_payment_failed":  await handlePaymentFailed(supabase, payload, agencyId, eventId); break;
      default: console.info("LS_EVENT_UNHANDLED", { eventName });
    }
  } catch (error) {
    // Hata olsa bile 200 dön — LS tekrar göndermsin, biz log'dan düzeltiriz
    console.error("LS_HANDLER_ERROR", { eventName, eventId, error: String(error) });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
