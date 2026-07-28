// P4-3 (2026-07-28): TUR-DIŞI TİCARİ-TALEP tespiti — TEK-KAYNAK, 7-dil.
// Tasarım (onaylı): DETERMİNİSTİK-ÖNCE, ÇİFT-ŞART:
//   (1) tur-dışı HİZMET-kelimesi VAR (uçak/otel/transfer/vize/araç/sigorta)
//   (2) TALEP-fiili VAR (istiyorum/ayarlar mısınız/arıyorum/lazım…)
//   (3) tur-bağlam-sinyali YOK ("dahil mi", tur-kelimesi, "gerekiyor mu" bilgi-sorusu)
// NLU'ya birincil güven YOK (K1/A-GATE Haiku-dersleri); mevcut visa_support/
// hotel_details intent'leri tur-bağlamı için kalır — çelişkide deterministik kazanır.
// FP-korpusu ZORUNLU (7671d68 disiplini): "uçak dahil mi", "otelden alıyor musunuz",
// "transfer dahil mi", "vize gerekiyor mu" LEAD-DEĞİL (test_behavioral P4-3 bloğu).
// \p{L}\p{N} lookaround (ASCII \b YASAK — Yan #8).

// (1) Tur-dışı hizmet-kelimeleri — 7 dil
export const LEAD_SERVICE_RE =
  /(?<![\p{L}\p{N}])(u[çc]ak\p{L}*|u[çc]u[şs]\p{L}*|bilet\p{L}*|otel\p{L}*|konaklama|transfer\p{L}*|vize\p{L}*|araba\s+kirala\p{L}*|ara[çc]\s+kirala\p{L}*|rent\s*a\s*car|sigorta\p{L}*|flight\p{L}*|plane\s+ticket|air\s*ticket\p{L}*|hotel\p{L}*|accommodation|visa\p{L}*|car\s+rental|insurance|flug\p{L}*|flugticket\p{L}*|unterkunft|visum\p{L}*|mietwagen\p{L}*|versicherung\p{L}*|vol\s+(?:pour|vers|a)\p{L}*|billet\s+d['e]avion|h[ôo]tel\p{L}*|h[ée]bergement|louer\s+une\s+voiture|assurance\p{L}*|vuelo\p{L}*|billete\s+de\s+avi[óo]n|alojamiento|visado\p{L}*|alquil\p{L}*\s+(?:de\s+)?coche|seguro\p{L}*|авиабилет\p{L}*|рейс\p{L}*|самол[её]т\p{L}*|отел\p{L}*|гостиниц\p{L}*|виз[уыа]\p{L}*|трансфер\p{L}*|аренд\p{L}*\s+(?:авто|машин\p{L}*)|страховк\p{L}*|طيران|تذكرة\s+طيران|فندق\p{L}*|إقامة|تأشيرة|فيزا|نقل\s+من\s+المطار|تأجير\s+سيارة|تأمين)(?![\p{L}\p{N}])/iu;

// (2) Talep-fiilleri — açık edinme/ayarlama niyeti (bilgi-sorusu fiilleri BİLİNÇLİ DIŞARIDA:
// "gerekiyor mu / var mı / alıyor musunuz" talep DEĞİL)
export const LEAD_INTENT_RE =
  /(?<![\p{L}\p{N}])(istiyor[uü]m|almak\s+istiyorum|ar[ıi]yorum|laz[ıi]m|ayarla(?:r\s*m[ıi]s[ıi]n[ıi]z|yabilir\s*misiniz)\p{L}*|bakar\s*m[ıi]s[ıi]n[ıi]z|yard[ıi]mc[ıi]\s+olur\s*musunuz|i\s+(?:want|need)(?:\s+to\s+(?:book|buy|get|rent))?|looking\s+for|can\s+you\s+(?:book|arrange|get|find)|could\s+you\s+(?:book|arrange)|help\s+me\s+(?:book|find|get)|ich\s+(?:m[öo]chte|brauche|suche)|k[öo]nnen\s+sie\s+(?:buchen|organisieren|arrangieren)|je\s+(?:veux|voudrais|cherche)|j['e]ai\s+besoin|pouvez[-\s]vous\s+(?:r[ée]server|organiser|arranger)|quiero|necesito|busco|puede\s+(?:reservar|conseguir|organizar)|me\s+(?:puede|pueden)\s+(?:ayudar|conseguir)|хочу|нужн[оаы]|ищу|можете\s+(?:ли\s+)?(?:забронировать|организовать|устроить|помочь)|забронир\p{L}*\s+(?:мне|нам)|أريد|أحتاج|أبحث\s+عن|هل\s+يمكنك(?:م)?\s+(?:حجز|ترتيب|تأمين)|ممكن\s+(?:تحجز|ترتب))(?![\p{L}\p{N}])/iu;

// (3) Tur-bağlam-sinyali — bunlardan biri varsa LEAD-DEĞİL (tur-sorusudur)
export const LEAD_TOUR_CONTEXT_RE =
  /(?<![\p{L}\p{N}])(dahil\p{L}*|included?|inklusive|enthalten|inclus\p{L}*|incluid\p{L}*|включ\p{L}*|يشمل|تشمل|مشمول|tur[au]?\p{L}*|tour\p{L}*|circuit\p{L}*|excursi[óo]n\p{L}*|ausflug\p{L}*|тур\p{L}*|экскурси\p{L}*|جولة|رحلة|gerek(?:iyor|li)\s*mi|var\s*m[ıi]|al[ıi]yor\s*musunuz|kar[şs][ıi]l[ıi]yor\s*musunuz|do\s+i\s+need|is\s+there|brauche\s+ich|faut[-\s]il|se\s+necesita|нужна\s+ли|هل\s+أحتاج)(?![\p{L}\p{N}])/iu;

/**
 * ÇİFT-ŞART tespit: hizmet-kelimesi VAR + talep-fiili VAR + tur-bağlam-sinyali YOK.
 * currentTourTitle verilirse mesajda tur-adı-parçası geçmesi de bağlam sayılır.
 */
export function detectOutOfScopeLead(message: string, currentTourTitle?: string | null): boolean {
  if (!message || typeof message !== "string") return false;
  const m = message.trim();
  if (!LEAD_SERVICE_RE.test(m)) return false;
  if (!LEAD_INTENT_RE.test(m)) return false;
  if (LEAD_TOUR_CONTEXT_RE.test(m)) return false;
  if (currentTourTitle) {
    const firstWord = currentTourTitle.toLowerCase().split(/\s+/)[0];
    if (firstWord && firstWord.length >= 4 && m.toLowerCase().includes(firstWord)) return false;
  }
  return true;
}

// Bot-metinleri — 7 dil ("satmıyoruz" tonu YOK; talebi iletme + akışa saygı)
export const LEAD_ACK: Record<string, string> = {
  tr: "Bu konuda acentemiz size doğrudan yardımcı olabilir — talebinizi ilettim ✍️",
  en: "Our agency can help you with this directly — I've forwarded your request ✍️",
  de: "Unsere Agentur kann Ihnen dabei direkt helfen — ich habe Ihre Anfrage weitergeleitet ✍️",
  fr: "Notre agence peut vous aider directement — j'ai transmis votre demande ✍️",
  es: "Nuestra agencia puede ayudarle directamente — he transmitido su solicitud ✍️",
  ru: "Наше агентство поможет вам с этим напрямую — я передал(а) вашу заявку ✍️",
  ar: "يمكن لوكالتنا مساعدتك في ذلك مباشرة — قمت بإرسال طلبك ✍️",
};

export const LEAD_RESUME: Record<string, string> = {
  tr: "Kaldığımız yerden devam edelim ✨",
  en: "Let's continue where we left off ✨",
  de: "Machen wir dort weiter, wo wir aufgehört haben ✨",
  fr: "Reprenons là où nous en étions ✨",
  es: "Sigamos donde lo dejamos ✨",
  ru: "Продолжим с того места, где остановились ✨",
  ar: "لنكمل من حيث توقفنا ✨",
};

export const LEAD_ASK_PHONE: Record<string, string> = {
  tr: "Talebinizi aldım! Size dönüş yapabilmemiz için telefon numaranızı yazar mısınız? 📱",
  en: "Got your request! Could you share your phone number so we can get back to you? 📱",
  de: "Anfrage erhalten! Können Sie uns Ihre Telefonnummer geben, damit wir uns melden? 📱",
  fr: "Demande reçue ! Pouvez-vous laisser votre numéro pour que nous vous rappelions ? 📱",
  es: "¡Solicitud recibida! ¿Puede dejar su teléfono para que le contactemos? 📱",
  ru: "Заявка получена! Оставьте, пожалуйста, номер телефона, чтобы мы связались с вами 📱",
  ar: "استلمت طلبك! هل يمكنك كتابة رقم هاتفك لنتواصل معك؟ 📱",
};

export const LEAD_SAVED: Record<string, string> = {
  tr: "Teşekkürler! Acentemiz en kısa sürede sizinle iletişime geçecek 🤝",
  en: "Thank you! Our agency will contact you shortly 🤝",
  de: "Danke! Unsere Agentur meldet sich in Kürze bei Ihnen 🤝",
  fr: "Merci ! Notre agence vous contactera très prochainement 🤝",
  es: "¡Gracias! Nuestra agencia se pondrá en contacto en breve 🤝",
  ru: "Спасибо! Наше агентство свяжется с вами в ближайшее время 🤝",
  ar: "شكراً! ستتواصل معك وكالتنا في أقرب وقت 🤝",
};
