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

// (2b) W2-a (2026-07-29): HİZMET-YÖNELİK SORU kalıpları — talep-fiili kadar geçerli
// ikinci sinyal. CANLI BUG: "Uçak bileti var mı" lead ÜRETMEDİ (talep-fiili yok +
// "var mı" VETO listesindeydi → çift-katmanlı kapalıydı).
// BİLİNÇLİ DIŞARIDA: "alıyor musunuz" (otelDEN alıyor musunuz = tur lojistiği,
// zorunlu FP-korpusunda) ve "gerekiyor mu / do I need" (bilgi-sorusu) → veto'da kalır.
export const LEAD_QUESTION_RE =
  /(?<![\p{L}\p{N}])(var\s*m[ıi]|sat[ıi]yor\s*musunuz|yap[ıi]yor\s*musunuz|ayarl[ıi]yor\s*musunuz|bak[ıi]yor\s*musunuz|bulu?yor\s*musunuz|temin\s+ediyor\s*musunuz|do\s+you\s+(?:have|sell|offer|arrange|provide|book)|can\s+you\s+(?:provide|arrange|sell)|gibt\s+es|bieten\s+sie|verkaufen\s+sie|organisieren\s+sie|avez[-\s]vous|proposez[-\s]vous|vendez[-\s]vous|tienen|venden|ofrecen|есть\s+ли|продаёте\s+ли|продаете\s+ли|предлагаете\s+ли|занимаетесь\s+ли|هل\s+لديكم|هل\s+توفرون|هل\s+تبيعون)(?![\p{L}\p{N}])/iu;

// (3) Tur-bağlam-sinyali — bunlardan biri varsa LEAD-DEĞİL (tur-sorusudur)
// W2-a: GENEL soru kalıpları ("var mı", "is there", "gibt es", "есть ли") buradan
// ÇIKARILDI — artık (2b)'de SİNYAL. Tur-özgü vetolar KALDI: dahil/included,
// tur/tour kelimeleri, "gerekiyor mu", "alıyor musunuz", "karşılıyor musunuz".
export const LEAD_TOUR_CONTEXT_RE =
  /(?<![\p{L}\p{N}])(dahil\p{L}*|included?|inklusive|enthalten|inclus\p{L}*|incluid\p{L}*|включ\p{L}*|يشمل|تشمل|مشمول|tur[au]?\p{L}*|tour\p{L}*|circuit\p{L}*|excursi[óo]n\p{L}*|ausflug\p{L}*|тур\p{L}*|экскурси\p{L}*|جولة|رحلة|gerek(?:iyor|li)\s*mi|al[ıi]yor\s*musunuz|kar[şs][ıi]l[ıi]yor\s*musunuz|do\s+i\s+need|brauche\s+ich|faut[-\s]il|se\s+necesita|нужна\s+ли|هل\s+أحتاج)(?![\p{L}\p{N}])/iu;

/** Tur-kataloğu bağlam kontrolü: mesajda acentenin tur adı/destinasyonu geçiyorsa
 *  bu bir TUR sorusudur (W2-a kritik FP-koruması: "Pamukkale için otel var mı"). */
function mentionsCatalog(lowerMsg: string, catalog?: LeadCatalog | null): boolean {
  if (!catalog) return false;
  const _tokens: string[] = [];
  for (const s of [...(catalog.tourTitles || []), ...(catalog.destinations || []), catalog.currentTourTitle || ""]) {
    for (const w of String(s || "").toLowerCase().split(/\s+/)) {
      // "turu/tour/gezi" gibi jenerik kelimeler zaten LEAD_TOUR_CONTEXT_RE'de;
      // burada yalnız ÖZEL adlar (≥4 harf) aranır.
      if (w.length >= 4 && !/^(tur\p{L}*|tour\p{L}*|gezi\p{L}*)$/iu.test(w)) _tokens.push(w);
    }
  }
  return _tokens.some((t) => lowerMsg.includes(t));
}

export interface LeadCatalog {
  currentTourTitle?: string | null;
  tourTitles?: string[];
  destinations?: string[];
}

/**
 * ÇİFT-ŞART tespit: hizmet-kelimesi VAR + (talep-fiili VEYA hizmet-sorusu) VAR
 * + tur-bağlamı YOK (regex vetosu VE tur-kataloğu adları).
 * catalog: string verilirse geriye-uyumlu currentTourTitle olarak yorumlanır.
 */
export function detectOutOfScopeLead(message: string, catalog?: LeadCatalog | string | null): boolean {
  if (!message || typeof message !== "string") return false;
  const m = message.trim();
  if (!LEAD_SERVICE_RE.test(m)) return false;
  if (!LEAD_INTENT_RE.test(m) && !LEAD_QUESTION_RE.test(m)) return false;
  if (LEAD_TOUR_CONTEXT_RE.test(m)) return false;
  const _cat: LeadCatalog | null =
    typeof catalog === "string" ? { currentTourTitle: catalog } : (catalog || null);
  if (mentionsCatalog(m.toLowerCase(), _cat)) return false;
  return true;
}

// Bot-metinleri — 7 dil ("satmıyoruz" tonu YOK; talebi iletme + akışa saygı)
// TON: nötr-işlem (talep alındı ack)
export const LEAD_ACK: Record<string, string> = {
  tr: "Bu konuda acentemiz size doğrudan yardımcı olabilir — talebinizi ilettim ✍️",
  en: "Our agency can help you with this directly — I've forwarded your request ✍️",
  de: "Unsere Agentur kann Ihnen dabei direkt helfen — ich habe Ihre Anfrage weitergeleitet ✍️",
  fr: "Notre agence peut vous aider directement — j'ai transmis votre demande ✍️",
  es: "Nuestra agencia puede ayudarle directamente — he transmitido su solicitud ✍️",
  ru: "Наше агентство поможет вам с этим напрямую — я передал(а) вашу заявку ✍️",
  ar: "يمكن لوكالتنا مساعدتك في ذلك مباشرة — قمت بإرسال طلبك ✍️",
};

// TON: neşeli-hafif (akışa dönüş)
export const LEAD_RESUME: Record<string, string> = {
  tr: "Kaldığımız yerden devam edelim ✨",
  en: "Let's continue where we left off ✨",
  de: "Machen wir dort weiter, wo wir aufgehört haben ✨",
  fr: "Reprenons là où nous en étions ✨",
  es: "Sigamos donde lo dejamos ✨",
  ru: "Продолжим с того места, где остановились ✨",
  ar: "لنكمل من حيث توقفنا ✨",
};

/** Mesaj TUR bağlamında mı? (W3-EK: detay-beklerken gelen alakasız/tur mesajını ayırt eder) */
export function isTourContextMessage(message: string, catalog?: LeadCatalog | string | null): boolean {
  if (!message) return false;
  if (LEAD_TOUR_CONTEXT_RE.test(message)) return true;
  const _cat: LeadCatalog | null =
    typeof catalog === "string" ? { currentTourTitle: catalog } : (catalog || null);
  return mentionsCatalog(message.toLowerCase(), _cat);
}

// W3-EK (2026-07-29): akış-DIŞI lead'de DETAY toplama. Taslak kayıt İLK mesajda
// açılır (kayıp yok), detay gelirse request_text güncellenir.
// TON: neşeli (satış/keşif — detay isteme)
export const LEAD_ASK_DETAIL: Record<string, string> = {
  tr: "Talebinizi acentemize iletmek isterim! ✍️ Kısaca detay verir misiniz? (örn. nereden nereye, hangi tarih, kaç kişi)",
  en: "I'd like to forward your request to our agency! ✍️ Could you give a few details? (e.g. from/to, which date, how many people)",
  de: "Ich leite Ihre Anfrage gerne an unsere Agentur weiter! ✍️ Können Sie kurz Details nennen? (z. B. von/nach, Datum, Personenzahl)",
  fr: "Je transmets volontiers votre demande à notre agence ! ✍️ Pouvez-vous donner quelques détails ? (ex. de/à, quelle date, combien de personnes)",
  es: "¡Con gusto transmito su solicitud a nuestra agencia! ✍️ ¿Puede darme algunos detalles? (p. ej. desde/hasta, qué fecha, cuántas personas)",
  ru: "С радостью передам вашу заявку агентству! ✍️ Уточните, пожалуйста, детали (откуда/куда, какая дата, сколько человек).",
  ar: "يسعدني إرسال طلبك إلى وكالتنا! ✍️ هل يمكنك ذكر بعض التفاصيل؟ (مثلاً من/إلى، التاريخ، عدد الأشخاص)",
};

/** Telefon bilinmiyorsa (demo/web yüzeyi) detay + telefon birlikte istenir. */
export const LEAD_ASK_DETAIL_PHONE: Record<string, string> = {
  tr: "Talebinizi acentemize iletmek isterim! ✍️ Kısaca detay (nereden nereye, tarih, kişi sayısı) ve size dönebilmemiz için telefon numaranızı yazar mısınız?",
  en: "I'd like to forward your request! ✍️ Could you share a few details (from/to, date, people) and your phone number so we can reach you?",
  de: "Ich leite Ihre Anfrage gerne weiter! ✍️ Bitte nennen Sie kurz Details (von/nach, Datum, Personen) und Ihre Telefonnummer für den Rückruf.",
  fr: "Je transmets volontiers votre demande ! ✍️ Pouvez-vous préciser quelques détails (de/à, date, personnes) et votre numéro de téléphone ?",
  es: "¡Con gusto transmito su solicitud! ✍️ ¿Puede indicar algunos detalles (desde/hasta, fecha, personas) y su número de teléfono?",
  ru: "С радостью передам вашу заявку! ✍️ Укажите, пожалуйста, детали (откуда/куда, дата, человек) и номер телефона для связи.",
  ar: "يسعدني إرسال طلبك! ✍️ يرجى ذكر بعض التفاصيل (من/إلى، التاريخ، عدد الأشخاص) ورقم هاتفك للتواصل.",
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

// W3-b (2026-07-29): YAZIM BAŞARISIZSA vaat EDİLMEZ — "ilettim" yerine dürüst mesaj.
// E1-dersi (bot "aldım" deyip kaydetmemişti) bu sınıfın ikinci örneğiydi; desen artık
// "önce yaz, sonra vaat et" (promise-after-write).
// TON: ciddi (kayıt DÜŞMEDİ — hata durumu; emoji yok)
export const LEAD_FAILED: Record<string, string> = {
  tr: "Talebinizi şu an kaydedemedim. Telefon numaranızla birlikte tekrar yazar mısınız?",
  en: "I couldn't record your request right now 😔 Could you write again with your phone number?",
  de: "Ihre Anfrage konnte gerade nicht gespeichert werden 😔 Bitte schreiben Sie erneut mit Ihrer Telefonnummer.",
  fr: "Je n'ai pas pu enregistrer votre demande 😔 Pouvez-vous réécrire avec votre numéro de téléphone ?",
  es: "No pude registrar su solicitud ahora 😔 ¿Puede escribir de nuevo con su número de teléfono?",
  ru: "Не удалось сохранить вашу заявку 😔 Напишите, пожалуйста, ещё раз с номером телефона.",
  ar: "لم أتمكن من تسجيل طلبك الآن 😔 هل يمكنك إعادة الكتابة مع رقم هاتفك؟",
};

export const LEAD_SAVED: Record<string, string> = {
  // E4-1 (2026-08-10): "en kısa sürede" vaadi buradan ÇIKTI — basım noktası
  // buildFollowupClosing ile gerçekçi kapanış ekliyor (working_hours dahil).
  tr: "Teşekkürler, talebinizi acentemize ilettim 🤝",
  en: "Thank you, I've forwarded your request to our agency 🤝",
  de: "Danke, ich habe Ihre Anfrage an unsere Agentur weitergeleitet 🤝",
  fr: "Merci, j'ai transmis votre demande à notre agence 🤝",
  es: "Gracias, he trasladado su solicitud a nuestra agencia 🤝",
  ru: "Спасибо, я передал вашу заявку в наше агентство 🤝",
  ar: "شكراً، أحلت طلبك إلى وكالتنا 🤝",
};

// ═══════════════════════════════════════════════════════════════════════════
// W5 (2026-08-01): YAZILIM-TALEBİ YAKALAMA — Click-to-WhatsApp reklam hazırlığı
//
// BAĞLAM: reklamla Aymila'nın GERÇEK botuna acente sahipleri gelecek ve
// "müşteri gibi" deneyip rolden çıkarak yazılımın KENDİSİNİ soracaklar.
// ÖLÇÜM (31 Tem, 6 prob, demo yüzeyi) — 6/6 KAYIP:
//   "bu sistemi ben de acenteme almak istiyorum" → "sadece tur bilgisi ve
//      rezervasyon konularında yardımcı olabilirim"
//   "bu bot ne kadar, fiyatı nedir"              → "satışta değildir"
//   "bu yazılımı kim yaptı"                      → "bilgi veremiyorum"
//   "turzz nedir"                                → kendini Demo Turizm sanıp
//                                                  tur listesine dönüyor
// Yani en değerli ziyaretçi (potansiyel acente) hiçbir iz bırakmadan gidiyordu.
//
// ⚠️ KAPSAM KISITI (W5-REV): bu kategori ACENTE-BAZLI BAYRAKLA kapılıdır
//    (agencies.software_inquiry_enabled, default FALSE; yalnız Aymila TRUE).
//    Gerekçe: Aymila = Turzz'un tanıtım/demo kanalı. Diğer acentelerin
//    MÜŞTERİ kanalına Turzz-satışı sızmamalı — bir müşteri "sisteminiz güzelmiş"
//    dediğinde o acentenin botu Turzz adına satış yapmaya kalkmamalı.
//    Bayrak kontrolü ÇAĞIRAN tarafta, regex'e girmeden (erken-çıkış).
// ═══════════════════════════════════════════════════════════════════════════

/** Yazılımın kendisini işaret eden özneler. */
const SOFTWARE_SUBJECT_RE =
  /(?<![\p{L}\p{N}])(?:turzz|yaz[ıi]l[ıi]m|chatbot|bot|panel|program|uygulama|sistem|software|application|app|system|programm|anwendung|logiciel|syst[èe]me|aplicaci[óo]n|programa|программ|систем|приложени|бот|(?:ال)?برنامج|(?:ال)?نظام|(?:ال)?تطبيق)|(?<![\p{L}\p{N}])(?:bunu|bunun|bu\s*i[şs]i|this\s*one|das\s*hier|[çc]a|esto|это|هذا)(?=[\s\S]{0,40}(?:ben(?:de|im)|bana\s*da|bize\s*de|kurar|kurabilir|alabilir|al[ıi]r|for\s*me|f[üu]r\s*mich|pour\s*moi|para\s*m[íi]|мне|لي))/iu;

/**
 * İkinci şart — P4-3 deseniyle aynı mantık ama yazılım-alıcısının diliyle:
 * talep-fiili (LEAD_INTENT_RE) VEYA ticari soru (LEAD_QUESTION_RE) VEYA
 * fiyat/paket/demo/üretici sorusu.
 */
const SOFTWARE_QUALIFIER_RE =
  /(?<![\p{L}\p{N}])(?:ne\s*kadar|fiyat|[üu]cret|maliyet|paket|abonelik|lisans|demo|deneme|kim\s*(?:yapt|geli[şs]tir|[üu]ret)|nedir|ne\s*i[şs]e\s*yara|sat[ıi]n\s*al|almak\s*ist|kullanmak\s*ist|kurmak\s*ist|ar[ıi]yoruz|ar[ıi]yorum|teklif|looking\s*for|interested\s*in|auf\s*der\s*suche|[àa]\s*la\s*recherche|buscando|ищем|ищу|نبحث|how\s*much|price|cost|pricing|subscription|licen[cs]e|trial|who\s*(?:made|built|develop)|what\s*is|quote|preis|kost(?:en|et)|abonnement|testversion|wer\s*hat|combien|tarif|abonnement|essai|qui\s*a\s*(?:fait|d[ée]velopp)|cu[áa]nto\s*cuesta|precio|suscripci[óo]n|prueba|qui[ée]n\s*(?:hizo|desarroll)|сколько\s*стоит|цена|подписк|демо|пробн|кто\s*(?:сделал|разработ)|كم\s*(?:سعر|تكلفة)|اشتراك|تجريب|من\s*(?:صنع|طور))|(?<![\p{L}\p{N}])(?:ben(?:de|im\s*i[çc]in)|bana\s*da|bize\s*de)[\s\S]{0,30}(?:ist(?:iyor|erim|edik)|laz[ıi]m|kullan|kur)|(?<![\p{L}\p{N}])(?:ist(?:iyor|erim)|laz[ıi]m|kullanmak|kurmak)[\s\S]{0,25}(?:ben(?:de|im)|bize|bana)|(?<![\p{L}\p{N}])ka[çc]\s*para|(?<![\p{L}\p{N}])nas[ıi]l\s*(?:al[ıi]r|alabilir|edinebilir|kurdur)|(?<![\p{L}\p{N}])kur(?:ar|abilir)\s*m[ıi]s[ıi]n|(?<![\p{L}\p{N}])(?:i\s*want\s*(?:this|it|one)(?:\s*too)?|want\s*(?:this|it)\s*(?:too|as\s*well)|for\s*me\s*too|set\s*(?:this|it)\s*up|how\s*can\s*i\s*get)|(?<![\p{L}\p{N}])(?:auch\s*haben|f[üu]r\s*mich\s*auch|wie\s*bekomme|will\s*das\s*auch)|(?<![\p{L}\p{N}])(?:moi\s*aussi|aussi\s*avoir|comment\s*(?:puis[- ]je\s*)?(?:l['’]?)?obtenir)|(?<![\p{L}\p{N}])(?:yo\s*tambi[ée]n|tambi[ée]n\s*quiero|c[óo]mo\s*(?:puedo\s*)?(?:conseguir|obtener))|(?<![\p{L}\p{N}])(?:тоже\s*хочу|мне\s*тоже|как\s*(?:получить|приобрести))|(?:[أا]ريد[\s\S]{0,15}[أا]يض|كيف\s*[أا]حصل)/iu;

/**
 * VETO — SON TÜKETİCİ tur-bağlamı. Bunlar "sistem/bot" kelimesi geçse bile
 * yazılım talebi DEĞİLDİR ve karşılığı canlıda pahalıdır (müşteriye Turzz
 * satmaya kalkmak). Zorunlu negatif korpus test dosyasında kilitli:
 *   "sistemde hangi turlar var" · "sisteminizde Kapadokya var mı"
 *   "rezervasyon sistemi üzerinden mi ödeyeceğim"
 * Ayrıca kimlik sorusu ("bot musun / gerçek insan mısın") de veto —
 * bu mevcut davranışında (LLM'in doğal cevabı) bırakılır.
 */
const SOFTWARE_VETO_RE =
  /(?<![\p{L}\p{N}])(?:tur(?!zz)(?:lar|unuz|umuz|a|u|da|dan)?|rezervasyon|bilet|kontenjan|[öo]de(?:me|yece|ycek)|tarih|kalk[ıi][şs]|gezi|tatil|tour|booking|reservation|payment|reise|buchung|circuit|r[ée]servation|paiement|reserva|viaje|тур|брониров|оплат|رحلة|حجز|دفع|bot\s*musun|robot\s*musun|ger[çc]ek\s*(?:insan|ki[şs]i)|insan\s*m[ıi]s[ıi]n|are\s*you\s*(?:a\s*)?(?:bot|human|real)|bist\s*du\s*ein\s*(?:bot|mensch)|es[- ]?tu\s*un\s*(?:bot|humain)|eres\s*(?:un\s*)?(?:bot|humano)|ты\s*(?:бот|человек)|هل\s*[أا]نت\s*(?:روبوت|إنسان))/iu;

/**
 * ÇİFT-ŞART + VETO: yazılım-öznesi VAR + nitelik sorusu VAR + tur-bağlamı YOK
 * (regex vetosu VE tur-kataloğu adları — "sisteminizde Kapadokya var mı").
 * ⚠️ Çağıran taraf agencies.software_inquiry_enabled'ı ÖNCE kontrol etmeli.
 */
export function detectSoftwareInquiry(message: string, catalog?: LeadCatalog | string | null): boolean {
  const m = (message || "").trim();
  if (!m) return false;
  if (!SOFTWARE_SUBJECT_RE.test(m)) return false;
  if (!SOFTWARE_QUALIFIER_RE.test(m)) return false;
  if (SOFTWARE_VETO_RE.test(m)) return false;
  const _cat: LeadCatalog | null =
    typeof catalog === "string" ? { currentTourTitle: catalog } : (catalog ?? null);
  if (mentionsCatalog(m.toLowerCase(), _cat)) return false;
  return true;
}

/** Yakalanınca: TUR-SATIŞ TONUNDAN ÇIKAN karşılama (7-dil). */
// TON: neşeli-iş (B2B karşılama)
export const SW_ASK_DETAIL: Record<string, string> = {
  tr: "Turzz AI'yı acenteniz için mi değerlendiriyorsunuz? Harika! 🎉 Talebinizi ekibimize iletiyorum — kısaca acente adınızı ve size nasıl ulaşalım yazar mısınız?",
  en: "Are you considering Turzz AI for your own agency? Great! 🎉 I'm forwarding your request to our team — could you share your agency name and how we can reach you?",
  de: "Prüfen Sie Turzz AI für Ihre eigene Agentur? Ausgezeichnet! 🎉 Ich leite Ihre Anfrage an unser Team weiter — nennen Sie uns kurz Ihren Agenturnamen und wie wir Sie erreichen können?",
  fr: "Vous envisagez Turzz AI pour votre propre agence ? Parfait ! 🎉 Je transmets votre demande à notre équipe — pouvez-vous indiquer le nom de votre agence et comment vous joindre ?",
  es: "¿Está evaluando Turzz AI para su propia agencia? ¡Genial! 🎉 Traslado su solicitud a nuestro equipo — ¿puede indicarnos el nombre de su agencia y cómo contactarle?",
  ru: "Рассматриваете Turzz AI для своего агентства? Отлично! 🎉 Передаю вашу заявку нашей команде — напишите, пожалуйста, название агентства и как с вами связаться.",
  ar: "هل تفكر في Turzz AI لوكالتك؟ رائع! 🎉 سأحيل طلبك إلى فريقنا — هل يمكنك ذكر اسم وكالتك وكيفية التواصل معك؟",
};

/** Akış-içi kısa ack (rezervasyon bölünmez — P4-3 (B) dalıyla aynı kural). */
// TON: nötr-işlem
export const SW_ACK: Record<string, string> = {
  tr: "Turzz AI ile ilgilendiğinizi ekibimize ilettim 🎉",
  en: "I've let our team know you're interested in Turzz AI 🎉",
  de: "Ich habe unser Team über Ihr Interesse an Turzz AI informiert 🎉",
  fr: "J'ai informé notre équipe de votre intérêt pour Turzz AI 🎉",
  es: "He informado a nuestro equipo de su interés en Turzz AI 🎉",
  ru: "Я сообщил нашей команде о вашем интересе к Turzz AI 🎉",
  ar: "أبلغت فريقنا باهتمامك بـ Turzz AI 🎉",
};

/** Detay geldikten sonra kapanış. */
// TON: ciddi-iş (B2B) — hedef kitle ACENTE SAHİBİ; 🚀/startup-neşesi değil,
// ölçülebilir vaat: "bir iş günü". (E2-1 ton-sınıfı, 2026-08-10)
export const SW_SAVED: Record<string, string> = {
  tr: "Talebiniz Turzz ekibine iletildi. En geç bir iş günü içinde dönüş yapılır.",
  en: "Your request has been forwarded to the Turzz team. You will hear back within one business day.",
  de: "Ihre Anfrage wurde an das Turzz-Team weitergeleitet. Sie erhalten innerhalb eines Werktags eine Rückmeldung.",
  fr: "Votre demande a été transmise à l'équipe Turzz. Vous recevrez une réponse sous un jour ouvré.",
  es: "Su solicitud ha sido enviada al equipo de Turzz. Recibirá respuesta en un día hábil.",
  ru: "Ваша заявка передана команде Turzz. Ответ поступит в течение одного рабочего дня.",
  ar: "تمت إحالة طلبك إلى فريق Turzz. سيتم الرد خلال يوم عمل واحد.",
};

// ═══════════════════════════════════════════════════════════════════════════
// W5-FIX (d) — SORU-KÖPRÜSÜ (2026-08-01)
//
// Canlı W5-FAIL komşu-kümesinde iki cümle hiçbir regexle çözülemezdi:
//   "bende istiyorum bunu" · "bana da kurar mısınız"
// Çünkü yazılım ÖZNESİ yok — anlam bir ÖNCEKİ mesajda. Tek mesaja bakan
// hiçbir kalıp bunu çözemez.
//
// ÇÖZÜM: kesin-yakalama yerine SORU. Yazılım öznesi VAR ama nitelik bacağı
// tutmadıysa (ve tur-vetosu temizse) bot iddia kurmaz, SORAR. Cevap "evet"
// ise normal software_inquiry zinciri işler. FP riski ~0: yanlış tetiklense
// bile müşteri "hayır" der, hiçbir kayıt açılmaz.
//
// ÖMÜR: TEK TURN. pendingSoftwareBridge bir sonraki mesajda ya onaya döner ya
// da sessizce temizlenir — süpürücüye ihtiyaç YOK (pendingLeadCapture'ın
// aksine burada AÇILMIŞ bir kayıt yok, dolayısıyla kaybolacak veri de yok).
// ═══════════════════════════════════════════════════════════════════════════

/** Köprü koşulu: özne VAR + nitelik YOK + veto temiz + katalog temiz. */
export function detectSoftwareBridge(message: string, catalog?: LeadCatalog | string | null): boolean {
  const m = (message || "").trim();
  if (!m) return false;
  if (!SOFTWARE_SUBJECT_RE.test(m)) return false;
  if (SOFTWARE_QUALIFIER_RE.test(m)) return false;   // zaten kesin-yakalama yolu
  if (SOFTWARE_VETO_RE.test(m)) return false;
  const _cat: LeadCatalog | null =
    typeof catalog === "string" ? { currentTourTitle: catalog } : (catalog ?? null);
  if (mentionsCatalog(m.toLowerCase(), _cat)) return false;
  return true;
}

/** Köprüden sonra ÇIPLAK onay/istek — "evet", "bende istiyorum", "olur" … */
// TON: nötr-soru (iddiasız köprü)
export const SW_BRIDGE_YES_RE =
  /(?<![\p{L}\p{N}])(?:evet|tabii|tabi|olur|isterim|istiyorum|ilgileniyorum|l[üu]tfen|tamam|yes|sure|please|yeah|ja|bitte|genau|oui|volontiers|s[íi]|claro|por\s*favor|да|конечно|хочу|نعم|بالتأكيد|أريد|ben(?:de|im)\s*(?:de\s*)?(?:ist|laz)|bana\s*da)/iu;

/** Köprüye AÇIK RET — "yok, tur soruyordum" sınıfı. */
export const SW_BRIDGE_NO_RE =
  /(?<![\p{L}\p{N}])(?:hay[ıi]r|yok|de[ğg]il|istemiyorum|bo[şs]\s*ver|no|nope|nein|non|нет|لا)/iu;

/** Köprü sorusu — İDDİA DEĞİL SORU (7-dil). */
export const SW_BRIDGE: Record<string, string> = {
  tr: "Turzz AI sistemini mi kastediyorsunuz? Acenteniz için bilgi almak isterseniz talebinizi ekibimize iletebilirim 😊",
  en: "Do you mean the Turzz AI system? If you'd like information for your own agency, I can forward your request to our team 😊",
  de: "Meinen Sie das Turzz-AI-System? Wenn Sie Informationen für Ihre eigene Agentur möchten, leite ich Ihre Anfrage gerne an unser Team weiter 😊",
  fr: "Parlez-vous du système Turzz AI ? Si vous souhaitez des informations pour votre propre agence, je peux transmettre votre demande à notre équipe 😊",
  es: "¿Se refiere al sistema Turzz AI? Si desea información para su propia agencia, puedo trasladar su solicitud a nuestro equipo 😊",
  ru: "Вы имеете в виду систему Turzz AI? Если хотите информацию для своего агентства, я передам вашу заявку нашей команде 😊",
  ar: "هل تقصد نظام Turzz AI؟ إذا كنت ترغب في معلومات لوكالتك، يمكنني إحالة طلبك إلى فريقنا 😊",
};
