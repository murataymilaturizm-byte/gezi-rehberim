// Extract and maintain user preferences from WhatsApp conversations

interface UserMemory {
  preferredDestinations: string[];
  budgetRange?: 'düşük' | 'orta' | 'yüksek';
  travelStyle?: string;
  interests: string[];
  lastMentionedPax?: {
    adults: number;
    children?: number;
  };
  lastUpdated: string;
}

const INTEREST_KEYWORDS: { [key: string]: string[] } = {
  'balon turu': ['balon', 'balloon', 'uçmak', 'hava', 'luft', 'воздушный', 'هواء', 'air', 'globo'],
  'macera': ['rafting', 'adrenalin', 'macera', 'extreme', 'aktivite', 'abenteuer', 'adventure', 'приключение', 'مغامرة', 'aventure', 'aventura'],
  'kültür': ['müze', 'antik', 'tarihi', 'kültür', 'history', 'cultural', 'tarih', 'museum', 'kultur', 'культура', 'ثقافة', 'culture', 'cultura', 'ancient', 'antike'],
  'doğa': ['doğa', 'vadi', 'kanyon', 'nature', 'hiking', 'trekking', 'yürüyüş', 'natur', 'природа', 'طبيعة', 'nature', 'naturaleza', 'wandern'],
  'lüks': ['lüks', 'luxury', 'konforlu', 'premium', 'butik', 'luxus', 'роскошь', 'فاخر', 'luxe', 'lujo', 'boutique'],
  'termal': ['termal', 'spa', 'kaplıca', 'wellness', 'thermal', 'термальный', 'حراري', 'thermal', 'termal'],
  'aile': ['aile', 'çocuk', 'family', 'kids', 'bebek', 'familie', 'kinder', 'семья', 'дети', 'عائلة', 'أطفال', 'famille', 'enfants', 'familia', 'niños'],
  'romantik': ['romantik', 'balayı', 'çift', 'romantic', 'honeymoon', 'romantisch', 'flitterwochen', 'романтика', 'романтический', 'رومانسي', 'شهر العسل', 'romantique', 'lune de miel', 'romántico', 'luna de miel']
};

export function extractMemory(
  userMessage: string,
  aiResponse: string,
  tours: any[],
  currentMemory?: UserMemory
): UserMemory {
  const memory: UserMemory = currentMemory || {
    preferredDestinations: [],
    interests: [],
    lastUpdated: new Date().toISOString()
  };

  const lowerMessage = userMessage.toLowerCase();
  const lowerResponse = aiResponse.toLowerCase();
  const combinedText = `${lowerMessage} ${lowerResponse}`;

  // Extract destinations from tours and messages
  const destinationKeywords = [...new Set(tours.map(t => t.destination))];
  for (const dest of destinationKeywords) {
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
  if (lowerMessage.match(/\d{3,5}/) || lowerResponse.match(/\d{3,5}[₺TRY]/)) {
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

  // Extract travel style from keywords
  const stylePatterns = {
    lüks: /lüks|luxury|konforlu|premium|luxus|роскошь|فاخر|luxe|lujo/i,
    macera: /macera|adrenalin|extreme|rafting|abenteuer|adventure|приключение|мغامرة|aventure|aventura/i,
    kültür: /kültür|tarihi|antik|müze|kultur|культура|ثقافة|culture|cultura|history|museum/i,
    doğa: /doğa|vadi|kanyon|nature|natur|природа|طبيعة|naturaleza|hiking/i,
    aile: /aile|çocuk|family|familie|kinder|семья|дети|عائلة|أطفال|famille|enfants|familia|niños/i,
    romantik: /romantik|balayı|çift|romantic|honeymoon|romantisch|flitterwochen|романтика|رومانسي|شهر العسل|romantique|lune de miel|romántico|luna de miel/i
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
  if (!memory || (memory.preferredDestinations.length === 0 && 
                  memory.interests.length === 0 && 
                  !memory.budgetRange)) {
    return '';
  }

  const labels = {
    tr: {
      header: '\n\n🧠 KULLANICI HAFİZASI (Kişiselleştirme için kullan):',
      destinations: '\n✈️ Tercih ettiği destinasyonlar:',
      interests: '\n💡 İlgi alanları:',
      budget: '\n💰 Bütçe aralığı:',
      style: '\n🎭 Seyahat stili:',
      recommendations: '\n\n🎯 KİŞİSELLEŞTİRİLMİŞ ÖNERİLER:',
      matchingTours: 'turları kullanıcının tercihlerine uygun.',
      prioritize: '\n🔴 Öneriler yaparken bu turları ÖN PLANA ÇIKAR ama zorlama yapma.'
    },
    en: {
      header: '\n\n🧠 USER MEMORY (Use for personalization):',
      destinations: '\n✈️ Preferred destinations:',
      interests: '\n💡 Interests:',
      budget: '\n💰 Budget range:',
      style: '\n🎭 Travel style:',
      recommendations: '\n\n🎯 PERSONALIZED RECOMMENDATIONS:',
      matchingTours: 'tours match user preferences.',
      prioritize: '\n🔴 PRIORITIZE these tours in suggestions but don\'t force.'
    },
    de: {
      header: '\n\n🧠 BENUTZERGEDÄCHTNIS (Für Personalisierung verwenden):',
      destinations: '\n✈️ Bevorzugte Reiseziele:',
      interests: '\n💡 Interessen:',
      budget: '\n💰 Budgetbereich:',
      style: '\n🎭 Reisestil:',
      recommendations: '\n\n🎯 PERSONALISIERTE EMPFEHLUNGEN:',
      matchingTours: 'Touren passen zu den Benutzerpräferenzen.',
      prioritize: '\n🔴 Diese Touren in Vorschlägen PRIORISIEREN, aber nicht erzwingen.'
    },
    ru: {
      header: '\n\n🧠 ПАМЯТЬ ПОЛЬЗОВАТЕЛЯ (Используйте для персонализации):',
      destinations: '\n✈️ Предпочтительные направления:',
      interests: '\n💡 Интересы:',
      budget: '\n💰 Бюджетный диапазон:',
      style: '\n🎭 Стиль путешествия:',
      recommendations: '\n\n🎯 ПЕРСОНАЛИЗИРОВАННЫЕ РЕКОМЕНДАЦИИ:',
      matchingTours: 'туры соответствуют предпочтениям пользователя.',
      prioritize: '\n🔴 ПРИОРИТЕЗИРУЙТЕ эти туры в предложениях, но не навязывайте.'
    },
    ar: {
      header: '\n\n🧠 ذاكرة المستخدم (استخدم للتخصيص):',
      destinations: '\n✈️ الوجهات المفضلة:',
      interests: '\n💡 الاهتمامات:',
      budget: '\n💰 نطاق الميزانية:',
      style: '\n🎭 أسلوب السفر:',
      recommendations: '\n\n🎯 التوصيات المخصصة:',
      matchingTours: 'الجولات تتوافق مع تفضيلات المستخدم.',
      prioritize: '\n🔴 أعط الأولوية لهذه الجولات في الاقتراحات لكن لا تفرض.'
    },
    fr: {
      header: '\n\n🧠 MÉMOIRE UTILISATEUR (Utilisez pour la personnalisation):',
      destinations: '\n✈️ Destinations préférées:',
      interests: '\n💡 Intérêts:',
      budget: '\n💰 Fourchette budgétaire:',
      style: '\n🎭 Style de voyage:',
      recommendations: '\n\n🎯 RECOMMANDATIONS PERSONNALISÉES:',
      matchingTours: 'circuits correspondent aux préférences de l\'utilisateur.',
      prioritize: '\n🔴 PRIORISEZ ces circuits dans les suggestions mais ne forcez pas.'
    },
    es: {
      header: '\n\n🧠 MEMORIA DEL USUARIO (Usar para personalización):',
      destinations: '\n✈️ Destinos preferidos:',
      interests: '\n💡 Intereses:',
      budget: '\n💰 Rango de presupuesto:',
      style: '\n🎭 Estilo de viaje:',
      recommendations: '\n\n🎯 RECOMENDACIONES PERSONALIZADAS:',
      matchingTours: 'tours coinciden con las preferencias del usuario.',
      prioritize: '\n🔴 PRIORIZA estos tours en sugerencias pero no fuerces.'
    }
  };

  const l = labels[language as keyof typeof labels] || labels.tr;
  let context = l.header;
  
  if (memory.preferredDestinations.length > 0) {
    context += `${l.destinations} ${memory.preferredDestinations.join(', ')}`;
  }
  
  if (memory.interests.length > 0) {
    context += `${l.interests} ${memory.interests.join(', ')}`;
  }
  
  if (memory.budgetRange) {
    context += `${l.budget} ${memory.budgetRange}`;
  }
  
  if (memory.travelStyle) {
    context += `${l.style} ${memory.travelStyle}`;
  }

  // Find matching tours based on memory
  const matchingTours = tours.filter(tour => {
    let score = 0;
    
    if (memory.preferredDestinations.some(dest => 
        tour.destination.includes(dest) || tour.title.includes(dest))) {
      score += 3;
    }
    
    const tourText = `${tour.title} ${tour.program_kisa || ''}`.toLowerCase();
    for (const interest of memory.interests) {
      if (tourText.includes(interest.toLowerCase())) {
        score += 2;
      }
    }
    
    if (memory.budgetRange && tour.dates && tour.dates.length > 0) {
      const avgPrice = tour.dates.reduce((sum: number, d: any) => sum + d.price_adult, 0) / tour.dates.length;
      if (memory.budgetRange === 'düşük' && avgPrice < 1000) score += 1;
      if (memory.budgetRange === 'orta' && avgPrice >= 1000 && avgPrice < 3000) score += 1;
      if (memory.budgetRange === 'yüksek' && avgPrice >= 3000) score += 1;
    }
    
    return score > 0;
  }).sort((a, b) => {
    let scoreA = 0, scoreB = 0;
    
    if (memory.preferredDestinations.some(dest => a.destination.includes(dest))) scoreA += 3;
    if (memory.preferredDestinations.some(dest => b.destination.includes(dest))) scoreB += 3;
    
    return scoreB - scoreA;
  });

  if (matchingTours.length > 0) {
    context += l.recommendations;
    context += `\n"${matchingTours.map(t => t.title).slice(0, 3).join('", "')}" ${l.matchingTours}`;
    context += l.prioritize;
  }

  return context;
}
