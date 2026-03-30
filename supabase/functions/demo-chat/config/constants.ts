// Demo Chat Configuration Constants

export const CONFIG = {
  // Database
  CONVERSATION_HISTORY_LIMIT: 20,
  DEMO_AGENCY_ID: "00000000-0000-0000-0000-000000000000",
  
  // Validation
  MIN_PAX_COUNT: 1,
  MAX_PAX_COUNT: 50,
  
  // Payment
  DEFAULT_DEPOSIT_PERCENTAGE: 30,
  
  // Cache
  AGENCY_DATA_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  
  // AI
  DEFAULT_AI_TEMPERATURE: 0.7,
  AI_TIMEOUT_MS: 12000,
  
  // Source
  SOURCE_CHANNEL: "WHATSAPP",
  DEFAULT_STATUS: "NEW",
  DEFAULT_PAYMENT_STATUS: "UNPAID",
};

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
