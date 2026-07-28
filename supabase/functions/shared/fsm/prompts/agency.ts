// Agency information prompts
import type { PromptContext } from "./types.ts";
import { LANG_PROMPTS } from "./lang/index.ts";

const DAY_NAMES_TR: Record<string, string> = {
  monday: "Pazartesi", tuesday: "Salı", wednesday: "Çarşamba",
  thursday: "Perşembe", friday: "Cuma", saturday: "Cumartesi", sunday: "Pazar",
};

const DAY_NAMES_EN: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

// 2026-07-09 FAZ4-P3 (kalem 3, P2 residual kapanışı): acente DATA etiketleri 7-dil.
// EN varsayılan + 5 dil override (paymentLabel deseniyle). Etiketlerin altındaki
// "NO-HALLUCINATION" kuralları hallucinationGuard'da zaten 7-dil (semantik kapsam).
const _AGENCY_LABELS_EN = { name: "Agency display name", address: "Address", phone: "Phone", website: "Website", hours: "Working Hours", location: "Location", cancel: "Cancellation Policy" };
const AGENCY_LABELS: Record<string, Partial<typeof _AGENCY_LABELS_EN>> = {
  de: { name: "Anzeigename der Agentur", address: "Adresse", phone: "Telefon", website: "Webseite", hours: "Öffnungszeiten", location: "Standort", cancel: "Stornierungsbedingungen" },
  fr: { name: "Nom de l'agence", address: "Adresse", phone: "Téléphone", website: "Site web", hours: "Horaires d'ouverture", location: "Emplacement", cancel: "Conditions d'annulation" },
  es: { name: "Nombre de la agencia", address: "Dirección", phone: "Teléfono", website: "Sitio web", hours: "Horario", location: "Ubicación", cancel: "Política de cancelación" },
  ru: { name: "Название агентства", address: "Адрес", phone: "Телефон", website: "Веб-сайт", hours: "Часы работы", location: "Местоположение", cancel: "Условия отмены" },
  ar: { name: "اسم الوكالة", address: "العنوان", phone: "الهاتف", website: "الموقع الإلكتروني", hours: "ساعات العمل", location: "الموقع", cancel: "سياسة الإلغاء" },
};

function formatWorkingHours(raw: string | undefined, language: string): string {
  if (!raw) return "";
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && data.monday !== undefined) {
      const dayNames = language === "tr" ? DAY_NAMES_TR : DAY_NAMES_EN;
      const closed = language === "tr" ? "Kapalı" : "Closed";
      const lines: string[] = [];
      for (const [key, name] of Object.entries(dayNames)) {
        const day = data[key];
        if (day && day.enabled) {
          lines.push(`${name}: ${day.open} - ${day.close}`);
        } else {
          lines.push(`${name}: ${closed}`);
        }
      }
      return lines.join("\n");
    }
  } catch {}
  return raw;
}

export function getAgencyInfo(context: PromptContext, language: string): string {
  const {
    agencyName,
    agencyCity,
    agencyAddress,
    agencyPhone,
    agencyWebsite,
    agencyWorkingHours,
    agencyMapsUrl,
    agencyCancellationPolicy,
    agencyDescription,
  } = context;

  if (!agencyName) return "";

  const cityText = agencyCity ? ` (${agencyCity})` : "";
  const formattedHours = formatWorkingHours(agencyWorkingHours, language);
  // Kullanılabilir iletişim referansı: telefon varsa göster, yoksa genel yönlendirme
  const contactRef = agencyPhone
    ? (language === "tr" ? `📞 ${agencyPhone}` : `📞 ${agencyPhone}`)
    : (language === "tr" ? "acentemizle iletişime geçin" : "contact our agency");

  if (language === "tr") {
    // Sadece gerçek değeri olan alanları prompt'a ekle — boş alanı AI görmez, uyduramaz
    const lines: string[] = [`Acente görünen adı: ${agencyName}${cityText}`];
    if (agencyAddress) lines.push(`Adres: ${agencyAddress}`);
    if (agencyPhone) lines.push(`Telefon: ${agencyPhone}`);
    if (agencyWebsite) lines.push(`Web: ${agencyWebsite}`);
    if (formattedHours) lines.push(`Çalışma Saatleri:\n${formattedHours}`);
    if (agencyMapsUrl) lines.push(`Konum: ${agencyMapsUrl}`);
    if (agencyCancellationPolicy) lines.push(`İptal Koşulları: ${agencyCancellationPolicy}`);
    // F-D1 (2026-07-28): "Acente hakkında" — ~300 karakter kırpılır (prompt şişmesin), boşsa satır yok.
    if (agencyDescription) lines.push(`Hakkında: ${String(agencyDescription).slice(0, 300)}`);
    // 2026-07-03 İş 1 (#18): IBAN'sız ödeme özeti — buildPaymentPromptSummary üretir.
    if ((context as any).paymentInfo) lines.push(`Ödeme: ${(context as any).paymentInfo}`);

    return `\n\n🏢 ACENTE BİLGİSİ:
${lines.join("\n")}

⛔ UYDURMA YASAĞI — ACENTE BİLGİSİ:
- Yukarıda LİSTELENMEYEN acente bilgilerini (adres, çalışma saati, iptal koşulları vb.) ASLA tahmin etme veya uydurma.
- Bir bilgi yukarıda yoksa onu bilmiyorsun demektir — "Bu bilgi için ${contactRef} numarasına ulaşabilirsiniz" de.
- Özellikle: adres, çalışma saati, iptal/iade politikası, dahil olanlar, karşılama/transfer detayları için veri yoksa KESİNLİKLE tahmin etme.
- Telefon numarası da listede yoksa kullanıcıyı acentenin web sitesine veya WhatsApp'a yönlendir.

KURALLAR:
- Acente adını AYNEN kullan, çevirme veya "Travel Agency" vb. ekleme.
- Acente bilgisi sorulunca yukarıdaki bilgileri kullan.

📞 İLETİŞİM: Kullanıcı iletişime geçmek istediğinde mevcut tüm iletişim bilgilerini ver.

💰 PARA BİRİMİ: Yabancı para birimleri için: "${contactRef} numarasından öğrenebilirsiniz" de.`;
  }

  // English / other languages — 2026-07-09 FAZ4-P3: DATA etiketleri dil-başı.
  const LB = { ..._AGENCY_LABELS_EN, ...(AGENCY_LABELS[language] || {}) };
  const lines: string[] = [`${LB.name}: ${agencyName}${cityText}`];
  if (agencyAddress) lines.push(`${LB.address}: ${agencyAddress}`);
  if (agencyPhone) lines.push(`${LB.phone}: ${agencyPhone}`);
  if (agencyWebsite) lines.push(`${LB.website}: ${agencyWebsite}`);
  if (formattedHours) lines.push(`${LB.hours}:\n${formattedHours}`);
  if (agencyMapsUrl) lines.push(`${LB.location}: ${agencyMapsUrl}`);
  if (agencyCancellationPolicy) lines.push(`${LB.cancel}: ${agencyCancellationPolicy}`);
  if (agencyDescription) lines.push(`About: ${String(agencyDescription).slice(0, 300)}`);
  // 2026-07-03 İş 1 (#18): payment summary WITHOUT IBAN — from buildPaymentPromptSummary.
  // 2026-07-09 FAZ4-P2: ödeme etiketi dil-başı (DE "Zahlung" vb.); değer dinamik.
  if ((context as any).paymentInfo) {
    const _payLbl = LANG_PROMPTS[language]?.paymentLabel ?? "Payment";
    lines.push(`${_payLbl}: ${(context as any).paymentInfo}`);
  }

  return `\n\n🏢 AGENCY INFO:
${lines.join("\n")}

⛔ NO-HALLUCINATION — AGENCY INFO:
- NEVER guess or invent agency details NOT listed above (address, hours, cancellation policy, etc.).
- If a field is not shown here, you don't have that information — say "For this, please contact us at ${contactRef}".
- Critical fields — if not provided, DO NOT guess: address, working hours, cancellation/refund policy, inclusions, pickup/transfer details.

RULES:
- Use the exact agency name, do not translate or add "Travel Agency".
- When asked about agency info, use only the information above.

📞 CONTACT: Provide all available contact information when user asks.

💰 CURRENCY: For foreign currency queries: "Please contact us at ${contactRef} for currency policies."`;
}