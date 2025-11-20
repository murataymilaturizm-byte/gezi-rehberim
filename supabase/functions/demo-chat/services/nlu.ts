// Natural Language Understanding service
import { callAI } from './ai.ts';

export interface NLUResult {
  intent: string;
  language: string;
  entities: {
    destination: string | null;
    tour_name: string | null;
    tour_id: string | null;
    date: string | null;
    date_range: {
      start: string | null;
      end: string | null;
    } | null;
    adults: number | null;
    children: number | null;
  };
  updates: {
    is_correction: boolean;
    fields_changed: string[];
  };
  clarification_needed: boolean;
  clarification_question: string | null;
}

const NLU_SYSTEM_PROMPT = `ROLÜN
Sen bir tur acentası sohbet sisteminin "anlama motoru"sun.
Kullanıcının mesajını ve sana verilen önceki özet bilgileri okuyup;
- NİYETİ (intent)
- DİLİ (language)
- TUR / TARİH / KİŞİ SAYISI gibi VARLIKLARI (entities)
- Bir DÜZELTME olup olmadığını (updates)
JSON formatında döndürürsün.

KULLANIM
- SEN KULLANICIYA KESİNLİKLE MESAJ YAZMAZSIN.
- SADECE TEK BİR GEÇERLİ JSON NESNESİ DÖNDÜRÜRSÜN.
- JSON dışında hiçbir açıklama, metin, yorum, markdown yazma.

1) intent
Aşağıdaki değerlerden BİRİNİ seç:
- "tur_bilgi"        → Turlar hakkında genel bilgi istiyor
- "tur_listeleme"    → Tüm turları veya bir bölgedeki turları görmek istiyor
- "tur_secim"        → Belirli bir turu seçiyor
- "tarih_secim"      → Tarih seçiyor, tarih soruyor veya tarih değiştiriyor
- "kisi_sayisi"      → Kaç kişi katılacağını söylüyor veya soruyor
- "kayit_baslatma"   → "Kayıt olmak istiyorum", "rezervasyon yapalım"
- "kayit_onay"       → Özet bilgileri onaylıyor
- "genel_soru"       → Fiyat, vize, iptal, ödeme gibi genel sorular
- "diger"            → Tur dışı veya anlaması güç mesajlar

2) language: ISO dil kodu (tr, en, ru, de, ar, fr, es)

3) entities:
- destination: "Kapadokya", "Balkanlar" vb. Yoksa null
- tour_name: Turun adı. Yoksa null
- tour_id: Eğer available_tours'dan çıkarabiliyorsan. Yoksa null
- date: ISO 8601 format. Yoksa null
- date_range: {start, end} ISO 8601. Yoksa null
- adults / children: Sayı. Yoksa null

4) updates:
- is_correction: Kullanıcı önceki bilgiyi değiştiriyorsa true
- fields_changed: ["date", "adults", ...] veya []

5) clarification_needed ve clarification_question:
- Belirsizlik varsa true ve kısa soru metni
- Yoksa false ve null

ÜRETECEĞİN JSON ŞEMASI:
{
  "intent": "string",
  "language": "string",
  "entities": {
    "destination": "string or null",
    "tour_name": "string or null",
    "tour_id": "string or null",
    "date": "ISO 8601 or null",
    "date_range": {"start": "ISO 8601 or null", "end": "ISO 8601 or null"} or null,
    "adults": "integer or null",
    "children": "integer or null"
  },
  "updates": {
    "is_correction": "boolean",
    "fields_changed": ["array of strings"]
  },
  "clarification_needed": "boolean",
  "clarification_question": "string or null"
}

ÇIKIŞ KURALI: HER ZAMAN SADECE GEÇERLİ BİR JSON NESNESİ DÖNDÜR. JSON DIŞINDA HİÇBİR METİN YAZMA.`;

export async function analyzeUserMessage(
  userMessage: string,
  conversationSummary?: string,
  currentState?: string,
  selectedTour?: any,
  availableTours?: any[]
): Promise<NLUResult> {
  // Build context for NLU
  let contextPrompt = `user_message: "${userMessage}"`;
  
  if (conversationSummary) {
    contextPrompt += `\nconversation_summary: ${conversationSummary}`;
  }
  
  if (currentState) {
    contextPrompt += `\ncurrent_state: ${currentState}`;
  }
  
  if (selectedTour) {
    contextPrompt += `\nselected_tour: ${JSON.stringify({
      id: selectedTour.id,
      title: selectedTour.title,
      destination: selectedTour.destination
    })}`;
  }
  
  if (availableTours && availableTours.length > 0) {
    contextPrompt += `\navailable_tours: ${JSON.stringify(
      availableTours.map(t => ({
        id: t.id,
        title: t.title,
        destination: t.destination
      }))
    )}`;
  }

  // Use tool calling to ensure valid JSON response
  const tools = [
    {
      type: "function",
      function: {
        name: "return_nlu_result",
        description: "Return the NLU analysis result as JSON",
        parameters: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["tur_bilgi", "tur_listeleme", "tur_secim", "tarih_secim", "kisi_sayisi", "kayit_baslatma", "kayit_onay", "genel_soru", "diger"]
            },
            language: {
              type: "string"
            },
            entities: {
              type: "object",
              properties: {
                destination: { type: ["string", "null"] },
                tour_name: { type: ["string", "null"] },
                tour_id: { type: ["string", "null"] },
                date: { type: ["string", "null"] },
                date_range: {
                  type: ["object", "null"],
                  properties: {
                    start: { type: ["string", "null"] },
                    end: { type: ["string", "null"] }
                  }
                },
                adults: { type: ["integer", "null"] },
                children: { type: ["integer", "null"] }
              },
              required: ["destination", "tour_name", "tour_id", "date", "date_range", "adults", "children"],
              additionalProperties: false
            },
            updates: {
              type: "object",
              properties: {
                is_correction: { type: "boolean" },
                fields_changed: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["is_correction", "fields_changed"],
              additionalProperties: false
            },
            clarification_needed: { type: "boolean" },
            clarification_question: { type: ["string", "null"] }
          },
          required: ["intent", "language", "entities", "updates", "clarification_needed", "clarification_question"],
          additionalProperties: false
        }
      }
    }
  ];

  const messages = [
    { role: 'system', content: NLU_SYSTEM_PROMPT },
    { role: 'user', content: contextPrompt }
  ];

  try {
    const response = await callAI(messages, 0.3, tools, { type: "function", function: { name: "return_nlu_result" } });
    
    // Response will have tool_calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolCall = response.tool_calls[0];
      const result = JSON.parse(toolCall.function.arguments);
      
      console.log('🧠 NLU Result:', JSON.stringify(result, null, 2));
      
      return result as NLUResult;
    }
    
    throw new Error('No tool call in NLU response');
    
  } catch (error) {
    console.error('❌ NLU Error:', error);
    
    // Fallback: return basic intent
    return {
      intent: 'diger',
      language: 'tr',
      entities: {
        destination: null,
        tour_name: null,
        tour_id: null,
        date: null,
        date_range: null,
        adults: null,
        children: null
      },
      updates: {
        is_correction: false,
        fields_changed: []
      },
      clarification_needed: false,
      clarification_question: null
    };
  }
}

// Map NLU intent to FSM intent
export function mapNLUIntentToFSMIntent(nluIntent: string): string {
  const mapping: Record<string, string> = {
    'tur_bilgi': 'general.inquiry',
    'tur_listeleme': 'tour.list',
    'tur_secim': 'tour.selection',
    'tarih_secim': 'date.selection',
    'kisi_sayisi': 'info.provided',
    'kayit_baslatma': 'reservation.start',
    'kayit_onay': 'confirmation',
    'genel_soru': 'general.inquiry',
    'diger': 'general'
  };
  
  return mapping[nluIntent] || 'general';
}
