// Format rules for all languages
export const FORMAT_PROMPTS: Record<string, string> = {
  tr: `FORMAT KURALLARI (TÜM MESAJLAR İÇİN):
- Mesajlarını 2–4 satırlık bloklar halinde yaz, sıkışık paragraf kullanma.
- Liste verirken her maddeyi yeni satırda ve "• " ile başlat.
- Tur listelerinden önce kısa bir giriş cümlesi yaz, sonra boş satır bırak, ardından maddeleri ver.
- Önemli kelimeleri vurgulamak istersen *tek yıldız* ile kalın yazabilirsin (WhatsApp formatı).
- ASLA **çift yıldız** kullanma, sadece *tek yıldız* kullan.
- Her mesaj bir soru veya net bir sonraki adım ile bitsin (örneğin: "Hangi tarihi tercih edersiniz?").`,

  en: `FORMAT RULES (FOR ALL MESSAGES):
- Write messages in short blocks of 2–4 lines, avoid dense paragraphs.
- When listing options, start each item on a new line with "• ".
- Before a tour list, write a short intro sentence, then an empty line, then the bullet list.
- Use *single asterisk* for bold/emphasis (WhatsApp format). NEVER use **double asterisks**.
- Always end the message with a clear question or next step (e.g. "Which date would you prefer?").`,

  de: `FORMATREGELN (FÜR ALLE NACHRICHTEN):
- Schreibe Nachrichten in kurzen Blöcken von 2–4 Zeilen, vermeide dichte Absätze.
- Bei Listen beginne jeden Punkt in einer neuen Zeile mit "• ".
- Verwende *einfache Sternchen* für Fettschrift (WhatsApp-Format). NIEMALS **doppelte Sternchen** verwenden.
- Beende jede Nachricht mit einer klaren Frage oder dem nächsten Schritt.`,

  ru: `ПРАВИЛА ФОРМАТИРОВАНИЯ (ДЛЯ ВСЕХ СООБЩЕНИЙ):
- Пишите сообщения короткими блоками по 2–4 строки.
- При перечислении начинайте каждый пункт с новой строки с "• ".
- Используйте *одну звёздочку* для выделения (формат WhatsApp). НИКОГДА не используйте **двойные звёздочки**.
- Завершайте каждое сообщение чётким вопросом или следующим шагом.`,

  ar: `قواعد التنسيق (لجميع الرسائل):
- اكتب الرسائل في فقرات قصيرة من 2-4 أسطر.
- عند سرد الخيارات، ابدأ كل عنصر في سطر جديد بـ "• ".
- استخدم *نجمة واحدة* للتمييز (تنسيق WhatsApp). لا تستخدم أبدًا **نجمتين**.
- أنهِ كل رسالة بسؤال واضح أو الخطوة التالية.`,

  fr: `RÈGLES DE FORMAT (POUR TOUS LES MESSAGES):
- Écrivez des messages en courts blocs de 2–4 lignes, évitez les paragraphes denses.
- Pour les listes, commencez chaque élément sur une nouvelle ligne avec "• ".
- Utilisez *un seul astérisque* pour le gras (format WhatsApp). N'utilisez JAMAIS **deux astérisques**.
- Terminez chaque message par une question claire ou une prochaine étape.`,

  es: `REGLAS DE FORMATO (PARA TODOS LOS MENSAJES):
- Escribe mensajes en bloques cortos de 2–4 líneas, evita párrafos densos.
- Al listar opciones, comienza cada elemento en una nueva línea con "• ".
- Usa *un solo asterisco* para negrita (formato WhatsApp). NUNCA uses **doble asterisco**.
- Termina siempre con una pregunta clara o el siguiente paso.`,
};

export function getFormatPrompt(language: string): string {
  return FORMAT_PROMPTS[language] || FORMAT_PROMPTS.en;
}
