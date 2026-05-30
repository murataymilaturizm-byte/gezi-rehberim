// Centralized validation logic

const MAX_INPUT_LENGTH = 2000;

export function isInputTooLong(input: string): boolean {
  return typeof input === "string" && input.length > MAX_INPUT_LENGTH;
}

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  // Hard length cap — token şişmesini ve prompt injection saldırılarını önle
  let sanitized = input.slice(0, MAX_INPUT_LENGTH);
  sanitized = sanitized
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .trim();
  return sanitized;
}

/**
 * K4: Prompt injection tespiti — kullanıcı mesajında injection girişimi var mı?
 * Tespit edilirse mesaj ENGELLENMEz, sadece flag döner.
 * AI cevabı post-validate edilirken bu flag kullanılır.
 */
export function detectInjection(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const msg = input.toLowerCase();

  // EN — temel injection kalıpları
  const enPatterns = [
    /\b(ignore|forget|disregard|skip|override)\s+(all\s+)?(previous|above|prior|earlier|your|any)\s+(instructions?|rules?|directives?|guidelines?|prompt|system|context)/i,
    /\byou\s+are\s+now\s+(a\s+|an\s+)?\w/i,
    /\bact\s+as\b.{0,40}(bot|ai|assistant|gpt|model|new\s+system)/i,
    /\b(reveal|show|print|display|output)\s+(your\s+)?(system\s+prompt|instructions?|rules?|hidden\s+prompt)/i,
    /\bpretend\s+(you\s+are|to\s+be|that)\b/i,
    /\b(developer|admin|system|root|god|jailbreak|dan)\s+mode\b/i,
    /\bnew\s+(instructions?|role|task|persona)\b/i,
    /\byour\s+new\s+(instructions?|role|task)\b/i,
    /\bgive\s+(me\s+)?(a\s+)?\d+\s*%\s*(discount|off)\b/i,
    /\bmake\s+(it|this|everything)\s+free\b/i,
  ];
  if (enPatterns.some((p) => p.test(msg))) return true;

  // TR — talimat değiştirme + indirim zorlaması
  const trPatterns = [
    /\b(önceki|tüm|mevcut|yukarıdaki|bütün)\s+(talimatlar?\w*|kurallar?\w*|direktifler?\w*)\s+(unut|yoksay|görmezden|iptal|sil)/i,
    /\btalimatlar?\w*\s+(unut|yoksay|değiştir|sil)\b/i,
    /\bsen\s+artık\s+\w/i,
    /\brol\s+(değiştir|oyna|al)\b/i,
    /\b(sistem\s+prompt\w*|talimatlar?\w*)\s+(göster|yaz|söyle|aç|oku)\b/i,
    /\b%\s*\d+\s*indirim\s+(ver|yap|uygula)\b/i,
    /\bbedavaya?\s+(ver|yap|sun)\b/i,
    /\byeni\s+talimatlar?\b/i,
    /\b(özel|gizli)\s+(mod|mode|komut)\b/i,
  ];
  if (trPatterns.some((p) => p.test(msg))) return true;

  // FIX 2: DE / FR / ES / RU / AR — EN/TR seviyesine yaklaştırılmış pattern'ler.
  // Mevcut 2 pattern/dil korundu, her dil için ek olarak: prompt sızdırma, dev/admin
  // mode, indirim zorlaması (verb + miktar), bedava/ücretsiz zorlaması, yeni
  // talimat/rol kalıpları. Yanlış-pozitif riski için: indirim/ücretsiz pattern'leri
  // "ver/yap" verb'ü gerektiriyor → "indiriminiz var mı?" gibi soru tonu yakalanmaz.
  const multilangPatterns = [
    // ─── DE ─────────────────────────────────────────────────────────────────
    /\b(ignoriere|vergiss|missachte)\s+(alle?\s+)?(anweisungen?|regeln?|system\w*|kontext)/i,
    /\bdu\s+bist\s+jetzt\b/i,
    /\b(zeig\w*|verrate|gib\s+mir|nenne)\s+(mir\s+)?(dein\w*|das)\s+(system\s*prompt\w*|anweisung\w*|instruktion\w*)/i,
    /\b(entwickler|admin|root|jailbreak|dan)[\s-]?(modus|mode)\b/i,
    /\b(gib|biete)\s+mir\s+\d+\s*%\s*(rabatt|nachlass|vergünstigung)\b/i,
    /\b(mach|gib|biete)\s+(es|das)\s+(kostenlos|umsonst|gratis)\b/i,
    /\bneue\s+(anweisung|regel|rolle|aufgabe|persona)\b/i,

    // ─── FR ─────────────────────────────────────────────────────────────────
    /\b(ignores?|oublies?|ignore|oublie)\s+(toutes?\s+les?\s+)?(instructions?|règles?|consignes?|système)/i,
    /\btu\s+es\s+maintenant\b/i,
    /\b(montre|donne|révèle|affiche)[\s-]moi\s+(ton|tes|le)\s+(prompt|instructions?|consignes?|système)/i,
    /\bmode\s+(développeur|administrateur|admin|jailbreak|dan)\b/i,
    /\bdonne[\s-]moi\s+\d+\s*%\s*(de\s+)?(réduction|remise|rabais)\b/i,
    /\b(fais|rends)[\s-]le\s+(gratuit|gratuite|gratuitement)\b/i,
    /\bnouvelle\s+(instruction|règle|rôle|tâche|persona)\b/i,

    // ─── ES ─────────────────────────────────────────────────────────────────
    /\b(ignora|olvida|omite)\s+(todas?\s+las?\s+)?(instrucciones?|reglas?|sistema|contexto)/i,
    /\bahora\s+eres?\b/i,
    /\b(muéstrame|enséñame|revela|dime)\s+(tu|el)\s+(prompt|instrucci\w+|consigna|sistema)/i,
    /\bmodo\s+(desarrollador|administrador|admin|jailbreak|dan)\b/i,
    /\bdame\s+(un\s+)?\d+\s*%\s*de\s+descuento\b/i,
    /\b(hazlo|hazme|haz\s+esto)\s+(gratis|gratuito|gratuita)\b/i,
    /\bnueva\s+(instrucción|regla|rol|tarea|persona)\b/i,

    // ─── RU ─────────────────────────────────────────────────────────────────
    /\b(игнорируй|забудь|пренебреги)\s+(все\s+)?(инструкции|правила|систем\w+|контекст)/i,
    /\bты\s+теперь\b/i,
    /\b(покажи|раскрой|сообщи|выведи)\s+(мне\s+)?(сво[ёе]?|тво[ёе]?|свой|твой)?\s*(промпт|инструкци\w+|систем\w+\s+промпт)/i,
    /\bрежим\s+(разработчика|администратора|админ\w*|jailbreak|dan)\b/i,
    /\bдай\s+мне\s+\d+\s*%\s*скидк\w+\b/i,
    /\bсделай\s+(это\s+)?(бесплатн\w+|даром)\b/i,
    /\bнов\w+\s+(инструкц\w+|правил\w+|роль|задач\w+|персон\w+)\b/i,

    // ─── AR ─────────────────────────────────────────────────────────────────
    /\b(تجاهل|انسَ|انسى|اهمل)\s+(جميع\s+|كل\s+)?(التعليمات|القواعد|النظام|السياق)/i,
    /\bأنت\s+الآن\b/i,
    /\b(أرني|أظهر|اكشف|قل\s+لي)\s+(لي\s+)?(تعليماتك|البرومبت|النظام\s+الخاص|توجيهاتك)/i,
    /\bوضع\s+(المطور|المسؤول|المدير|jailbreak|dan)\b/i,
    /\bأعطني\s+خصم\s+\d+\s*%/i,
    /\b(اجعله|اجعلها|قدمه)\s+مجاناً?\b/i,
    /\bتعليمات\s+(جديدة|أخرى)\b/i,
  ];
  if (multilangPatterns.some((p) => p.test(msg))) return true;

  return false;
}
