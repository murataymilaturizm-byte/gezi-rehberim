// Type definitions for demo chat

export interface MessageIntent {
  type: 'greeting' | 'tour.list' | 'tour.search' | 'tour.detail' | 'reservation.wizard' | 'general' | 'question' | 'price.inquiry';
  confidence: number;
}

export interface WizardState {
  step: 'tour_selection' | 'date_selection' | 'pax_selection' | 'full_name_request' | 'special_requests' | 'confirmation';
  selected_tour?: any;
  selected_date?: any;
  pax_adult?: number;
  pax_child?: number;
  full_name?: string;
  special_requests?: string;
  created_at: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
