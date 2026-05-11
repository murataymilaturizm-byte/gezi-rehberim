/**
 * data-export — GDPR Article 20 veri taşınabilirliği
 * Kullanıcının e-posta veya telefon numarasıyla ilişkili verileri JSON olarak döndürür.
 * Hassas alanlar (tam telefon, ödeme bilgileri) maskelenir.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, phone } = await req.json();

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: "Email or phone required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const exportData: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      gdpr_basis: "Article 20 — Right to data portability",
      identifiers: {
        email: email ?? null,
        phone: phone ? `${phone.slice(0, 4)}****${phone.slice(-3)}` : null,
      },
    };

    // ── Rezervasyonlar ────────────────────────────────────────────────────
    if (phone) {
      const { data: regs } = await supabase
        .from("registrations")
        .select(
          "id, tour_id, tour_date_id, full_name, pax, status, payment_status, source_channel, note, created_at",
        )
        .eq("phone", phone)
        .order("created_at", { ascending: false });

      exportData.reservations = (regs ?? []).map((r) => ({
        ...r,
        // telefon zaten lookup key, tekrar gösterme
      }));
    }

    // ── WhatsApp user profile ─────────────────────────────────────────────
    if (phone) {
      const { data: profile } = await supabase
        .from("whatsapp_user_profiles")
        .select("agency_id, full_name, total_bookings, last_interaction_at, created_at")
        .eq("phone", phone)
        .maybeSingle();

      exportData.whatsapp_profile = profile ?? null;
    }

    // ── Konuşma geçmişi (son 50, sadece user+assistant mesajlar) ─────────
    if (phone) {
      const { data: convs } = await supabase
        .from("whatsapp_conversations")
        .select("role, content, created_at")
        .eq("phone", phone)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: false })
        .limit(50);

      exportData.conversation_history = convs ?? [];
    }

    // ── Şikayetler ────────────────────────────────────────────────────────
    if (phone || email) {
      const query = supabase
        .from("complaints")
        .select("type, message, status, created_at");

      if (phone) query.eq("phone", phone);
      else if (email) (query as any).eq("email", email);

      const { data: complaints } = await query;
      exportData.complaints = complaints ?? [];
    }

    // ── Veri silme talepleri ──────────────────────────────────────────────
    {
      const query = supabase
        .from("data_deletion_requests" as any)
        .select("status, created_at");

      if (email) (query as any).eq("email", email);
      else if (phone) (query as any).eq("phone", phone);

      const { data: deletionReqs } = await (query as any);
      exportData.deletion_requests = deletionReqs ?? [];
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[data-export] Error:", err);
    return new Response(
      JSON.stringify({ error: "Export failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
