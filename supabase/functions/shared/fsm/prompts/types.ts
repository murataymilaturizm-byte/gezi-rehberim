// Prompt system types
export enum Language {
  TR = "tr",
  EN = "en",
  DE = "de",
  RU = "ru",
  AR = "ar",
  FR = "fr",
  ES = "es",
}

export enum Tone {
  STANDART = "standart",
  KURUMSAL = "kurumsal",
  DINAMIK = "dinamik",
  PREMIUM = "premium",
}

export enum Stage {
  GREETING = "GREETING",
  BROWSING = "BROWSING",
  TOUR_SELECTED = "TOUR_SELECTED",
  DATE_SELECTION = "DATE_SELECTION",
  COLLECTING_INFO = "COLLECTING_INFO",
  CONFIRMING = "CONFIRMING",
  COMPLETED = "COMPLETED",
}

export interface PromptContext {
  stage: string;
  collectionStep?: string;
  currentTour?: any;
  reservationInfo: any;
  availableTours: any[];
  language: string;
  tone: string;
  agencyName?: string;
  agencyCity?: string;
  agencyAddress?: string;
  agencyPhone?: string;
  agencyWebsite?: string;
  agencyWorkingHours?: string;
  agencyMapsUrl?: string;
  agencyCancellationPolicy?: string;
  paymentInfo?: string;
  multipleTourMatches?: any[];
}

export type LanguagePrompts = Record<string, string>;
export type TonePrompts = Record<string, Record<string, string>>;
export type StagePromptFunction = (context: PromptContext) => string;
export type StagePrompts = Record<string, Record<string, StagePromptFunction>>;
