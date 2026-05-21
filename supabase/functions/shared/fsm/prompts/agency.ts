// Agency information prompts
import type { PromptContext } from "./types.ts";

const DAY_NAMES_TR: Record<string, string> = {
  monday: "Pazartesi", tuesday: "Salı", wednesday: "Çarşamba",
  thursday: "Perşembe", friday: "Cuma", saturday: "Cumartesi", sunday: "Pazar",
};

const DAY_NAMES_EN: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
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

  // English / other languages
  const lines: string[] = [`Agency display name: ${agencyName}${cityText}`];
  if (agencyAddress) lines.push(`Address: ${agencyAddress}`);
  if (agencyPhone) lines.push(`Phone: ${agencyPhone}`);
  if (agencyWebsite) lines.push(`Website: ${agencyWebsite}`);
  if (formattedHours) lines.push(`Working Hours:\n${formattedHours}`);
  if (agencyMapsUrl) lines.push(`Location: ${agencyMapsUrl}`);
  if (agencyCancellationPolicy) lines.push(`Cancellation Policy: ${agencyCancellationPolicy}`);

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