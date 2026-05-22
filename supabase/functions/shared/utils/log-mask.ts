// K6: PII (Kişisel Veri) maskeleme yardımcısı
// Console log'larında telefon/isim/email/mesaj içeriğini KVKK/GDPR uyumlu maskele.
//
// Kural:
//   - Telefon: son 4 hane görünür, geri kalan ***
//   - Email: ilk 1 harf + *** + domain
//   - İsim: ilk harf + *** (örn. "Murat Yılmaz" → "M*** Y***")
//   - Mesaj: kısalt + tek satır (PII içeriği logda durmasın)
//   - Object: shallow recursion ile bilinen PII alanlarını maskele

const PII_KEYS = new Set([
  "phone", "telefon", "phone_number", "recipient_phone", "full_name", "fullName",
  "name", "ad", "email", "e_mail", "user_phone", "from", "to",
]);

/** Telefon: ülke kodu görünür + son 4 hane. Örn: +90555***1234 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "(none)";
  const s = String(phone).trim();
  if (s.length <= 4) return "***";
  const last4 = s.slice(-4);
  const prefix = s.length > 7 ? s.slice(0, 3) : "";
  return `${prefix}***${last4}`;
}

/** Email: ilk harf + *** + @domain */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "(none)";
  const s = String(email).trim();
  const at = s.indexOf("@");
  if (at < 1) return "***";
  const localFirst = s.charAt(0);
  const domain = s.slice(at);
  return `${localFirst}***${domain}`;
}

/** İsim: her kelimenin ilk harfi + *** */
export function maskName(name: string | null | undefined): string {
  if (!name) return "(none)";
  return String(name).trim().split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + "***")
    .join(" ");
}

/** Mesaj içeriği: ilk 30 char + uzunluk. PII riskli içerik logda durmasın. */
export function maskMessage(msg: string | null | undefined, maxLen = 30): string {
  if (!msg) return "(empty)";
  const s = String(msg).replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return `"${s}"`;
  return `"${s.slice(0, maxLen)}…" (len=${s.length})`;
}

/** Obje içindeki bilinen PII alanlarını maskele (shallow). */
export function maskPII<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (!obj || typeof obj !== "object") return obj as any;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (v == null) { out[k] = v; continue; }
    if (PII_KEYS.has(lk) || lk.includes("phone") || lk.includes("telefon")) {
      out[k] = typeof v === "string" ? maskPhone(v) : v;
    } else if (lk.includes("email") || lk.includes("e_mail")) {
      out[k] = typeof v === "string" ? maskEmail(v) : v;
    } else if (lk.includes("name") && !lk.includes("agency") && !lk.includes("tour") && !lk.includes("template")) {
      out[k] = typeof v === "string" ? maskName(v) : v;
    } else if (lk === "message" || lk === "content" || lk === "rawmessage" || lk === "raw_message" || lk === "usermessage") {
      out[k] = typeof v === "string" ? maskMessage(v) : v;
    } else {
      out[k] = v;
    }
  }
  return out;
}
