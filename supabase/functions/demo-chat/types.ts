// Type definitions for demo chat

export interface MessageIntent {
  type: 'greeting' | 'tour.list' | 'tour.search' | 'tour.detail' | 'reservation.wizard' | 'general' | 'question' | 'price.inquiry' | 'cancel';
  confidence: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DemoConversationState {
  currentStage: 'initial' | 'exploring' | 'interested' | 'deciding' | 'booking';
  lastIntent: string;
  currentTour: {
    id: string;
    title: string;
    destination: string;
    dateId?: string;
  } | null;
  previousTour: {
    id: string;
    title: string;
    destination: string;
    dateId?: string;
  } | null;
  discussedTours: string[];
  lastUserMessage: string;
  conversationFlow: string[];
  userMemory?: any;
}
