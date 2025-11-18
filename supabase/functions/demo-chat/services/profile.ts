// Profile service for demo chat

export async function enrichConversationInsights(
  supabase: any,
  sessionId: string,
  agencyId: string,
  userMessage: string,
  assistantResponse: string,
  intent: string
) {
  try {
    // Get current profile
    const { data: profile } = await supabase
      .from('whatsapp_user_profiles')
      .select('preferences')
      .eq('phone', `demo_${sessionId}`)
      .eq('agency_id', agencyId)
      .maybeSingle();

    const currentPrefs = (profile?.preferences as any) || {};
    const currentInsights = currentPrefs.conversation_insights || {
      topics_discussed: [],
      questions_asked: [],
      concerns_raised: [],
      positive_signals: [],
      negative_signals: []
    };

    // Extract topics from message
    const tourKeywords = ['kapadokya', 'pamukkale', 'efes', 'antalya', 'ege', 'likya', 'istanbul', 'çeşme', 'alaçatı'];
    const mentionedTopics = tourKeywords.filter(keyword => 
      userMessage.toLowerCase().includes(keyword)
    );

    // Detect question patterns - multilingual
    if (userMessage.includes('?') || 
        userMessage.toLowerCase().match(/ne|nasıl|kaç|hangi|nerede|neden|what|how|when|where|why|which|was|wie|wo|wann|warum|что|как|когда|где|почему|ما|كيف|متى|أين|لماذا|quoi|comment|quand|où|pourquoi|qué|cómo|cuándo|dónde|por qué/)) {
      currentInsights.questions_asked.push(userMessage.slice(0, 100));
      currentInsights.questions_asked = currentInsights.questions_asked.slice(-5);
    }

    // Detect positive signals - multilingual
    const positiveWords = ['teşekkür', 'harika', 'güzel', 'süper', 'mükemmel', 'istiyorum', 'thank', 'great', 'nice', 'perfect', 'want', 'danke', 'toll', 'super', 'perfekt', 'möchte', 'спасибо', 'отлично', 'хочу', 'شكرا', 'رائع', 'ممتاز', 'أريد', 'merci', 'super', 'parfait', 'veux', 'gracias', 'perfecto', 'quiero'];
    if (positiveWords.some(word => userMessage.toLowerCase().includes(word))) {
      currentInsights.positive_signals.push(intent);
      currentInsights.positive_signals = [...new Set(currentInsights.positive_signals)].slice(-5);
    }

    // Detect negative signals - multilingual
    const negativeWords = ['pahalı', 'olmaz', 'istemiyorum', 'hayır', 'iptal', 'expensive', 'no', 'cancel', 'teuer', 'nein', 'stornieren', 'дорого', 'нет', 'отменить', 'غالي', 'لا', 'إلغاء', 'cher', 'non', 'annuler', 'caro', 'cancelar'];
    if (negativeWords.some(word => userMessage.toLowerCase().includes(word))) {
      currentInsights.negative_signals.push(intent);
      currentInsights.negative_signals = [...new Set(currentInsights.negative_signals)].slice(-5);
    }

    // Update topics
    if (mentionedTopics.length > 0) {
      currentInsights.topics_discussed = [
        ...new Set([...currentInsights.topics_discussed, ...mentionedTopics])
      ].slice(-10);
    }

    // Save insights
    currentPrefs.conversation_insights = currentInsights;

    await supabase
      .from('whatsapp_user_profiles')
      .upsert({ 
        phone: `demo_${sessionId}`,
        agency_id: agencyId,
        preferences: currentPrefs,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone,agency_id' });

    console.log('Conversation insights enriched:', currentInsights);
  } catch (error) {
    console.error('Error enriching conversation insights:', error);
  }
}
