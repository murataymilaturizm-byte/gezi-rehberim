// ARAÇ-1: Araçlar bölümü tek-kaynak kaydı.
// Hub kartları, route'lar ve sitemap girişleri BU listeden türetilir.
// Yeni araç eklerken: buraya bir kayıt + routes.tsx'e route + generate-sitemap.mjs'e path.
//
// Dil notu: route'lar 3 dile hazır (tr/en/de), pilot içerik TR. Bir aracın
// `langs` alanı hangi dillerde YAYINDA olduğunu söyler; hub yalnız o dilde
// yayında olan araçları listeler ("yakında" kartı YOK — boş vaat vitrini olmaz).

export type ToolLang = "tr" | "en" | "de";

export interface ToolEntry {
  /** Kararlı kimlik — analytics event'lerinde ve testlerde kullanılır */
  id: string;
  /** Dile göre URL yolu (tam path, prefix dahil) */
  path: Record<ToolLang, string>;
  /** Kart başlığı/açıklaması — dile göre */
  title: Record<ToolLang, string>;
  description: Record<ToolLang, string>;
  /** Hangi dillerde YAYINDA (hub bu listeye göre filtreler) */
  langs: ToolLang[];
}

/** Araçlar hub'ının dile göre yolu. tr → /araclar, en|de → /{lang}/tools */
export const TOOLS_HUB_PATH: Record<ToolLang, string> = {
  tr: "/araclar",
  en: "/en/tools",
  de: "/de/tools",
};

/**
 * Hub linki — 7 dilli header'dan çağrılır. ru/ar/fr/es ziyaretçi için EN'e
 * düşer (blog'daki TR-fallback felsefesinin araç karşılığı: var olan en yakın
 * yayınlanmış yüzeye götür, kırık link üretme).
 */
export function toolsHubUrl(lang: string): string {
  if (lang === "tr") return TOOLS_HUB_PATH.tr;
  if (lang === "de") return TOOLS_HUB_PATH.de;
  return TOOLS_HUB_PATH.en;
}

export const TOOLS: ToolEntry[] = [
  {
    id: "rehber-sozlesmesi",
    path: {
      tr: "/araclar/rehber-sozlesmesi-olusturucu",
      en: "/en/tools/guide-contract-generator",
      de: "/de/tools/reiseleiter-vertrag-generator",
    },
    title: {
      tr: "Rehber Sözleşmesi Oluşturucu",
      en: "Guide Contract Generator",
      de: "Reiseleiter-Vertrag-Generator",
    },
    description: {
      tr: "Acente ile rehber arasındaki iş sözleşmesinin örnek iskeletini formu doldurarak oluşturun; Word veya PDF olarak indirin. Bilgileriniz cihazınızdan çıkmaz.",
      en: "Fill in the form to produce a sample agency–guide contract skeleton and download it as Word or PDF. Your data never leaves your device.",
      de: "Füllen Sie das Formular aus, um ein Muster-Vertragsgerüst zwischen Agentur und Reiseleiter zu erzeugen — als Word oder PDF. Ihre Daten verlassen Ihr Gerät nicht.",
    },
    // Pilot: içerik TR. EN/DE route'ları hazır ama araç henüz TR yayında.
    langs: ["tr"],
  },
  {
    id: "tur-kar-hesaplayici",
    path: {
      tr: "/araclar/tur-kar-hesaplayici",
      en: "/en/tools/tour-profit-calculator",
      de: "/de/tools/tour-gewinn-rechner",
    },
    title: {
      tr: "Tur Kâr ve Fiyat Hesaplayıcı",
      en: "Tour Profit & Price Calculator",
      de: "Tour-Gewinn- und Preisrechner",
    },
    description: {
      tr: "Sabit ve kişi-başı giderlerinizi girin; kişi başı maliyeti, önerilen satış fiyatını, başabaş noktasını ve doluluk senaryolarında kârı görün. Rakamlarınız cihazınızdan çıkmaz.",
      en: "Enter fixed and per-person costs to see unit cost, a suggested selling price, the break-even point and profit across occupancy scenarios. Your figures never leave your device.",
      de: "Geben Sie Fix- und Personenkosten ein und sehen Sie Stückkosten, empfohlenen Verkaufspreis, Break-even-Punkt und Gewinn je Auslastung. Ihre Zahlen verlassen Ihr Gerät nicht.",
    },
    // ARAÇ-2 de TR pilot — EN/DE route'ları hazır, içerik henüz TR.
    langs: ["tr"],
  },
  {
    id: "tur-satis-sozlesmesi",
    path: {
      tr: "/araclar/tur-satis-sozlesmesi-olusturucu",
      en: "/en/tools/tour-sales-contract-generator",
      de: "/de/tools/reisevertrag-generator",
    },
    title: {
      tr: "Tur Satış Sözleşmesi + Ön Bilgilendirme Formu",
      en: "Tour Sales Contract & Pre-Contract Information Form",
      de: "Reisevertrag & Vorvertragliches Informationsformular",
    },
    description: {
      tr: "Tek formu doldurun; paket tur satış sözleşmesi ile ön bilgilendirme formu birlikte üretilsin. İptal merdiveni iki belgeye de aynı kaynaktan işlenir. Bilgileriniz cihazınızdan çıkmaz.",
      en: "Fill one form and generate both the package tour sales contract and the pre-contract information form. The refund ladder is written to both from a single source. Your data never leaves your device.",
      de: "Ein Formular, zwei Dokumente: Reisevertrag und vorvertragliches Informationsformular. Die Stornostaffel wird aus einer Quelle in beide geschrieben. Ihre Daten verlassen Ihr Gerät nicht.",
    },
    langs: ["tr"],
  },
  {
    id: "tur-teklifi",
    path: {
      tr: "/araclar/tur-teklifi-olusturucu",
      en: "/en/tools/tour-quote-generator",
      de: "/de/tools/tour-angebot-generator",
    },
    title: {
      tr: "Tur Teklifi Oluşturucu",
      en: "Tour Quote Generator",
      de: "Tour-Angebot-Generator",
    },
    description: {
      tr: "Grup ve kurumsal turlar için başlıklı, kişi-aralıklı fiyat tablolu profesyonel teklif belgesi hazırlayın; Word veya PDF olarak indirin. Bilgileriniz cihazınızdan çıkmaz.",
      en: "Prepare a professional quote document with a headed layout and a per-group-size price table; download as Word or PDF. Your data never leaves your device.",
      de: "Erstellen Sie ein professionelles Angebot mit Kopfzeile und gestaffelter Preistabelle; als Word oder PDF herunterladen. Ihre Daten verlassen Ihr Gerät nicht.",
    },
    langs: ["tr"],
  },
  {
    id: "transfer-sozlesmesi",
    path: {
      tr: "/araclar/transfer-sozlesmesi-olusturucu",
      en: "/en/tools/transport-contract-generator",
      de: "/de/tools/transportvertrag-generator",
    },
    title: {
      tr: "Transfer ve Araç Kiralama Sözleşmesi",
      en: "Transport & Vehicle Hire Contract",
      de: "Transport- und Fahrzeugmietvertrag",
    },
    description: {
      tr: "Acente ile otobüs/transfer firması arasındaki taşıma sözleşmesinin örnek iskeletini üretin — ikame araç yükümlülüğü, masraf paylaşımı ve fesih dahil. Bilgileriniz cihazınızdan çıkmaz.",
      en: "Generate a sample transport service contract between agency and coach operator — replacement-vehicle duty, cost allocation and termination included. Your data never leaves your device.",
      de: "Erstellen Sie ein Muster-Transportvertragsgerüst zwischen Agentur und Busunternehmen — Ersatzfahrzeugpflicht, Kostenverteilung und Kündigung inklusive. Ihre Daten verlassen Ihr Gerät nicht.",
    },
    langs: ["tr"],
  },
];

/** Belirli bir dilde yayında olan araçlar (hub kartları) */
export function toolsForLang(lang: string): ToolEntry[] {
  const l = (["tr", "en", "de"] as const).includes(lang as ToolLang) ? (lang as ToolLang) : "tr";
  return TOOLS.filter((t) => t.langs.includes(l));
}
