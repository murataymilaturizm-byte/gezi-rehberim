// Shared FSM type definitions for demo-chat and whatsapp-webhook

export type ConversationStage =
  | 'GREETING'        // İlk karşılama
  | 'BROWSING'        // Tur gezintisi
  | 'TOUR_SELECTED'   // Tur seçildi
  | 'COLLECTING_INFO' // Tarih / kişi / isim / telefon toplama
  | 'CONFIRMING'      // Onay bekleniyor
  | 'COMPLETED';      // Rezervasyon tamamlandı

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
  | 'waiting_for_email'     // Opsiyonel — acente collect_email=true ise
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
  email?: string;           // Opsiyonel — acente collect_email=true ise toplanır
  emailSkipped?: boolean;   // Müşteri "geç" derse true
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

  // Agency's email collection setting — mirrored into context to drive FSM
  collectEmail?: boolean;
  
  // Language & Style
  language: string; // tr, en, de, ru, ar, fr, es
  tone: ConversationTone; // standart, kurumsal, dinamik, premium
  detectedLanguage?: string; // Auto-detected language from first message
  
  // Conversation metadata
  messageCount: number;
  lastUserMessage: string;
  sessionStarted: string;
  lastUpdated: string;

  // 2026-06-24 FIX A1 — History cutoff (S1/S2/S3 conversation history kirlenmesi).
  // CONFIRMING→COMPLETED transition action'da onay anının timestamp'i set edilir.
  // adapter.loadHistory(limit, since) bu zamandan SONRAKİ mesajları döner →
  // NLU/LLM eski rezervasyonun history'sini görmez. Yeni rezervasyon kendi
  // adımlarını eksiksiz görür (kendi mesajları cutoff sonrası).
  // resetForNewReservation bu alanı DÖNDÜRMEZ → spread sırasında korunur.
  // Yeni rezervasyon onaylanırsa yeni cutoff timestamp'iyle güncellenir.
  historyCutoffAt?: string;

  // 2026-07-09 FAZ3-P3 (V2-b + V3-anafora): tarih ÖNERİ-context'i. "farketmez"
  // / "öbür tarih" gibi mesajlarda bot tekil tarih ÖNERİR + onay ister; önerilen
  // dateId burada tutulur ki sonraki turn'de "evet" gelince hangi tarihin
  // önerildiği bilinsin. Onay işlenince veya başka değer gelince temizlenir.
  // Yeni pending-STATE değil — tek alanlık öneri hafızası.
  proposedDateId?: string;
  proposedDate?: string; // görsel/ack için ISO

  // 2026-07-09 FAZ3-P4 (V11-a): telefon-yok politika dalı state'i. waiting_for_phone'da
  // "numaram yok/mail atsam" → nazik politika mesajı (telefon ŞART). Kaç kez ret
  // edildiği sayılır: 1. ret → politika, 2.+ ret → J-14 eskalasyon önerisi
  // (contact_request). phoneEscalationPending: eskalasyon önerildi, "evet" beklenir.
  phoneRefusalCount?: number;
  phoneEscalationPending?: boolean;

  // 2026-07-09 FAZ4-P3 (kalem 5): akış-ortası ASCII dil geçişi — MUHAFAZAKÂR.
  // Uzun/salt-ASCII mesajda char-tespiti çalışmaz (detectLanguage null). NLU
  // language alanı farklı-dil verirse HEMEN geçme (yanlış-tetik: TR kullanıcının
  // İngilizce tur adı yazması). ARDIŞIK 2 turn aynı-farklı-dil + salt-ASCII +
  // enabled şartı: 1. turn bu alana yaz, 2. ardışık turn aynı → sessiz geç.
  // Araya farklı sinyal girerse temizlenir (ardışıklık bozulur). Yalnız
  // context.language değişir — rezervasyon state'ine DOKUNULMAZ.
  pendingLangSwitch?: string;

  // 2026-07-10 A1: 7c belirsiz-tur-değişim listesi basıldığında adaylar buraya
  // yazılır → SONRAKİ mesaj önce liste-seçimi (numara / kısmi ad) olarak denenir
  // (R6 "geçersiz telefon"a yutulmadan — canlı vaka: waiting_for_phone'da
  // "kültür turu" cevabı). Tek-atış: sonraki turn başında değerlendirilip temizlenir.
  pendingTourClarification?: Array<{ id: string; title: string }>;

  // 2026-07-24 §35-6: COMPLETED çıplak-iptal (rezervasyon-kelimesiz) teyit bekleme-
  // durumu. "Rezervasyonunuzu iptal etmek mi istiyorsunuz?" sorulunca set edilir;
  // sonraki turn onay→complaints / ret→geçerli-ack / alakasız→temizle+normal-akış.
  // TEK-TURN-ÖMÜR (proposedDateId deseni). YALNIZ COMPLETED'da set edilebilir →
  // diğer 5 §35 durumuyla mutually-exclusive (onlar COLLECTING'de).
  pendingCancelConfirm?: boolean;

  // 2026-07-25 §35-7 (PAKET-B): CONFIRMING'de düşük-güven alan-değeri için değer-echo
  // teyit bekleme-durumu ("Kişi sayısını 3 yapayım mı?"). TEK-TURN-ömür. YALNIZ CONFIRMING'de
  // set edilebilir → pendingCancelConfirm (COMPLETED) ile stage-ayrımıyla mutually-exclusive.
  pendingFieldUpdateConfirm?: { field: string; value: any; selectedDate?: string };
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
  previousContext?: ConversationContext;
}
