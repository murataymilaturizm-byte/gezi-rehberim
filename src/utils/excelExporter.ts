import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Registration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  note?: string;
  created_at: string;
  tours: {
    title: string;
    destination: string;
  };
  tour_dates: {
    departure_date: string;
    return_date?: string;
    price_adult: number;
  };
}

interface Tour {
  id: string;
  title: string;
  destination: string;
  type: string;
  currency: string;
  min_pax: number;
  created_at: string;
  tour_dates?: Array<{
    departure_date: string;
    return_date?: string;
    price_adult: number;
    price_child?: number;
    quota: number;
  }>;
}

interface ConversationSummary {
  id: string;
  phone: string;
  conversation_date: string;
  summary: string;
  topics?: string[];
  mentioned_tours?: string[];
  sentiment?: string;
  message_count: number;
}

const statusLabels: Record<string, string> = {
  NEW: "Yeni",
  PENDING: "Beklemede",
  CONFIRMED: "Onaylandı",
  CANCELLED: "İptal"
};

const tourTypeLabels: Record<string, string> = {
  DAYTRIP: "Günübirlik",
  N2: "2 Gece",
  N3: "3 Gece"
};

export const exportRegistrationsToExcel = (registrations: Registration[]) => {
  const data = registrations.map((reg) => ({
    'Kayıt No': reg.id.substring(0, 8),
    'Ad Soyad': reg.full_name,
    'Telefon': reg.phone,
    'Tur': reg.tours.title,
    'Destinasyon': reg.tours.destination,
    'Tarih': format(new Date(reg.tour_dates.departure_date), 'dd MMMM yyyy', { locale: tr }),
    'Kişi Sayısı': reg.pax,
    'Fiyat': `${reg.tour_dates.price_adult} TL`,
    'Toplam Tutar': `${reg.tour_dates.price_adult * reg.pax} TL`,
    'Durum': statusLabels[reg.status] || reg.status,
    'Not': reg.note || '-',
    'Kayıt Tarihi': format(new Date(reg.created_at), 'dd MMMM yyyy HH:mm', { locale: tr })
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Kolon genişliklerini ayarla
  const columnWidths = [
    { wch: 12 }, // Kayıt No
    { wch: 20 }, // Ad Soyad
    { wch: 15 }, // Telefon
    { wch: 30 }, // Tur
    { wch: 15 }, // Destinasyon
    { wch: 15 }, // Tarih
    { wch: 12 }, // Kişi Sayısı
    { wch: 12 }, // Fiyat
    { wch: 15 }, // Toplam Tutar
    { wch: 12 }, // Durum
    { wch: 30 }, // Not
    { wch: 18 }  // Kayıt Tarihi
  ];
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kayıtlar');

  const fileName = `kayitlar_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportToursToExcel = (tours: Tour[]) => {
  const data: any[] = [];

  tours.forEach((tour) => {
    if (tour.tour_dates && tour.tour_dates.length > 0) {
      tour.tour_dates.forEach((date) => {
        data.push({
          'Tur Adı': tour.title,
          'Destinasyon': tour.destination,
          'Tip': tourTypeLabels[tour.type] || tour.type,
          'Kalkış Tarihi': format(new Date(date.departure_date), 'dd MMMM yyyy', { locale: tr }),
          'Dönüş Tarihi': date.return_date ? format(new Date(date.return_date), 'dd MMMM yyyy', { locale: tr }) : '-',
          'Yetişkin Fiyat': `${date.price_adult} ${tour.currency}`,
          'Çocuk Fiyat': date.price_child ? `${date.price_child} ${tour.currency}` : '-',
          'Kontenjan': date.quota,
          'Min. Kişi': tour.min_pax,
          'Oluşturma Tarihi': format(new Date(tour.created_at), 'dd MMMM yyyy', { locale: tr })
        });
      });
    } else {
      data.push({
        'Tur Adı': tour.title,
        'Destinasyon': tour.destination,
        'Tip': tourTypeLabels[tour.type] || tour.type,
        'Kalkış Tarihi': 'Tarih Yok',
        'Dönüş Tarihi': '-',
        'Yetişkin Fiyat': '-',
        'Çocuk Fiyat': '-',
        'Kontenjan': '-',
        'Min. Kişi': tour.min_pax,
        'Oluşturma Tarihi': format(new Date(tour.created_at), 'dd MMMM yyyy', { locale: tr })
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  const columnWidths = [
    { wch: 35 }, // Tur Adı
    { wch: 15 }, // Destinasyon
    { wch: 12 }, // Tip
    { wch: 15 }, // Kalkış Tarihi
    { wch: 15 }, // Dönüş Tarihi
    { wch: 15 }, // Yetişkin Fiyat
    { wch: 15 }, // Çocuk Fiyat
    { wch: 12 }, // Kontenjan
    { wch: 12 }, // Min. Kişi
    { wch: 18 }  // Oluşturma Tarihi
  ];
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Turlar');

  const fileName = `turlar_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportConversationSummariesToExcel = (summaries: ConversationSummary[]) => {
  const data = summaries.map((summary) => ({
    'Telefon': summary.phone,
    'Tarih': format(new Date(summary.conversation_date), 'dd MMMM yyyy', { locale: tr }),
    'Özet': summary.summary,
    'Konular': summary.topics?.join(', ') || '-',
    'Bahsedilen Turlar': summary.mentioned_tours?.join(', ') || '-',
    'Duygu Durumu': summary.sentiment || '-',
    'Mesaj Sayısı': summary.message_count
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  const columnWidths = [
    { wch: 15 }, // Telefon
    { wch: 15 }, // Tarih
    { wch: 50 }, // Özet
    { wch: 30 }, // Konular
    { wch: 30 }, // Bahsedilen Turlar
    { wch: 15 }, // Duygu Durumu
    { wch: 12 }  // Mesaj Sayısı
  ];
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Konuşma Özetleri');

  const fileName = `konusma_ozetleri_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportAnalyticsToExcel = (analytics: {
  revenueByMonth: Array<{ month: string; revenue: number; registrations: number }>;
  topDestinations: Array<{ destination: string; count: number; revenue: number }>;
  conversionRates: Array<{ date: string; conversations: number; registrations: number; rate: number }>;
}) => {
  const workbook = XLSX.utils.book_new();

  // Aylık gelir sayfası
  const revenueData = analytics.revenueByMonth.map((item) => ({
    'Ay': item.month,
    'Gelir (TL)': item.revenue,
    'Kayıt Sayısı': item.registrations,
    'Ortalama Gelir': Math.round(item.revenue / (item.registrations || 1))
  }));
  const revenueSheet = XLSX.utils.json_to_sheet(revenueData);
  revenueSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, revenueSheet, 'Aylık Gelir');

  // Popüler destinasyonlar sayfası
  const destinationData = analytics.topDestinations.map((item) => ({
    'Destinasyon': item.destination,
    'Kayıt Sayısı': item.count,
    'Toplam Gelir (TL)': item.revenue,
    'Ortalama Gelir': Math.round(item.revenue / (item.count || 1))
  }));
  const destinationSheet = XLSX.utils.json_to_sheet(destinationData);
  destinationSheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, destinationSheet, 'Popüler Destinasyonlar');

  // Dönüşüm oranları sayfası
  const conversionData = analytics.conversionRates.map((item) => ({
    'Tarih': item.date,
    'Konuşma': item.conversations,
    'Kayıt': item.registrations,
    'Dönüşüm Oranı (%)': (item.rate * 100).toFixed(2)
  }));
  const conversionSheet = XLSX.utils.json_to_sheet(conversionData);
  conversionSheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, conversionSheet, 'Dönüşüm Oranları');

  const fileName = `analitikler_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
