// ═══════════════════════════════════════════════════════════════════════════
// SEO-1 (2026-08-12): BLOG ANATOMİSİ — TEK KAYNAK
//
// Rakip-analizi bulgusu: makale-anatomisi zayıftı (TOC yok, makale-içi CTA yok,
// ilgili-yazılar yalnız sidebar listesiydi). Her şey ŞABLON seviyesinde:
// BlogPost.tsx tek şablon olduğu için 84+ posta otomatik uygulanır ve gelecek
// her post hazır doğar.
//
// CTA metinleri BURADA tek-kaynak — kampanya değişince tek yerden güncellenir.
// KOZ: rakipte "sizi arayalım", bizde CANLI DEMO (Aymila hattına wa.me).
// ═══════════════════════════════════════════════════════════════════════════

/** Aymila demo hattı (Turzz tanıtım kanalı — W5 software_inquiry bayrağı açık). */
export const DEMO_WA_URL = "https://wa.me/908505002311";
export const SIGNUP_URL = "/auth?mode=signup";

export interface TocItem {
  level: 2 | 3;
  text: string;
  id: string;
}

/** TR-duyarlı, deterministik başlık-slug'ı (heading id = TOC anchor). */
export function slugifyHeading(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[ıİI]/g, "i")
    .replace(/[öÖ]/g, "o").replace(/[şŞ]/g, "s").replace(/[üÜ]/g, "u")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9а-яё؀-ۿ\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/** Markdown'dan H2/H3 çıkarır (kod bloklarındaki # işaretleri atlanır). */
export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  let inCode = false;
  for (const line of markdown.split("\n")) {
    if (/^```/.test(line.trim())) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[2].replace(/\*\*/g, "").trim();
    items.push({ level: m[1].length as 2 | 3, text, id: slugifyHeading(text) });
  }
  return items;
}

/**
 * Makaleyi orta-CTA için ikiye böler: karakter-uzunluğunun ~%50'sinden SONRAKİ
 * İLK "## " sınırından. H-hiyerarşisi bozulmaz (bölme yalnız H2 önünde).
 * Uygun sınır yoksa [tamamı, ""] döner (kısa makale → yalnız makale-sonu CTA).
 */
export function splitForMidCta(markdown: string): [string, string] {
  const half = Math.floor(markdown.length / 2);
  const idx = markdown.indexOf("\n## ", half);
  if (idx < 0) return [markdown, ""];
  return [markdown.slice(0, idx), markdown.slice(idx + 1)];
}

/** ~200 kelime/dk okuma süresi (frontmatter yoksa fallback — blog.ts ile aynı kural). */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.ceil(markdown.split(/\s+/).length / 200));
}

// ─── CTA / etiket metinleri — 7 dil, tek kaynak ─────────────────────────────
type L = "tr" | "en" | "de" | "fr" | "es" | "ru" | "ar";
export interface CtaTexts {
  tocTitle: string;
  midTitle: string;
  midBtn: string;
  midSecondary: string;
  endTitle: string;
  endDesc: string;
  endBtn: string;
  endSecondary: string;
  updatedLabel: string;
  shareWhatsApp: string;
  shareLinkedIn: string;
  relatedTitle: string;
}

export const BLOG_CTA: Record<L, CtaTexts> = {
  tr: {
    tocTitle: "İçindekiler",
    midTitle: "Botu şimdi deneyin: müşteriniz gibi yazın, rezervasyonu nasıl aldığını görün 📱",
    midBtn: "WhatsApp'ta canlı dene",
    midSecondary: "14 gün ücretsiz başlat",
    endTitle: "Okumak yerine deneyin",
    endDesc: "Turzz AI'ın gerçek WhatsApp botuna müşteri gibi yazın — turu seçsin, tarihi sorsun, rezervasyonu alsın. Sonra aynısını kendi acenteniz için 14 günde ücretsiz kurun.",
    endBtn: "Canlı demoya yazın 📱",
    endSecondary: "14 gün ücretsiz deneyin",
    updatedLabel: "Güncellendi",
    shareWhatsApp: "WhatsApp'ta paylaş",
    shareLinkedIn: "LinkedIn'de paylaş",
    relatedTitle: "İlgili Yazılar",
  },
  en: {
    tocTitle: "Table of Contents",
    midTitle: "Try the bot now: write like your customer and watch it take the booking 📱",
    midBtn: "Try live on WhatsApp",
    midSecondary: "Start 14-day free trial",
    endTitle: "Don't just read it — try it",
    endDesc: "Message Turzz AI's real WhatsApp bot like a customer — let it pick the tour, ask the date, take the booking. Then set up the same for your agency free for 14 days.",
    endBtn: "Message the live demo 📱",
    endSecondary: "Try free for 14 days",
    updatedLabel: "Updated",
    shareWhatsApp: "Share on WhatsApp",
    shareLinkedIn: "Share on LinkedIn",
    relatedTitle: "Related Articles",
  },
  de: {
    tocTitle: "Inhaltsverzeichnis",
    midTitle: "Testen Sie den Bot jetzt: Schreiben Sie wie Ihr Kunde und sehen Sie, wie er bucht 📱",
    midBtn: "Live auf WhatsApp testen",
    midSecondary: "14 Tage kostenlos starten",
    endTitle: "Nicht nur lesen — ausprobieren",
    endDesc: "Schreiben Sie dem echten WhatsApp-Bot von Turzz AI wie ein Kunde — Tour wählen, Datum klären, Buchung abschließen. Danach richten Sie dasselbe 14 Tage kostenlos für Ihre Agentur ein.",
    endBtn: "Live-Demo anschreiben 📱",
    endSecondary: "14 Tage kostenlos testen",
    updatedLabel: "Aktualisiert",
    shareWhatsApp: "Auf WhatsApp teilen",
    shareLinkedIn: "Auf LinkedIn teilen",
    relatedTitle: "Ähnliche Artikel",
  },
  fr: {
    tocTitle: "Sommaire",
    midTitle: "Essayez le bot maintenant : écrivez comme votre client et regardez-le prendre la réservation 📱",
    midBtn: "Essayer en direct sur WhatsApp",
    midSecondary: "Essai gratuit de 14 jours",
    endTitle: "Ne vous contentez pas de lire — essayez",
    endDesc: "Écrivez au vrai bot WhatsApp de Turzz AI comme un client — choix du circuit, date, réservation. Puis installez la même chose pour votre agence, gratuitement pendant 14 jours.",
    endBtn: "Écrire à la démo en direct 📱",
    endSecondary: "Essayer 14 jours gratuits",
    updatedLabel: "Mis à jour",
    shareWhatsApp: "Partager sur WhatsApp",
    shareLinkedIn: "Partager sur LinkedIn",
    relatedTitle: "Articles similaires",
  },
  es: {
    tocTitle: "Índice",
    midTitle: "Pruebe el bot ahora: escriba como su cliente y vea cómo toma la reserva 📱",
    midBtn: "Probar en vivo en WhatsApp",
    midSecondary: "Empezar 14 días gratis",
    endTitle: "No solo lo lea — pruébelo",
    endDesc: "Escriba al bot real de WhatsApp de Turzz AI como un cliente: que elija el tour, pregunte la fecha y tome la reserva. Luego configure lo mismo para su agencia, gratis 14 días.",
    endBtn: "Escribir a la demo en vivo 📱",
    endSecondary: "Probar 14 días gratis",
    updatedLabel: "Actualizado",
    shareWhatsApp: "Compartir en WhatsApp",
    shareLinkedIn: "Compartir en LinkedIn",
    relatedTitle: "Artículos relacionados",
  },
  ru: {
    tocTitle: "Содержание",
    midTitle: "Попробуйте бота прямо сейчас: напишите как клиент и посмотрите, как он оформит бронь 📱",
    midBtn: "Попробовать в WhatsApp",
    midSecondary: "14 дней бесплатно",
    endTitle: "Не читайте — попробуйте",
    endDesc: "Напишите настоящему WhatsApp-боту Turzz AI как клиент — он подберёт тур, уточнит дату и оформит бронь. Затем настройте то же для своего агентства: 14 дней бесплатно.",
    endBtn: "Написать живой демо 📱",
    endSecondary: "Попробовать 14 дней бесплатно",
    updatedLabel: "Обновлено",
    shareWhatsApp: "Поделиться в WhatsApp",
    shareLinkedIn: "Поделиться в LinkedIn",
    relatedTitle: "Похожие статьи",
  },
  ar: {
    tocTitle: "المحتويات",
    midTitle: "جرّب الروبوت الآن: اكتب كأنك عميل وشاهده يُتمّ الحجز 📱",
    midBtn: "جرّب مباشرة على واتساب",
    midSecondary: "ابدأ 14 يوماً مجاناً",
    endTitle: "لا تكتفِ بالقراءة — جرّب",
    endDesc: "راسل روبوت واتساب الحقيقي من Turzz AI كأنك عميل — يختار الجولة ويسأل عن التاريخ ويُتمّ الحجز. ثم أنشئ الشيء نفسه لوكالتك مجاناً لمدة 14 يوماً.",
    endBtn: "راسل العرض المباشر 📱",
    endSecondary: "جرّب 14 يوماً مجاناً",
    updatedLabel: "تم التحديث",
    shareWhatsApp: "مشاركة على واتساب",
    shareLinkedIn: "مشاركة على لينكدإن",
    relatedTitle: "مقالات ذات صلة",
  },
};

export function ctaTexts(lang: string): CtaTexts {
  return BLOG_CTA[(lang as L)] ?? BLOG_CTA.en;
}
