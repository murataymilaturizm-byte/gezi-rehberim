// Type definitions for WhatsApp webhook

export interface Agency {
  id: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  conversation_style: string | null;
  enabled_languages: string[] | null;
  language_preference: string | null;
}

export interface UserProfile {
  phone: string;
  agency_id: string;
  full_name: string | null;
  language_preference: string | null;
  preferred_destinations: string[] | null;
  preferred_tour_type: string | null;
  budget_range: string | null;
  last_search_query: string | null;
  preferences: any;
  total_messages: number;
}

export interface Tour {
  id: string;
  title: string;
  destination: string;
  type: string;
  currency: string;
  program_kisa: string | null;
  program_url: string | null;
  gezilecek_yerler: string | null;
  dates: TourDate[];
}

export interface TourDate {
  id: string;
  departure_date: string;
  return_date: string | null;
  price_adult: number;
  quota: number;
}

export interface MessageIntent {
  type: 'greeting' | 'tour.list' | 'tour.search' | 'general' | 'reservation.wizard';
  confidence: number;
}

export interface WizardState {
  step: 'tour_selection' | 'date_selection' | 'pax_selection' | 'special_requests' | 'confirmation';
  selected_tour?: Tour;
  selected_date?: TourDate;
  pax_adult?: number;
  pax_child?: number;
  special_requests?: string;
  created_at: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
