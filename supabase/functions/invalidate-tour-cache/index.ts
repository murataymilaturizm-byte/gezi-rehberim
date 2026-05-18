// Admin tur CRUD'u sonrası tour cache'ini temizler
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { invalidateTourCache } from "../shared/utils/tour-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { agencyId } = await req.json();
    if (!agencyId) {
      return new Response(JSON.stringify({ error: "agencyId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    invalidateTourCache(agencyId);

    return new Response(JSON.stringify({ success: true, agencyId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[invalidate-tour-cache]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
