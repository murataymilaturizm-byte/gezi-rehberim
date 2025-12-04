// Demo Chat Edge Function - Modular FSM v3.1.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleChatRequest } from "./handlers/chat-handler.ts";
import { createErrorResponse } from "./handlers/error-handler.ts";
import { corsHeaders } from "./config/constants.ts";
import { logger } from "./utils/logger.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    return await handleChatRequest(req);
  } catch (error) {
    logger.error("Unhandled error in demo-chat", error);
    return createErrorResponse("UNKNOWN", 500, "tr", error);
  }
});
