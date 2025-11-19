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
    // Multi-language system prompts
    const systemPrompts: Record<string, string> = {
      tr: `Sen bir seyahat acentesi müşteri hizmetleri asistanısın.
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
8. 🔴 CONTEXT: Eğer asistan soru sordu ve kullanıcı kısa onay veriyorsa (evet, olur, tamam) -> confirmation`,

      en: `You are a travel agency customer service assistant.
Analyze the user's message and conversation history to detect their intent.

Intent Types:
- greeting: Initial greeting or hello (ONLY FOR FIRST MESSAGE)
- tour.list: Wants to see all tour options
- tour.search: Looking for information about a specific tour or destination
- tour.detail: Wants to learn details of a specific tour
- price.inquiry: Wants to know pricing information
- reservation.wizard: Wants to make a reservation, book, join, register
- confirmation: Giving confirmation ("yes", "okay", "sure", "I confirm", "accept", "I want" etc.)
- question: General questions (price, date, conditions, etc.)
- general: Other general conversation

🔴 IMPORTANT RULES:
1. USE CONTEXT: If tours were mentioned in previous messages, this is NOT a greeting!
2. If user uses words like "reservation", "book", "join", "register" -> reservation.wizard
3. 🔴 CRITICAL CONFIRMATION DETECTION: If user uses confirmation words like "yes", "okay", "sure", "I confirm", "accept", "I want" -> confirmation
4. If user asks general questions like "your tours", "options", "what's available" -> tour.list
5. If user mentions a specific destination (Cappadocia, Pamukkale, etc.) -> tour.search
6. If user uses words like "price", "cost", "how much" -> price.inquiry
7. 🔴 MEMORY: If user has written before and tours were discussed, this can NEVER be a greeting!
8. 🔴 CONTEXT: If assistant asked a question and user gives brief confirmation (yes, okay, sure) -> confirmation`,

      de: `Sie sind ein Kundendienstassistent eines Reisebüros.
Analysieren Sie die Nachricht des Benutzers und die Gesprächshistorie, um seine Absicht zu erkennen.

Absichtstypen:
- greeting: Erste Begrüßung oder Hallo (NUR FÜR ERSTE NACHRICHT)
- tour.list: Möchte alle Touroptionen sehen
- tour.search: Sucht nach Informationen über eine bestimmte Tour oder ein Ziel
- tour.detail: Möchte Details einer bestimmten Tour erfahren
- price.inquiry: Möchte Preisinformationen wissen
- reservation.wizard: Möchte eine Reservierung vornehmen, buchen, teilnehmen, registrieren
- confirmation: Gibt Bestätigung ("ja", "okay", "sicher", "ich bestätige", "akzeptiere", "ich möchte" usw.)
- question: Allgemeine Fragen (Preis, Datum, Bedingungen usw.)
- general: Andere allgemeine Konversation

🔴 WICHTIGE REGELN:
1. VERWENDEN SIE KONTEXT: Wenn Touren in früheren Nachrichten erwähnt wurden, ist dies KEINE Begrüßung!
2. Wenn Benutzer Wörter wie "Reservierung", "Buchen", "Teilnehmen", "Registrieren" verwendet -> reservation.wizard
3. 🔴 KRITISCHE BESTÄTIGUNGSERKENNUNG: Wenn Benutzer Bestätigungswörter verwendet wie "ja", "okay", "sicher", "ich bestätige", "akzeptiere" -> confirmation
4. Wenn Benutzer allgemeine Fragen stellt wie "Ihre Touren", "Optionen", "was verfügbar ist" -> tour.list
5. Wenn Benutzer ein bestimmtes Ziel erwähnt (Kappadokien, Pamukkale usw.) -> tour.search
6. Wenn Benutzer Wörter wie "Preis", "Kosten", "wie viel" verwendet -> price.inquiry
7. 🔴 GEDÄCHTNIS: Wenn Benutzer zuvor geschrieben hat und Touren besprochen wurden, kann dies NIEMALS eine Begrüßung sein!
8. 🔴 KONTEXT: Wenn Assistent eine Frage gestellt hat und Benutzer kurze Bestätigung gibt (ja, okay, sicher) -> confirmation`,

      ru: `Вы - помощник службы поддержки туристического агентства.
Проанализируйте сообщение пользователя и историю разговора, чтобы определить его намерение.

Типы намерений:
- greeting: Первое приветствие или привет (ТОЛЬКО ДЛЯ ПЕРВОГО СООБЩЕНИЯ)
- tour.list: Хочет увидеть все варианты туров
- tour.search: Ищет информацию о конкретном туре или направлении
- tour.detail: Хочет узнать детали конкретного тура
- price.inquiry: Хочет узнать информацию о ценах
- reservation.wizard: Хочет сделать бронирование, забронировать, присоединиться, зарегистрироваться
- confirmation: Дает подтверждение ("да", "хорошо", "конечно", "я подтверждаю", "принимаю", "я хочу" и т.д.)
- question: Общие вопросы (цена, дата, условия и т.д.)
- general: Другой общий разговор

🔴 ВАЖНЫЕ ПРАВИЛА:
1. ИСПОЛЬЗУЙТЕ КОНТЕКСТ: Если туры были упомянуты в предыдущих сообщениях, это НЕ приветствие!
2. Если пользователь использует слова типа "бронирование", "забронировать", "присоединиться", "зарегистрироваться" -> reservation.wizard
3. 🔴 КРИТИЧЕСКОЕ ОБНАРУЖЕНИЕ ПОДТВЕРЖДЕНИЯ: Если пользователь использует слова подтверждения типа "да", "хорошо", "конечно", "я подтверждаю", "принимаю" -> confirmation
4. Если пользователь задает общие вопросы типа "ваши туры", "варианты", "что доступно" -> tour.list
5. Если пользователь упоминает конкретное направление (Каппадокия, Памуккале и т.д.) -> tour.search
6. Если пользователь использует слова типа "цена", "стоимость", "сколько" -> price.inquiry
7. 🔴 ПАМЯТЬ: Если пользователь писал раньше и обсуждались туры, это НИКОГДА не может быть приветствием!
8. 🔴 КОНТЕКСТ: Если ассистент задал вопрос и пользователь дает краткое подтверждение (да, хорошо, конечно) -> confirmation`,

      ar: `أنت مساعد خدمة عملاء لوكالة سفر.
قم بتحليل رسالة المستخدم وسجل المحادثة للكشف عن نيته.

أنواع النوايا:
- greeting: تحية أولية أو مرحبا (فقط للرسالة الأولى)
- tour.list: يريد رؤية جميع خيارات الجولات
- tour.search: يبحث عن معلومات حول جولة أو وجهة محددة
- tour.detail: يريد معرفة تفاصيل جولة محددة
- price.inquiry: يريد معرفة معلومات التسعير
- reservation.wizard: يريد إجراء حجز أو الانضمام أو التسجيل
- confirmation: يعطي تأكيدًا ("نعم"، "حسنًا"، "بالتأكيد"، "أؤكد"، "أقبل"، "أريد" إلخ)
- question: أسئلة عامة (السعر، التاريخ، الشروط، إلخ)
- general: محادثة عامة أخرى

🔴 قواعد مهمة:
1. استخدم السياق: إذا تم ذكر الجولات في الرسائل السابقة، فهذه ليست تحية!
2. إذا استخدم المستخدم كلمات مثل "حجز"، "احجز"، "انضم"، "سجل" -> reservation.wizard
3. 🔴 كشف التأكيد الحرج: إذا استخدم المستخدم كلمات تأكيد مثل "نعم"، "حسنًا"، "بالتأكيد"، "أؤكد"، "أقبل" -> confirmation
4. إذا سأل المستخدم أسئلة عامة مثل "جولاتكم"، "خيارات"، "ما هو متاح" -> tour.list
5. إذا ذكر المستخدم وجهة محددة (كابادوكيا، باموكالي، إلخ) -> tour.search
6. إذا استخدم المستخدم كلمات مثل "سعر"، "تكلفة"، "كم" -> price.inquiry
7. 🔴 الذاكرة: إذا كتب المستخدم من قبل وتمت مناقشة الجولات، فلا يمكن أن تكون هذه تحية أبدًا!
8. 🔴 السياق: إذا طرح المساعد سؤالاً وأعطى المستخدم تأكيدًا موجزًا (نعم، حسنًا، بالتأكيد) -> confirmation`,

      fr: `Vous êtes un assistant du service client d'une agence de voyage.
Analysez le message de l'utilisateur et l'historique de la conversation pour détecter son intention.

Types d'intentions:
- greeting: Salutation initiale ou bonjour (UNIQUEMENT POUR LE PREMIER MESSAGE)
- tour.list: Veut voir toutes les options de circuits
- tour.search: Recherche des informations sur un circuit ou une destination spécifique
- tour.detail: Veut connaître les détails d'un circuit spécifique
- price.inquiry: Veut connaître les informations sur les prix
- reservation.wizard: Veut faire une réservation, réserver, rejoindre, s'inscrire
- confirmation: Donne une confirmation ("oui", "d'accord", "bien sûr", "je confirme", "j'accepte", "je veux" etc.)
- question: Questions générales (prix, date, conditions, etc.)
- general: Autre conversation générale

🔴 RÈGLES IMPORTANTES:
1. UTILISEZ LE CONTEXTE: Si des circuits ont été mentionnés dans les messages précédents, ce n'est PAS une salutation!
2. Si l'utilisateur utilise des mots comme "réservation", "réserver", "rejoindre", "s'inscrire" -> reservation.wizard
3. 🔴 DÉTECTION CRITIQUE DE CONFIRMATION: Si l'utilisateur utilise des mots de confirmation comme "oui", "d'accord", "bien sûr", "je confirme", "j'accepte" -> confirmation
4. Si l'utilisateur pose des questions générales comme "vos circuits", "options", "ce qui est disponible" -> tour.list
5. Si l'utilisateur mentionne une destination spécifique (Cappadoce, Pamukkale, etc.) -> tour.search
6. Si l'utilisateur utilise des mots comme "prix", "coût", "combien" -> price.inquiry
7. 🔴 MÉMOIRE: Si l'utilisateur a écrit auparavant et que des circuits ont été discutés, cela ne peut JAMAIS être une salutation!
8. 🔴 CONTEXTE: Si l'assistant a posé une question et que l'utilisateur donne une brève confirmation (oui, d'accord, bien sûr) -> confirmation`,

      es: `Eres un asistente de servicio al cliente de una agencia de viajes.
Analiza el mensaje del usuario y el historial de conversación para detectar su intención.

Tipos de intenciones:
- greeting: Saludo inicial o hola (SOLO PARA PRIMER MENSAJE)
- tour.list: Quiere ver todas las opciones de tours
- tour.search: Busca información sobre un tour o destino específico
- tour.detail: Quiere conocer los detalles de un tour específico
- price.inquiry: Quiere saber información de precios
- reservation.wizard: Quiere hacer una reserva, reservar, unirse, registrarse
- confirmation: Da confirmación ("sí", "vale", "seguro", "confirmo", "acepto", "quiero" etc.)
- question: Preguntas generales (precio, fecha, condiciones, etc.)
- general: Otra conversación general

🔴 REGLAS IMPORTANTES:
1. USA EL CONTEXTO: ¡Si se mencionaron tours en mensajes anteriores, esto NO es un saludo!
2. Si el usuario usa palabras como "reserva", "reservar", "unirse", "registrarse" -> reservation.wizard
3. 🔴 DETECCIÓN CRÍTICA DE CONFIRMACIÓN: Si el usuario usa palabras de confirmación como "sí", "vale", "seguro", "confirmo", "acepto" -> confirmation
4. Si el usuario hace preguntas generales como "sus tours", "opciones", "qué hay disponible" -> tour.list
5. Si el usuario menciona un destino específico (Capadocia, Pamukkale, etc.) -> tour.search
6. Si el usuario usa palabras como "precio", "costo", "cuánto" -> price.inquiry
7. 🔴 MEMORIA: ¡Si el usuario escribió antes y se discutieron tours, esto NUNCA puede ser un saludo!
8. 🔴 CONTEXTO: Si el asistente hizo una pregunta y el usuario da una breve confirmación (sí, vale, seguro) -> confirmation`
    };

    const systemPrompt = systemPrompts[userLanguage] || systemPrompts.tr;

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
