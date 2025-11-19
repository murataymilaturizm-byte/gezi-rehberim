// AI-powered intent detection using tool calling

import { callAI } from './ai.ts';
import type { MessageIntent } from '../types.ts';

const intentDetectionTool = {
  type: "function",
  function: {
    name: "detect_user_intent",
    description: "Analyze user message and conversation history to determine the user's intent and what they want to accomplish",
    parameters: {
      type: "object",
      properties: {
        intent_type: {
          type: "string",
          enum: ["greeting", "tour.list", "tour.search", "tour.detail", "reservation.wizard", "confirmation", "price.inquiry", "general", "question"],
          description: "The detected intent type"
        },
        confidence: {
          type: "number",
          description: "Confidence score between 0 and 1"
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why this intent was chosen"
        },
        context_clues: {
          type: "array",
          items: { type: "string" },
          description: "Key phrases or context that led to this classification"
        }
      },
      required: ["intent_type", "confidence", "reasoning"],
      additionalProperties: false
    }
  }
};

export async function detectIntent(
  userMessage: string,
  conversationHistory: any[],
  userLanguage: string = 'tr'
): Promise<MessageIntent> {
  try {
    // Build context-aware prompt
    const systemPrompt = `Sen bir seyahat acentesi müşteri hizmetleri asistanısın.
Kullanıcının mesajını ve geçmiş konuşma bağlamını analiz ederek niyetini tespit et.

Niyet Türleri:
- greeting: İlk selamlaşma veya merhaba (SADECE İLK MESAJ için)
- tour.list: Tüm tur seçeneklerini görmek istiyor
- tour.search: Belirli bir tur veya destinasyon hakkında bilgi arıyor
- tour.detail: Belirli bir turun detaylarını öğrenmek istiyor
- price.inquiry: Fiyat bilgisi öğrenmek istiyor
- reservation.wizard: Rezervasyon yapmak, ayırtmak, katılmak, kayıt olmak istiyor
- confirmation: Onay veriyor ("evet", "olur", "tamam", "onaylıyorum", "kabul", "isterim" gibi)
- question: Genel sorular (fiyat, tarih, koşullar vs.)
- general: Diğer genel sohbet

🔴 ÖNEMLİ KURALLAR:
1. CONTEXT KULLAN: Eğer önceki mesajlarda turlardan bahsedildiyse, bu greeting DEĞİL!
2. Eğer kullanıcı "rezervasyon", "ayırtmak", "katılmak", "kayıt", "booking" gibi kelimeler kullanıyorsa -> reservation.wizard
3. 🔴 KRİTİK ONAY ALGILAMA: Eğer kullanıcı "evet", "olur", "tamam", "onaylıyorum", "kabul", "isterim" gibi onay kelimeler kullanıyorsa -> confirmation
4. Eğer kullanıcı "turlarınız", "seçenekler", "neler var" gibi genel sorular soruyorsa -> tour.list
5. Eğer kullanıcı belirli bir destinasyon (Kapadokya, Pamukkale vs.) söylüyorsa -> tour.search
6. Eğer kullanıcı "fiyat", "kaç para", "ne kadar" gibi kelimeler kullanıyorsa -> price.inquiry
7. 🔴 HAFIZA: Eğer kullanıcı daha önce yazdıysa ve turlardan bahsedildiyse, bu ASLA greeting olamaz!
8. 🔴 CONTEXT: Eğer asistan soru sordu ve kullanıcı kısa onay veriyorsa (evet, olur, tamam) -> confirmation

Dil: ${userLanguage}`;

    const conversationContext = conversationHistory.length > 0
      ? conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')
      : 'İlk mesaj';

    const userPrompt = `Konuşma Geçmişi:
${conversationContext}

Kullanıcının Son Mesajı: "${userMessage}"

Bu mesajı analiz et ve kullanıcının niyetini tespit et.`;

    const response = await callAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      0.3,
      [intentDetectionTool],
      { type: "function", function: { name: "detect_user_intent" } }
    );

    // Parse tool call response
    if (typeof response === 'object' && response.tool_calls && response.tool_calls.length > 0) {
      const toolCall = response.tool_calls[0];
      const intentData = JSON.parse(toolCall.function.arguments);
      
      console.log('AI Intent Detection:', {
        message: userMessage,
        detected: intentData.intent_type,
        confidence: intentData.confidence,
        reasoning: intentData.reasoning,
        clues: intentData.context_clues
      });

      return {
        type: intentData.intent_type,
        confidence: intentData.confidence
      };
    }

    // Fallback to general if tool call fails
    console.log('Intent detection fallback to general');
    return { type: 'general', confidence: 0.5 };
  } catch (error) {
    console.error('Error in AI intent detection:', error);
    return { type: 'general', confidence: 0.3 };
  }
}
