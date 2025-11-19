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
  
  // Count words instead of sentences for better control
  const words = response.split(/\s+/).filter(w => w.trim().length > 0);
  
  // Check length violations - use word count for more reliable limits
  const maxWords = (intent === 'tour.list' || intent === 'tour.search') ? 300 
                  : (intent === 'reservation.wizard') ? 200
                  : 100;
  
  if (words.length > maxWords) {
    violations.push(`Too many words: ${words.length} (max ${maxWords})`);
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
  
  // Professional and formal styles: NO emojis allowed
  if ((conversationStyle === 'professional' || conversationStyle === 'formal') && emojiCount > 0) {
    violations.push(`${conversationStyle} style should not have emojis (found ${emojiCount})`);
  }
  
  // Friendly style: MUST have at least 2 emojis
  if (conversationStyle === 'friendly' && emojiCount < 2) {
    violations.push(`Friendly style must have at least 2 emojis (found ${emojiCount})`);
  }
  
  // Casual style: Should have at least 1 emoji
  if (conversationStyle === 'casual' && emojiCount < 1) {
    violations.push(`Casual style should have at least 1 emoji (found ${emojiCount})`);
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
    
    // Trim by word count only if not tour listing or reservation
    if (words.length > maxWords && intent !== 'tour.list' && intent !== 'tour.search' && intent !== 'reservation.wizard') {
      const trimmedWords = words.slice(0, maxWords).join(' ');
      fixed = trimmedWords + (trimmedWords.endsWith('.') ? '' : '.');
    }
    
    // Remove greetings if not greeting intent
    if (intent !== 'greeting') {
      for (const greeting of greetings) {
        const regex = new RegExp(`^${greeting}[!.]?\\s*`, 'gi');
        fixed = fixed.replace(regex, '').trim();
      }
    }
    
    // Remove emojis if professional/formal
    if (conversationStyle === 'professional' || conversationStyle === 'formal') {
      fixed = fixed.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    }
    
    // Add emojis if friendly style needs more
    if (conversationStyle === 'friendly' && emojiCount < 2) {
      const missingCount = 2 - emojiCount;
      const emojisToAdd = '😊✨🎉🌟'.slice(0, missingCount * 2);
      fixed = fixed + ' ' + emojisToAdd;
    }
    
    // Add emoji if casual style needs one
    if (conversationStyle === 'casual' && emojiCount < 1) {
      fixed = fixed + ' 😊';
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
