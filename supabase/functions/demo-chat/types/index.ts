// Demo Chat Type Definitions

export interface Tour {
  id: string;
  title: string;
  destination: string;
  type: string;
  currency: string;
  dates: TourDate[];
  program_kisa?: string;
  gezilecek_yerler?: string;
  toplanma_saati?: string;
  hareket_noktasi?: string;
  tur_sure?: string;
  ulasim?: string;
  konaklama?: string;
  _raw?: unknown; // Raw tour data for re-localization
}

export interface TourDate {
  id: string;
  departure_date: string;
  return_date?: string;
  price_adult: number;
  price_child?: number;
  price_single?: number;
  quota: number;
}

export interface RequestData {
  message: string;
  sessionId: string;
  conversationState?: unknown;
  conversationStyle?: string;
  inputTooLong?: boolean;
}

export interface AgencyData {
  name: string;
  city?: string;
  address?: string;
  phone_public?: string;
  website_url?: string;
  working_hours?: string;
  maps_url?: string;
  cancellation_policy?: string;
  payment_instructions?: PaymentInstructions | string | null;
  language_currencies?: Record<string, string> | null;
  primary_currency: string;
}

export interface PaymentInstructions {
  text?: string;
  deposit_percentage?: number;
  tr?: BankInfo;
  en?: BankInfo;
  [key: string]: unknown;
}

export interface BankInfo {
  iban?: string;
  bank_name?: string;
  account_holder?: string;
  additional_info?: string;
}

export interface TourMatchResult {
  selectedTour: Tour | null;
  multipleMatches: Tour[];
}

export interface NLUResult {
  intent: string;
  entities: NLUEntities;
  updates: Record<string, unknown>;
}

export interface NLUEntities {
  tour_name?: string;
  destination?: string;
  dates?: string[];
  pax?: number;
  [key: string]: unknown;
}

export interface ExtractedInfo {
  fullName?: string;
  phone?: string;
  paxAdult?: number;
  paxChild?: number;
  selectedDate?: string;
  dateId?: string;
}

export interface ExtractionParams {
  message: string;
  nluEntities: NLUEntities;
  nluUpdates: Record<string, unknown>;
  context: import("../../shared/fsm/types.ts").ConversationContext;
  availableTours: Tour[];
  expectedInput: string;
  detectedIntent: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  response: string;
  conversationState: unknown;
}
