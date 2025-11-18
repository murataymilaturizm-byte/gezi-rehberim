// Response validation and enforcement for demo chat

export function validateResponse(
  response: string, 
  conversationStyle: string,
  intent?: string
): {
  isValid: boolean;
  fixedResponse?: string;
  violations: string[];
} {
  const violations: string[] = [];
  
  // Count sentences (rough approximation)
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Check length violations - more lenient for tour listings and reservations
  const maxSentences = (intent === 'tour.list' || intent === 'tour.search') ? 15 
                     : (intent === 'reservation.wizard') ? 10
                     : 4;
  
  if (sentences.length > maxSentences) {
    violations.push(`Too many sentences: ${sentences.length} (max ${maxSentences})`);
  }
  
  // Check for banned phrases
  const bannedPhrases = ['demo', 'demo sistemi', 'gerçek değil', 'test', 'örnek'];
  const lowerResponse = response.toLowerCase();
  
  for (const phrase of bannedPhrases) {
    if (lowerResponse.includes(phrase)) {
      violations.push(`Contains banned phrase: "${phrase}"`);
    }
  }
  
  // Check emoji usage based on style
  const emojiCount = (response.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  
  if (conversationStyle === 'professional' && emojiCount > 0) {
    violations.push(`Professional style should not have emojis (found ${emojiCount})`);
  }
  
  // Check for program details (day-by-day)
  const hasDayByDay = /gün:|день:|day:|jour:|tag:|día:/i.test(response) && 
                      /\d+\.\s*gün|\d+\.\s*день|\d+\.\s*day|\d+\.\s*jour|\d+\.\s*tag|\d+\.\s*día/i.test(response);
  
  if (hasDayByDay) {
    violations.push('Contains day-by-day program details (forbidden)');
  }
  
  // Check for repeated greetings - MUST BLOCK them
  const greetings = ['merhaba', 'hello', 'hola', 'bonjour', 'привет', 'مرحبا'];
  
  // Check if response starts with greeting after first message
  const startsWithGreeting = greetings.some(g => lowerResponse.trim().startsWith(g));
  
  if (startsWithGreeting && intent !== 'greeting') {
    violations.push('Response starts with greeting (forbidden after first message)');
  }
  
  const greetingMatches = greetings.filter(g => lowerResponse.includes(g));
  
  if (greetingMatches.length > 1) {
    violations.push('Contains repeated greetings');
  }
  
  // If violations found, try to fix
  if (violations.length > 0) {
    let fixed = response;
    
    // Remove banned phrases
    for (const phrase of bannedPhrases) {
      const regex = new RegExp(phrase, 'gi');
      fixed = fixed.replace(regex, '');
    }
    
    // Trim sentences only if not tour listing or reservation
    if (sentences.length > maxSentences && intent !== 'tour.list' && intent !== 'tour.search' && intent !== 'reservation.wizard') {
      const firstThree = sentences.slice(0, 3).join('. ').trim();
      fixed = firstThree + (firstThree.endsWith('.') ? '' : '.');
    }
    
    // Remove greetings if not greeting intent
    if (intent !== 'greeting') {
      for (const greeting of greetings) {
        const regex = new RegExp(`^${greeting}[!.]?\\s*`, 'gi');
        fixed = fixed.replace(regex, '').trim();
      }
    }
    
    // Remove emojis if professional
    if (conversationStyle === 'professional') {
      fixed = fixed.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    }
    
    // Clean up whitespace
    fixed = fixed.replace(/\s+/g, ' ').trim();
    
    return {
      isValid: false,
      fixedResponse: fixed,
      violations
    };
  }
  
  return {
    isValid: true,
    violations: []
  };
}
