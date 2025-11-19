// SIMPLIFIED: Ultra-clean demo handler - TR + Friendly only

import { callAI } from '../services/ai.ts';
import { DEMO_TOURS } from '../config/demo-tours.ts';

export async function handleDemoIntelligently(
  message: string,
  conversationHistory: any[],
  intent: string,
  language: string,
  availableTours: any[],
  conversationStyle: string = 'friendly',
  conversationState?: any
): Promise<string> {
  const systemPrompt = buildUltraSimplePrompt(conversationState);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  const response = await callAI(messages, 0.3);
  return response;
}

function buildUltraSimplePrompt(conversationState?: any): string {
  const currentTour = conversationState?.currentTour;
  const collectedInfo = conversationState?.collectedInfo || {};
  
  // Format tour dates if tour is selected
  let datesSection = '';
  if (currentTour) {
    const tourData = DEMO_TOURS.find(t => t.id === currentTour.id || t.title === currentTour.title);
    if (tourData?.dates && tourData.dates.length > 0) {
      datesSection = '\n\n📅 MÜSAİT TARİHLER:\n';
      tourData.dates.forEach((date: any, idx: number) => {
        const d = new Date(date.departure_date);
        const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        datesSection += `${idx + 1}. ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} - ${date.price_adult}₺\n`;
      });
    }
  }

  // Format available tours
  const toursList = DEMO_TOURS.map((tour, idx) => {
    const price = tour.dates?.[0] ? `${tour.dates[0].price_adult}₺` : 'Fiyat sorunuz';
    return `${idx + 1}. ${tour.title} - ${tour.destination} (${price})`;
  }).join('\n');

  const hasFullName = collectedInfo.fullName && collectedInfo.fullName.length >= 3;
  const hasPhone = collectedInfo.phone && collectedInfo.phone.length >= 10;
  const hasPax = collectedInfo.paxAdult > 0;
  const hasTour = !!currentTour;

  return `Sen samimi bir tur rezervasyon asistanısın. 😊

🎯 TURLARIMIZ:
${toursList}
${datesSection}

📋 DURUM:
- Tur: ${currentTour?.title || '❌'}
- Kişi: ${collectedInfo.paxAdult || '❌'}
- İsim: ${hasFullName ? '✅' : '❌'}
- Telefon: ${hasPhone ? '✅' : '❌'}

🎯 REZERVASYON ADIMLARI:

1️⃣ TUR SEÇİMİ
Eğer tur seçilmemişse → Turları listele ve seçim iste

2️⃣ TARİH SEÇİMİ  
Tur seçildiğinde → **OTOMATIK** tarihleri göster:
📅 Müsait tarihler:
1. 15 Aralık 2025 - 2,500₺
2. 22 Aralık 2025 - 2,800₺
Hangi tarihi tercih edersiniz? 😊

3️⃣ KİŞİ SAYISI
Tarih seçildiğinde → "Kaç kişi katılacaksınız? 👥"

4️⃣ İSİM
Kişi sayısı belli ise → "Tam isminizi alabilir miyim? 😊"

5️⃣ TELEFON
İsim alındıysa → "Telefon numaranızı alabilir miyim? 📱"

6️⃣ ONAY
Hepsi tamam ise → Özet göster:

Tur: Kapadokya Turu
Tarih: 15 Aralık 2025
Kişi: 2 yetişkin
İsim: Ahmet Yılmaz
Telefon: 05551234567

"Bilgiler doğru mu? Onaylarsanız rezervasyonunuzu tamamlayabilirim! ✅😊"

⚠️ KURALLAR:
- Her bilgiyi ALT ALTA yaz
- En az 2 emoji kullan 😊✨
- Kısa ve öz ol (max 6 satır)
- E-mail ASLA isteme!
- Eksik bilgi varsa önce onu iste
- Tur seçildiğinde tarihleri OTOMATIK göster (kullanıcı sormadan!)`;
}
