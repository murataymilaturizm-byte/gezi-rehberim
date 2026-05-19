// invalidate-tour-cache — Admin tur güncelleme sonrası cache temizleme endpoint'i
// Admin panel CRUD action'larından sonra çağrılmalı.
//
// Kullanım (admin panel frontend):
//   await supabase.functions.invoke('invalidate-tour-cache', {
//     body: { agencyId: tour.agency_id }
//   });
//
// GET /invalidate-tour-cache  → cache durumu (debug)
// POST /invalidate-tour-cache { agencyId } → cache temizle

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { invalidateTourCache, getTourCacheStats } from "../shared/utils/tour-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    return new Response(JSON.stringify(getTourCacheStats()), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { agencyId } = body;

    if (!agencyId) {
      return new Response(JSON.stringify({ error: "agencyId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    invalidateTourCache(agencyId, "manual");
    console.log(`[invalidate-tour-cache] Invalidated agency=${agencyId.slice(0, 8)}`);

    return new Response(JSON.stringify({ success: true, agencyId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[invalidate-tour-cache] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
