// ARAÇ-2 / "Hesabı link olarak paylaş" — OPT-IN URL kodlaması.
//
// NEDEN OPT-IN: adres çubuğunu her tuş vuruşunda güncellemek geri/ileri
// geçmişini kirletir. Kullanıcı düğmeye basınca link üretilir; başka zaman
// URL'e dokunulmaz.
//
// GİZLİLİK: burada kodlanan içerik TİCARİ MALİYET verisidir — isim, telefon,
// adres gibi kişisel veri YOKTUR (ARAÇ-1'de tam tersi olduğu için orada URL
// paylaşımı bilinçli olarak yapılmamıştı). Yine de link tarayıcı geçmişine ve
// WhatsApp önizlemesine düşer; arayüzde bu uyarı gösterilir.
//
// BİÇİM: kısa anahtarlı, sırası sabit sayı dizisi → base64url. Ham JSON'a göre
// ~3 kat kısa; tipik hesap 120-180 karakter (WhatsApp'ta rahat paylaşılır).

import { type CalcInput, DEFAULT_INPUT, type CostLine } from "./schema";

/** Sıra SABİTTİR — yeni alan yalnız SONA eklenir (eski linkler bozulmasın) */
const FIELD_ORDER: (keyof CalcInput)[] = [
  "arac",
  "rehber",
  "soforKonaklama",
  "parkGecis",
  "muze",
  "yemekOgun",
  "yemekTutar",
  "konaklamaGece",
  "konaklamaTutar",
  "sigorta",
  "kapasite",
  "karOrani",
  "komisyon",
  "kdv",
];

function b64urlEncode(s: string): string {
  const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : "";
  } catch {
    return "";
  }
}

function encodeLines(lines: CostLine[]): string {
  // etiket~tutar, çoklu satır "!" ile ayrılır; ayırıcı karakterler temizlenir
  return lines
    .filter((l) => l.label.trim() || l.amount.trim())
    .map((l) => `${l.label.replace(/[~!|]/g, " ").trim()}~${l.amount.trim()}`)
    .join("!");
}

function decodeLines(raw: string, prefix: string): CostLine[] {
  if (!raw) return [];
  return raw.split("!").map((chunk, i) => {
    const [label = "", amount = ""] = chunk.split("~");
    return { id: `${prefix}${i}`, label, amount };
  });
}

/**
 * Hesap durumunu tek bir kısa dizeye kodlar.
 * Alanlar "|" ile ayrılır; boş alan boş bırakılır (yer tutucu korunur).
 */
export function encodeState(input: CalcInput): string {
  const parts: string[] = FIELD_ORDER.map((k) => String(input[k] ?? "").trim());
  parts.push(String(input.planlamaDoluluk));
  parts.push(input.karModu === "marj" ? "1" : "0");
  parts.push(input.paraBirimi);
  parts.push(input.priceMode === "test" ? "1" : "0");
  parts.push(String(input.kendiFiyat ?? "").trim());
  parts.push(encodeLines(input.digerSabit));
  parts.push(encodeLines(input.digerDegisken));
  return b64urlEncode(parts.join("|"));
}

/** Kodlanmış dizeyi geri okur. Bozuk/eksik veride varsayılanlara düşer. */
export function decodeState(code: string): CalcInput | null {
  const raw = b64urlDecode(code);
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length < FIELD_ORDER.length) return null;

  const out: CalcInput = { ...DEFAULT_INPUT, digerSabit: [], digerDegisken: [] };
  FIELD_ORDER.forEach((k, i) => {
    // Yalnız string alanlar bu döngüde
    (out as Record<string, unknown>)[k as string] = parts[i] ?? "";
  });
  let i = FIELD_ORDER.length;
  const dol = parseFloat(parts[i++] ?? "");
  out.planlamaDoluluk = Number.isFinite(dol) && dol > 0 && dol <= 1 ? dol : DEFAULT_INPUT.planlamaDoluluk;
  out.karModu = parts[i++] === "1" ? "marj" : "markup";
  const cur = parts[i++];
  out.paraBirimi = cur === "EUR" || cur === "USD" ? cur : "TRY";
  out.priceMode = parts[i++] === "1" ? "test" : "oner";
  out.kendiFiyat = parts[i++] ?? "";
  out.digerSabit = decodeLines(parts[i++] ?? "", "s");
  out.digerDegisken = decodeLines(parts[i++] ?? "", "d");
  return out;
}

/** Paylaşılabilir tam URL (mevcut sayfa yolu + ?h=...) */
export function buildShareUrl(input: CalcInput): string {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?h=${encodeState(input)}`;
}

/** Sayfa açılışında ?h= varsa oku (yoksa null) */
export function readStateFromUrl(): CalcInput | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("h");
  return code ? decodeState(code) : null;
}
