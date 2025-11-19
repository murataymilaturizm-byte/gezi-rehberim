// Extract and maintain user preferences from conversation

interface UserMemory {
  preferredDestinations: string[];
  budgetRange?: 'düşük' | 'orta' | 'yüksek';
  travelStyle?: string;
  interests: string[];
  lastUpdated: string;
}

const DESTINATIONS = ['Kapadokya', 'Pamukkale', 'Antalya', 'İzmir', 'Çeşme', 'Alaçatı', 'Efes'];
const INTEREST_KEYWORDS: { [key: string]: string[] } = {
  'balon turu': ['balon', 'balloon', 'uçmak', 'hava', 'luft', 'воздушный', 'هواء', 'air', 'globo'],
  'macera': ['rafting', 'adrenalin', 'macera', 'extreme', 'aktivite', 'abenteuer', 'adventure', 'приключение', 'مغامرة', 'aventure', 'aventura'],
  'kültür': ['müze', 'antik', 'tarihi', 'kültür', 'history', 'cultural', 'museum', 'kultur', 'культура', 'ثقافة', 'culture', 'cultura', 'ancient', 'antike'],
  'doğa': ['doğa', 'vadi', 'kanyon', 'nature', 'hiking', 'trekking', 'natur', 'природа', 'طبيعة', 'nature', 'naturaleza', 'wandern'],
  'lüks': ['lüks', 'luxury', 'konforlu', 'premium', 'butik', 'luxus', 'роскошь', 'فاخر', 'luxe', 'lujo', 'boutique'],
  'termal': ['termal', 'spa', 'kaplıca', 'wellness', 'thermal', 'термальный', 'حراري', 'thermal', 'termal']
};

export function extractMemory(
  userMessage: string,
  aiResponse: string,
  currentMemory?: UserMemory
): UserMemory {
  const memory: UserMemory = currentMemory || {
    preferredDestinations: [],
    interests: [],
    lastUpdated: new Date().toISOString()
  };

  // Ensure arrays exist
  if (!memory.preferredDestinations) memory.preferredDestinations = [];
  if (!memory.interests) memory.interests = [];

  const lowerMessage = userMessage.toLowerCase();
  const lowerResponse = aiResponse.toLowerCase();
  const combinedText = `${lowerMessage} ${lowerResponse}`;

  // Extract destinations
  for (const dest of DESTINATIONS) {
    if (combinedText.includes(dest.toLowerCase()) && 
        !memory.preferredDestinations.includes(dest)) {
      memory.preferredDestinations.push(dest);
    }
  }

  // Extract interests
  for (const [interest, keywords] of Object.entries(INTEREST_KEYWORDS)) {
    if (keywords.some(keyword => combinedText.includes(keyword)) &&
        !memory.interests.includes(interest)) {
      memory.interests.push(interest);
    }
  }

  // Extract budget range from price discussions
  if (lowerMessage.match(/\d{3,5}/) || lowerResponse.match(/\d{3,5}₺/)) {
    const prices: number[] = [];
    const priceMatches = combinedText.match(/\d{3,5}/g);
    if (priceMatches) {
      prices.push(...priceMatches.map(p => parseInt(p)));
    }
    
    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      if (avgPrice < 1000) {
        memory.budgetRange = 'düşük';
      } else if (avgPrice < 3000) {
        memory.budgetRange = 'orta';
      } else {
        memory.budgetRange = 'yüksek';
      }
    }
  }

  // Extract travel style from keywords - multilingual
  const stylePatterns = {
    lüks: /lüks|luxury|konforlu|premium|luxus|роскошь|فاخر|luxe|lujo/i,
    macera: /macera|adrenalin|extreme|rafting|abenteuer|adventure|приключение|مغامرة|aventure|aventura/i,
    kültür: /kültür|tarihi|antik|müze|kultur|культура|ثقافة|culture|cultura|history|museum/i,
    doğa: /doğa|vadi|kanyon|nature|natur|природа|طبيعة|naturaleza|hiking/i
  };
  
  for (const [style, pattern] of Object.entries(stylePatterns)) {
    if (pattern.test(lowerMessage) || memory.interests.includes(style)) {
      memory.travelStyle = style;
      break;
    }
  }

  memory.lastUpdated = new Date().toISOString();
  return memory;
}

export function buildPersonalizedContext(memory: UserMemory, tours: any[], language: string = 'tr'): string {
  if (!memory) {
    return '';
  }

  // Ensure arrays exist
  const preferredDestinations = memory.preferredDestinations || [];
  const interests = memory.interests || [];

  if (preferredDestinations.length === 0 && 
      interests.length === 0 && 
      !memory.budgetRange) {
    return '';
  }

  const contextMessages = {
    tr: {
      header: '\n\n🧠 KULLANICI HAFİZASI (Kişiselleştirme için kullan):',
      destinations: '✈️ Tercih ettiği destinasyonlar:',
      interests: '💡 İlgi alanları:',
      budget: '💰 Bütçe aralığı:',
      style: '🎭 Seyahat stili:',
      recommendations: '🎯 KİŞİSELLEŞTİRİLMİŞ ÖNERİLER:',
      suggestion: 'turları kullanıcının tercihlerine uygun.',
      priority: '🔴 Öneriler yaparken bu turları ÖN PLANA ÇıKAR.'
    },
    en: {
      header: '\n\n🧠 USER MEMORY (Use for personalization):',
      destinations: '✈️ Preferred destinations:',
      interests: '💡 Interests:',
      budget: '💰 Budget range:',
      style: '🎭 Travel style:',
      recommendations: '🎯 PERSONALIZED RECOMMENDATIONS:',
      suggestion: 'tours match user preferences.',
      priority: '🔴 PRIORITIZE these tours when making suggestions.'
    },
    de: {
      header: '\n\n🧠 BENUTZERGEDÄCHTNIS (Für Personalisierung verwenden):',
      destinations: '✈️ Bevorzugte Reiseziele:',
      interests: '💡 Interessen:',
      budget: '💰 Budgetbereich:',
      style: '🎭 Reisestil:',
      recommendations: '🎯 PERSONALISIERTE EMPFEHLUNGEN:',
      suggestion: 'Touren entsprechen den Benutzerpräferenzen.',
      priority: '🔴 Diese Touren bei Vorschlägen PRIORISIEREN.'
    },
    ru: {
      header: '\n\n🧠 ПАМЯТЬ ПОЛЬЗОВАТЕЛЯ (Использовать для персонализации):',
      destinations: '✈️ Предпочитаемые направления:',
      interests: '💡 Интересы:',
      budget: '💰 Бюджетный диапазон:',
      style: '🎭 Стиль путешествия:',
      recommendations: '🎯 ПЕРСОНАЛИЗИРОВАННЫЕ РЕКОМЕНДАЦИИ:',
      suggestion: 'туры соответствуют предпочтениям пользователя.',
      priority: '🔴 ПРИОРИТИЗИРОВАТЬ эти туры при предложениях.'
    },
    ar: {
      header: '\n\n🧠 ذاكرة المستخدم (استخدم للتخصيص):',
      destinations: '✈️ الوجهات المفضلة:',
      interests: '💡 الاهتمامات:',
      budget: '💰 نطاق الميزانية:',
      style: '🎭 أسلوب السفر:',
      recommendations: '🎯 التوصيات الشخصية:',
      suggestion: 'الجولات تتطابق مع تفضيلات المستخدم.',
      priority: '🔴 أعط الأولوية لهذه الجولات عند تقديم الاقتراحات.'
    },
    fr: {
      header: '\n\n🧠 MÉMOIRE UTILISATEUR (Utiliser pour la personnalisation):',
      destinations: '✈️ Destinations préférées:',
      interests: '💡 Intérêts:',
      budget: '💰 Gamme de budget:',
      style: '🎭 Style de voyage:',
      recommendations: '🎯 RECOMMANDATIONS PERSONNALISÉES:',
      suggestion: 'circuits correspondent aux préférences de l\'utilisateur.',
      priority: '🔴 PRIORISER ces circuits lors des suggestions.'
    },
    es: {
      header: '\n\n🧠 MEMORIA DEL USUARIO (Usar para personalización):',
      destinations: '✈️ Destinos preferidos:',
      interests: '💡 Intereses:',
      budget: '💰 Rango de presupuesto:',
      style: '🎭 Estilo de viaje:',
      recommendations: '🎯 RECOMENDACIONES PERSONALIZADAS:',
      suggestion: 'tours coinciden con las preferencias del usuario.',
      priority: '🔴 PRIORIZAR estos tours al hacer sugerencias.'
    }
  };

  const msg = contextMessages[language as keyof typeof contextMessages] || contextMessages.tr;
  let context = msg.header;
  
  if (preferredDestinations.length > 0) {
    context += `\n${msg.destinations} ${preferredDestinations.join(', ')}`;
  }
  
  if (interests.length > 0) {
    context += `\n${msg.interests} ${interests.join(', ')}`;
  }
  
  if (memory.budgetRange) {
    context += `\n${msg.budget} ${memory.budgetRange}`;
  }
  
  if (memory.travelStyle) {
    context += `\n${msg.style} ${memory.travelStyle}`;
  }

  // Find matching tours based on memory
  const matchingTours = tours.filter(tour => {
    let score = 0;
    
    // Destination match
    if (preferredDestinations.some(dest => 
        tour.destination.includes(dest) || tour.title.includes(dest))) {
      score += 3;
    }
    
    // Interest match
    const tourText = `${tour.title} ${tour.program_kisa}`.toLowerCase();
    for (const interest of interests) {
      if (tourText.includes(interest.toLowerCase())) {
        score += 2;
      }
    }
    
    // Budget match (if dates available)
    if (memory.budgetRange && tour.dates && tour.dates.length > 0) {
      const avgPrice = tour.dates.reduce((sum: number, d: any) => sum + d.price_adult, 0) / tour.dates.length;
      if (memory.budgetRange === 'düşük' && avgPrice < 1000) score += 1;
      if (memory.budgetRange === 'orta' && avgPrice >= 1000 && avgPrice < 3000) score += 1;
      if (memory.budgetRange === 'yüksek' && avgPrice >= 3000) score += 1;
    }
    
    return score > 0;
  }).sort((a, b) => {
    // Simple scoring for sorting
    let scoreA = 0, scoreB = 0;
    
    if (preferredDestinations.some(dest => a.destination.includes(dest))) scoreA += 3;
    if (preferredDestinations.some(dest => b.destination.includes(dest))) scoreB += 3;
    
    return scoreB - scoreA;
  });

  if (matchingTours.length > 0) {
    const msg = contextMessages[language as keyof typeof contextMessages] || contextMessages.tr;
    context += `\n\n${msg.recommendations}`;
    context += `\n"${matchingTours.map(t => t.title).slice(0, 3).join('", "')}" ${msg.suggestion}`;
    context += `\n${msg.priority}`;
  }

  return context;
}
