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

  if (language === "tr") {
    return `\n\n🏢 ACENTE BİLGİSİ:
Acente görünen adı: ${agencyName}${cityText}
${agencyAddress ? `Adres: ${agencyAddress}` : "Adres: Henüz eklenmemiş"}
${agencyPhone ? `Telefon: ${agencyPhone}` : "Telefon: Henüz eklenmemiş"}
${agencyWebsite ? `Web: ${agencyWebsite}` : ""}
${formattedHours ? `Çalışma Saatleri:\n${formattedHours}` : "Çalışma Saatleri: Henüz eklenmemiş"}
${agencyMapsUrl ? `Konum: ${agencyMapsUrl}` : ""}
${agencyCancellationPolicy ? `İptal Koşulları: ${agencyCancellationPolicy}` : "İptal Koşulları: Henüz eklenmemiş"}

KURALLAR:
- Karşılama ve metinlerde bu ismi AYNEN kullan, çevirmeye çalışma.
- İsmin sonuna ekstra "Travel Agency" vb. ekleme.
- Acente bilgisi sorulduğunda yukarıdaki bilgileri kullan.
- Eğer herhangi bir bilgi "Henüz eklenmemiş" ise, dürüst bir şekilde "Bu bilgi henüz sisteme girilmemiş" de.

📞 İLETİŞİM KURALLARI:
- Kullanıcı iletişime geçmek istediğinde, mevcut tüm iletişim bilgilerini sıralı bir şekilde ver.

💰 PARA BİRİMİ KABUL KURALLARI:
- Ödeme yöntemleri hakkında sorulduğunda, sadece genel olarak nasıl ödeme yapılabileceğini anlat.
- Euro, Dolar gibi yabancı para birimleri hakkında: "Para birimi kabul kurallarımız için lütfen ofisimizle iletişime geçin" de.`;
  }

  return `\n\n🏢 AGENCY INFO:
Agency display name: ${agencyName}${cityText}
${agencyAddress ? `Address: ${agencyAddress}` : "Address: Not available"}
${agencyPhone ? `Phone: ${agencyPhone}` : "Phone: Not available"}
${agencyWebsite ? `Website: ${agencyWebsite}` : ""}
${formattedHours ? `Working Hours:\n${formattedHours}` : "Working Hours: Not available"}
${agencyMapsUrl ? `Location: ${agencyMapsUrl}` : ""}
${agencyCancellationPolicy ? `Cancellation Policy: ${agencyCancellationPolicy}` : "Cancellation Policy: Not available"}

RULES:
- Use this exact name in greetings and messages.
- Do NOT translate or modify the name.
- When asked about agency info, use the information above.
- If any information is "Not available", tell the user honestly.

📞 CONTACT RULES:
- When user wants to contact, provide all available contact information in a clear list.

💰 CURRENCY ACCEPTANCE RULES:
- When asked about payment methods, only explain general payment options.
- For foreign currencies (Euro, Dollar, etc.): "For currency acceptance policies, please contact our office."`;
}