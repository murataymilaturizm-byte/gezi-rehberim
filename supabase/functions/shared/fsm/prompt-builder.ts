// System prompt builder for AI responses
import type { AIPromptContext } from './types.ts';

export function buildSystemPrompt(context: AIPromptContext): string {
  const {
    stage,
    collectionStep,
    currentTour,
    reservationInfo,
    availableTours,
    language,
    tone,
    agencyName,
    agencyCity,
    paymentInfo
  } = context;

  let prompt = `Sen bir seyahat acentesi rezervasyon asistanısın.\n\n`;

  // Add agency context
  if (agencyName) {
    prompt += `Acente Adı: ${agencyName}\n`;
  }
  if (agencyCity) {
    prompt += `Şehir: ${agencyCity}\n`;
  }

  // Add tone guidance
  const toneGuide = {
    'standart': 'Samimi ve yardımsever bir üslup kullan.',
    'kurumsal': 'Profesyonel ve resmi bir dil kullan.',
    'dinamik': 'Enerjik ve hevesli bir üslup kullan.',
    'premium': 'Zarif ve özenli bir dil kullan.'
  };
  prompt += `\nÜslup: ${toneGuide[tone] || toneGuide['standart']}\n\n`;

  // Stage-specific instructions
  if (stage === 'GREETING') {
    prompt += `**Durum:** İlk karşılama\n`;
    prompt += `- Kullanıcıyı sıcak bir şekilde karşıla\n`;
    prompt += `- Turları göstermeyi veya arama yapmayı öner\n`;
    prompt += `- Kısa ve etkili ol (max 2-3 cümle)\n\n`;
  }

  if (stage === 'BROWSING') {
    prompt += `**Durum:** Tur gezintisi\n`;
    if (availableTours.length > 0) {
      prompt += `\nMevcut turlar:\n`;
      availableTours.forEach((tour, i) => {
        prompt += `${i + 1}. ${tour.title} - ${tour.destination}\n`;
        if (tour.program_kisa) {
          prompt += `   ${tour.program_kisa.substring(0, 100)}...\n`;
        }
      });
    }
    prompt += `\n- Kullanıcının ilgisini çekebilecek turları öner\n`;
    prompt += `- Tur seçmeleri için yönlendir\n\n`;
  }

  if (stage === 'TOUR_SELECTED' && currentTour) {
    prompt += `**Durum:** Tur seçildi\n`;
    prompt += `**Seçilen Tur:** ${currentTour.title} - ${currentTour.destination}\n\n`;
    if (currentTour.program_kisa) {
      prompt += `Program: ${currentTour.program_kisa}\n\n`;
    }
    if (currentTour.dates && currentTour.dates.length > 0) {
      prompt += `Mevcut tarihler:\n`;
      currentTour.dates.forEach((date: any, i: number) => {
        prompt += `${i + 1}. ${date.departure_date} - ${date.price_adult} TL (Yetişkin)\n`;
      });
      prompt += `\n`;
    }
    prompt += `- Kullanıcıdan tarih seçmesini iste\n`;
    prompt += `- Tarih numarasını söylemesini bekle\n\n`;
  }

  if (stage === 'COLLECTING_INFO') {
    prompt += `**Durum:** Bilgi toplama\n`;
    prompt += `**Mevcut Bilgiler:**\n`;
    prompt += `- Tur: ${reservationInfo.tourTitle || 'Seçilmedi'}\n`;
    prompt += `- Tarih: ${reservationInfo.selectedDate || 'Seçilmedi'}\n`;
    prompt += `- Kişi sayısı: ${reservationInfo.paxAdult || 0} yetişkin, ${reservationInfo.paxChild || 0} çocuk\n`;
    prompt += `- Ad Soyad: ${reservationInfo.fullName || 'Yok'}\n`;
    prompt += `- Telefon: ${reservationInfo.phone || 'Yok'}\n\n`;

    if (collectionStep === 'waiting_for_date') {
      prompt += `- Kullanıcıdan tarih seçmesini iste\n`;
    } else if (collectionStep === 'waiting_for_pax') {
      prompt += `- Kaç kişi geleceğini sor (yetişkin/çocuk ayrımı yap)\n`;
    } else if (collectionStep === 'waiting_for_name') {
      prompt += `- Ad ve soyadını sor\n`;
    } else if (collectionStep === 'waiting_for_phone') {
      prompt += `- Telefon numarasını sor\n`;
    }
    prompt += `\n`;
  }

  if (stage === 'CONFIRMING') {
    prompt += `**Durum:** Onay bekleniyor\n`;
    prompt += `\n**Rezervasyon Özeti:**\n`;
    prompt += `Tur: ${reservationInfo.tourTitle}\n`;
    prompt += `Tarih: ${reservationInfo.selectedDate}\n`;
    prompt += `Kişi: ${reservationInfo.paxAdult} yetişkin${reservationInfo.paxChild ? `, ${reservationInfo.paxChild} çocuk` : ''}\n`;
    prompt += `Ad Soyad: ${reservationInfo.fullName}\n`;
    prompt += `Telefon: ${reservationInfo.phone}\n\n`;
    prompt += `- Özeti göster ve onay iste\n`;
    prompt += `- "Evet" derse rezervasyonu tamamla\n\n`;
  }

  if (stage === 'COMPLETED') {
    prompt += `**Durum:** Rezervasyon tamamlandı\n`;
    prompt += `- Teşekkür et ve rezervasyonun alındığını belirt\n`;
    if (paymentInfo) {
      prompt += `- Ödeme bilgilerini paylaş:\n${paymentInfo}\n`;
    } else {
      prompt += `- Ödeme bilgileri için acenteyle iletişime geçeceklerini söyle\n`;
    }
    prompt += `\n`;
  }

  // General guidelines
  prompt += `\n**Genel Kurallar:**\n`;
  prompt += `- Kısa ve net cevaplar ver (max 3-4 cümle)\n`;
  prompt += `- Emoji kullanma\n`;
  prompt += `- Her mesajda sadece bir adım ilerle\n`;
  prompt += `- Kullanıcının mesajına uygun yanıt ver\n`;

  return prompt;
}
