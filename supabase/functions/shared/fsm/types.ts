// Shared FSM type definitions for demo-chat and whatsapp-webhook

export type ConversationStage = 
  | 'GREETING'                 // Initial greeting
  | 'BROWSING'                 // Browsing tours
  | 'TOUR_SELECTED'            // Specific tour selected
  | 'DATE_SELECTION'           // Selecting date
  | 'COLLECTING_INFO'          // Gathering pax, name, phone
  | 'CONFIRMING'               // Waiting for final confirmation
  | 'COMPLETED'                // Reservation completed
  | 'ASKING_NEW_RESERVATION';  // Asking if user wants to start new reservation

export type ConversationTone = 
  | 'standart'
  | 'kurumsal'
  | 'dinamik'
  | 'premium';

export type InfoCollectionStep =
  | 'waiting_for_date'
  | 'waiting_for_pax'
  | 'waiting_for_name'
  | 'waiting_for_phone'
  | 'ready_for_confirmation';

export interface TourReference {
  id: string;
  title: string;
  destination: string;
  dateId?: string;
  selectedDate?: string;
  dates?: any[]; // Available dates for the tour
  program_kisa?: string;
  gezilecek_yerler?: string;
}

export interface ReservationInfo {
  tourId?: string;
  tourTitle?: string;
  dateId?: string;
  selectedDate?: string;
  paxAdult?: number;
  paxChild?: number;
  fullName?: string;
  phone?: string;
}

export interface ConversationContext {
  // Core state
  stage: ConversationStage;
  collectionStep?: InfoCollectionStep;
  
  // Tour context
  currentTour: TourReference | null;
  viewedTours: string[]; // IDs of tours user has viewed
  
  // Reservation data
  reservationInfo: ReservationInfo;
  reservationConfirmed: boolean;
  paymentInfoSent: boolean;
  
  // New reservation flag - set when starting a new reservation after COMPLETED
  isNewReservation?: boolean;

  // Cancellation flag — set when user cancels mid-flow; handler uses this to send cancellation message without AI
  justCancelled?: boolean;
  
  // Language & Style
  language: string; // tr, en, de, ru, ar, fr, es
  tone: ConversationTone; // standart, kurumsal, dinamik, premium
  detectedLanguage?: string; // Auto-detected language from first message
  
  // Conversation metadata
  messageCount: number;
  lastUserMessage: string;
  sessionStarted: string;
  lastUpdated: string;
}

export interface StateTransition {
  from: ConversationStage;
  to: ConversationStage;
  condition: (context: ConversationContext, input: ProcessingInput) => boolean;
  action?: (context: ConversationContext, input: ProcessingInput) => ConversationContext;
}

export interface ProcessingInput {
  userMessage: string;
  detectedIntent: string;
  extractedInfo: Partial<ReservationInfo>;
  selectedTour: TourReference | null;
  language: string;
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  errors: string[];
}

export interface AIPromptContext {
  stage: ConversationStage;
  collectionStep?: InfoCollectionStep;
  currentTour: TourReference | null;
  reservationInfo: ReservationInfo;
  availableTours: any[];
  language: string;
  tone: ConversationTone;
  agencyName?: string;
  agencyCity?: string;
  paymentInfo?: string;
  agencyAddress?: string;
  agencyPhone?: string;
  agencyWebsite?: string;
  agencyWorkingHours?: string;
  agencyMapsUrl?: string;
  agencyCancellationPolicy?: string;
  multipleTourMatches?: any[]; // When multiple tours match user's query
}
