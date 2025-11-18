// Extract and maintain user preferences from WhatsApp conversations

interface UserMemory {
  preferredDestinations: string[];
  budgetRange?: 'düşük' | 'orta' | 'yüksek';
  travelStyle?: string;
  interests: string[];
  lastUpdated: string;
}

const INTEREST_KEYWORDS: { [key: string]: string[] } = {
  'balon turu': ['balon', 'balloon', 'uçmak', 'hava'],
  'macera': ['rafting', 'adrenalin', 'macera', 'extreme', 'aktivite'],
  'kültür': ['müze', 'antik', 'tarihi', 'kültür', 'history', 'cultural', 'tarih'],
  'doğa': ['doğa', 'vadi', 'kanyon', 'nature', 'hiking', 'trekking', 'yürüyüş'],
  'lüks': ['lüks', 'luxury', 'konforlu', 'premium', 'butik'],
  'termal': ['termal', 'spa', 'kaplıca', 'wellness'],
  'aile': ['aile', 'çocuk', 'family', 'kids', 'bebek'],
  'romantik': ['romantik', 'balayı', 'çift', 'romantic', 'honeymoon']
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
  if (lowerMessage.match(/lüks|luxury|konforlu|premium/) || 
      memory.interests.includes('lüks')) {
    memory.travelStyle = 'lüks';
  } else if (lowerMessage.match(/macera|adrenalin|extreme|rafting/) ||
             memory.interests.includes('macera')) {
    memory.travelStyle = 'macera';
  } else if (lowerMessage.match(/kültür|tarihi|antik|müze/) ||
             memory.interests.includes('kültür')) {
    memory.travelStyle = 'kültür';
  } else if (lowerMessage.match(/doğa|vadi|kanyon|nature/) ||
             memory.interests.includes('doğa')) {
    memory.travelStyle = 'doğa';
  } else if (lowerMessage.match(/aile|çocuk|family/) ||
             memory.interests.includes('aile')) {
    memory.travelStyle = 'aile';
  } else if (lowerMessage.match(/romantik|balayı|çift/) ||
             memory.interests.includes('romantik')) {
    memory.travelStyle = 'romantik';
  }

  memory.lastUpdated = new Date().toISOString();
  return memory;
}

export function buildPersonalizedContext(memory: UserMemory, tours: any[]): string {
  if (!memory || (memory.preferredDestinations.length === 0 && 
                  memory.interests.length === 0 && 
                  !memory.budgetRange)) {
    return '';
  }

  let context = '\n\n🧠 KULLANICI HAFİZASI (Kişiselleştirme için kullan):';
  
  if (memory.preferredDestinations.length > 0) {
    context += `\n✈️ Tercih ettiği destinasyonlar: ${memory.preferredDestinations.join(', ')}`;
  }
  
  if (memory.interests.length > 0) {
    context += `\n💡 İlgi alanları: ${memory.interests.join(', ')}`;
  }
  
  if (memory.budgetRange) {
    context += `\n💰 Bütçe aralığı: ${memory.budgetRange}`;
  }
  
  if (memory.travelStyle) {
    context += `\n🎭 Seyahat stili: ${memory.travelStyle}`;
  }

  // Find matching tours based on memory
  const matchingTours = tours.filter(tour => {
    let score = 0;
    
    // Destination match
    if (memory.preferredDestinations.some(dest => 
        tour.destination.includes(dest) || tour.title.includes(dest))) {
      score += 3;
    }
    
    // Interest match
    const tourText = `${tour.title} ${tour.program_kisa || ''}`.toLowerCase();
    for (const interest of memory.interests) {
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
    
    if (memory.preferredDestinations.some(dest => a.destination.includes(dest))) scoreA += 3;
    if (memory.preferredDestinations.some(dest => b.destination.includes(dest))) scoreB += 3;
    
    return scoreB - scoreA;
  });

  if (matchingTours.length > 0) {
    context += `\n\n🎯 KİŞİSELLEŞTİRİLMİŞ ÖNERİLER:`;
    context += `\n"${matchingTours.map(t => t.title).slice(0, 3).join('", "')}" turları kullanıcının tercihlerine uygun.`;
    context += `\n🔴 Öneriler yaparken bu turları ÖN PLANA ÇIKAR ama zorlama yapma.`;
  }

  return context;
}
