// Type definitions for demo chat

export interface MessageIntent {
  type: 'greeting' | 'tour.list' | 'tour.search' | 'tour.detail' | 'reservation.wizard' | 'general' | 'question' | 'price.inquiry';
  confidence: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
