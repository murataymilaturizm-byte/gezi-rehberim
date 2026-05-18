import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting rate limit cleanup...');

    // rate_limit_events tablosunu temizle (1 saat TTL)
    const { data: deletedRl, error: rlError } = await supabase.rpc('cleanup_old_rate_limit_events');
    // processed_whatsapp_messages tablosunu temizle (24 saat TTL)
    const { data: deletedPwm, error: pwmError } = await supabase.rpc('cleanup_old_processed_messages');

    if (rlError || pwmError) {
      console.error('Cleanup error:', rlError || pwmError);
      return new Response(
        JSON.stringify({ success: false, error: (rlError || pwmError)?.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Cleanup completed: rate_limit_events=${deletedRl}, processed_messages=${deletedPwm}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: { rate_limit_events: deletedRl, processed_messages: deletedPwm },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Cleanup function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
