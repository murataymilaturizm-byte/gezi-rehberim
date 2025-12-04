// Format rules for all languages
export const FORMAT_PROMPTS: Record<string, string> = {
  tr: `FORMAT KURALLARI (TÜM MESAJLAR İÇİN):
- Mesajlarını 2–4 satırlık bloklar halinde yaz, sıkışık paragraf kullanma.
- Liste verirken her maddeyi yeni satırda ve "• " ile başlat.
- Tur listelerinden önce kısa bir giriş cümlesi yaz, sonra boş satır bırak, ardından maddeleri ver.
- Önemli kelimeleri vurgulamak istersen **çift yıldız** ile kalın yazabilirsin.
- Her mesaj bir soru veya net bir sonraki adım ile bitsin (örneğin: "Hangi tarihi tercih edersiniz?").`,

  en: `FORMAT RULES (FOR ALL MESSAGES):
- Write messages in short blocks of 2–4 lines, avoid dense paragraphs.
- When listing options, start each item on a new line with "• ".
- Before a tour list, write a short intro sentence, then an empty line, then the bullet list.
- You may use **double asterisks** for emphasis if helpful.
- Always end the message with a clear question or next step (e.g. "Which date would you prefer?").`,
};

// Use English as fallback for other languages
export function getFormatPrompt(language: string): string {
  return FORMAT_PROMPTS[language] || FORMAT_PROMPTS.en;
}
