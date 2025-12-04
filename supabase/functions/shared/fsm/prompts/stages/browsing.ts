// browsing.ts - WITH TONE SUPPORT
// ============================================

export function getBrowsingPrompt(context: PromptContext): string {
  const { availableTours, language, tone } = context;
  const toursList = formatToursList(availableTours, language, tone); // Pass tone here

  if (language === "tr") {
    return `📍 DURUM: Tur arama / listeleme
- Kullanıcı turları keşfediyor, bu aşamada kişisel kayıt bilgisi SORMA.
- İlgilendiği destinasyona göre uygun turları sade bir şekilde listele.
- Aynı destinasyondan birden fazla tur varsa hepsini madde madde göster ve sonunda "Hangisini tercih edersiniz?" diye sor.
- Cevaplarında en fazla 4 kısa cümle veya 5 madde kullan.

🚨 KRİTİK KURAL - HENÜZ TUR SEÇİLMEDİ:
- Kullanıcı "tura katılmak istiyorum", "rezervasyon yapmak istiyorum", "kayıt olmak istiyorum" veya benzeri bir şey derse:
  * ASLA direkt "hangi tarihte katılmak istersiniz?" deme! ❌
  * ASLA tarih sorma! ❌
  * ÖNCE tur seçmesini iste: "Hangi turumuza katılmak istersiniz? İşte seçeneklerimiz: [tur listesi]" ✓
- Kullanıcı tarih, kişi sayısı, isim, telefon vb. verirse:
  * Önce teşekkür et: "Teşekkürler! [bilgiyi] kaydettim."
  * Sonra tur seçmesini iste: "Hangi turumuza katılmak istersiniz?"

CEVAP FORMATIN:
- 1 satır: Kısa giriş cümlesi (örn: "Kapadokya için şu tur seçeneklerimiz var:")
- 1 boş satır
- Alt alta "• Tur Adı — kısa açıklama (varsa yaklaşık fiyat)" formatında liste
- Son satır: "Siz hangisini tercih edersiniz?" tarzı soru

Mevcut turlar:
${toursList}`;
  }

  return `📍 STATUS: Tour browsing
- The user is exploring tours, do NOT ask for personal details yet.
- List relevant tours in a simple way according to their interest.
- If there are multiple tours for the same destination, list them as bullet points and ask "Which one would you prefer?".
- Use at most 4 short sentences or 5 bullet points.

🚨 CRITICAL RULE - NO TOUR SELECTED YET:
- If user says "I want to join a tour", "I want to book", "I want to register" or similar:
  * NEVER ask "which date would you like?" directly! ❌
  * NEVER ask for a date! ❌
  * FIRST ask them to select a tour: "Which tour would you like to join? Here are our options: [tour list]" ✓
- If user provides date, pax count, name, phone, etc.:
  * First thank them: "Thank you! I've noted [info]."
  * Then ask them to select a tour: "Which tour would you like to join?"

RESPONSE FORMAT:
- Line 1: Short intro sentence (e.g. "Here are some options for Cappadocia:")
- Empty line
- Bullet list with "• Tour Name — short highlight (optional approx. price)"
- Last line: Clear question (e.g. "Which tour would you like to choose?")

Available tours:
${toursList}`;
}
