// Tur arama için mesaj ayrıştırma utility'si
export const parseMessage = (text: string) => {
  const lowerText = text.toLowerCase();
  const result: any = {
    intent: "tour.search",
    entities: {
      destination: null,
      type: null,
      date_text: null,
      date_iso: null,
      pax: null
    }
  };

  // Destinasyon tespiti
  if (lowerText.includes("kapadokya")) result.entities.destination = "Kapadokya";
  if (lowerText.includes("ayvalık")) result.entities.destination = "Ayvalık";
  if (lowerText.includes("efes") || lowerText.includes("izmir") || lowerText.includes("İzmir")) result.entities.destination = "İzmir";
  if (lowerText.includes("pamukkale") || lowerText.includes("denizli")) result.entities.destination = "Pamukkale";
  if (lowerText.includes("antalya") || lowerText.includes("kemer")) result.entities.destination = "Antalya";

  // Tur tipi
  if (lowerText.includes("günübirlik") || lowerText.includes("günü birlik")) {
    result.entities.type = "DAYTRIP";
  } else if (lowerText.includes("2 gece") || lowerText.includes("iki gece")) {
    result.entities.type = "N2";
  } else if (lowerText.includes("3 gece") || lowerText.includes("üç gece")) {
    result.entities.type = "N3";
  }

  // Basit tarih ayrıştırma
  const months: Record<string, string> = {
    "ocak": "01", "şubat": "02", "mart": "03", "nisan": "04",
    "mayıs": "05", "haziran": "06", "temmuz": "07", "ağustos": "08",
    "eylül": "09", "ekim": "10", "kasım": "11", "aralık": "12"
  };

  for (const [monthName, monthNum] of Object.entries(months)) {
    if (lowerText.includes(monthName)) {
      const dayMatch = lowerText.match(/(\d{1,2})\s+/);
      if (dayMatch) {
        const day = dayMatch[1].padStart(2, '0');
        result.entities.date_iso = `2026-${monthNum}-${day}`;
        result.entities.date_text = `${day} ${monthName}`;
      }
    }
  }

  // Kişi sayısı
  const paxMatch = lowerText.match(/(\d+)\s*(kişi|kişilik)/);
  if (paxMatch) {
    result.entities.pax = parseInt(paxMatch[1]);
  }

  return result;
};

export const formatTourForWhatsApp = (tour: any, dateInfo: any) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  return `
🏖️ *${tour.title}*
📍 ${tour.destination}
📅 ${dateInfo.departure_date}${dateInfo.return_date && dateInfo.return_date !== dateInfo.departure_date ? ' - ' + dateInfo.return_date : ''}
💰 ${formatPrice(dateInfo.price_adult)} ${tour.currency} (kişi başı)
👥 ${dateInfo.quota > 0 ? dateInfo.quota + ' kişilik kontenjan mevcut' : 'Kontenjan doldu'}
${tour.program_url ? `📄 Program: ${tour.program_url}` : ''}
  `.trim();
};
