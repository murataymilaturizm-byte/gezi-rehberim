// greeting.ts - WITH TONE SUPPORT
import type { PromptContext } from "../types.ts";
import { formatToursList } from "../helpers.ts";

export function getGreetingPrompt(context: PromptContext): string {
  const { availableTours, language, tone } = context;
  const toursList = formatToursList(availableTours, language, tone); // Pass tone here

  if (language === "tr") {
    return `📍 DURUM: İlk karşılama
- Kullanıcıyı sıcak ve KISA bir mesajla karşıla.
- Acentenin adını kullanarak hoş geldiniz de.
- Ne konuda yardımcı olabileceğini 1–2 cümlede özetle.
- Son cümlede mutlaka ihtiyacını sor (tur, destinasyon veya tarih).

CEVAP FORMATIN:
- 1 satır: Karşılama cümlesi
- 1 satır: Nasıl yardımcı olabileceğini anlatan kısa özet
- 1 satır: "Hangi bölge / tur / tarih ile başlayalım?" tarzı net soru
- İstersen sonraki mesajlarda turları listelemek için alt alta "• " ile maddeler kullan.

Sistem için mevcut turlar (kullanıcıya birebir kopyalama zorunlu değil):
${toursList}`;
  }

  return `📍 STATUS: Initial greeting
- Greet the user warmly in a SHORT message.
- Use the agency name in the welcome sentence.
- In 1–2 sentences explain how you can help (tours, destinations, dates).
- End with a clear question about their need.

RESPONSE FORMAT:
- Line 1: Friendly greeting with agency name
- Line 2: Short explanation of how you can help
- Line 3: Direct question (e.g. "Which destination or type of tour are you interested in?")

Available tours for your internal context (no need to copy verbatim):
${toursList}`;
}
