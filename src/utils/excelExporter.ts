import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { tr, enUS, de, fr, es, ru, ar } from 'date-fns/locale';
import i18next from 'i18next';

const getDateLocale = () => {
  const lang = i18next.language || 'tr';
  const locales: Record<string, Locale> = { tr, en: enUS, de, fr, es, ru, ar };
  return locales[lang] || tr;
};

const t = (key: string) => i18next.t(key);

interface Registration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  note?: string;
  created_at: string;
  source_channel?: string;
  payment_status?: string;
  total_amount?: number;
  paid_amount?: number;
  deposit_amount?: number;
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

export const exportRegistrationsToExcel = (registrations: Registration[]) => {
  const locale = getDateLocale();
  const data = registrations.map((reg) => {
    const totalAmount = reg.total_amount || (reg.tour_dates.price_adult * reg.pax);
    const paidAmount = reg.paid_amount || 0;
    const remainingAmount = totalAmount - paidAmount;

    return {
      [t('admin.excel.registrationId')]: reg.id.substring(0, 8),
      [t('admin.registrations.name')]: reg.full_name,
      [t('admin.registrations.phone')]: reg.phone,
      [t('admin.registrations.tour')]: reg.tours.title,
      [t('admin.excel.destination')]: reg.tours.destination,
      [t('admin.registrations.date')]: format(new Date(reg.tour_dates.departure_date), 'dd MMMM yyyy', { locale }),
      [t('admin.registrations.pax')]: reg.pax,
      [t('admin.registrations.unitPrice')]: reg.tour_dates.price_adult,
      [t('admin.registrations.totalAmount')]: totalAmount,
      [t('admin.registrations.paidAmount')]: paidAmount,
      [t('admin.registrations.remainingAmount')]: remainingAmount,
      [t('admin.registrations.paymentStatus')]: t(`admin.paymentStatusLabels.${reg.payment_status || 'UNPAID'}`),
      [t('admin.registrations.status')]: t(`admin.status.${(reg.status || 'NEW').toLowerCase()}`),
      [t('admin.registrations.source')]: t(`admin.sourceChannel.${reg.source_channel || 'WHATSAPP'}`),
      [t('admin.registrations.note')]: reg.note || '-',
      [t('admin.registrations.createdAt')]: format(new Date(reg.created_at), 'dd MMMM yyyy HH:mm', { locale })
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 18 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('admin.excel.registrationsSheet'));

  const fileName = `${t('admin.excel.registrationsFile')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportToursToExcel = (tours: Tour[]) => {
  const locale = getDateLocale();
  const data: any[] = [];

  tours.forEach((tour) => {
    if (tour.tour_dates && tour.tour_dates.length > 0) {
      tour.tour_dates.forEach((date) => {
        data.push({
          [t('admin.excel.tourName')]: tour.title,
          [t('admin.excel.destination')]: tour.destination,
          [t('admin.excel.type')]: t(`admin.tourTypes.${tour.type === 'DAYTRIP' ? 'daytrip' : tour.type === 'N2' ? 'n2' : 'n3'}`),
          [t('admin.excel.departureDate')]: format(new Date(date.departure_date), 'dd MMMM yyyy', { locale }),
          [t('admin.excel.returnDate')]: date.return_date ? format(new Date(date.return_date), 'dd MMMM yyyy', { locale }) : '-',
          [t('admin.excel.adultPrice')]: date.price_adult,
          [t('admin.excel.currency')]: tour.currency,
          [t('admin.excel.childPrice')]: date.price_child || '-',
          [t('admin.tours.quota')]: date.quota,
          [t('admin.excel.minPax')]: tour.min_pax,
          [t('admin.registrations.createdAt')]: format(new Date(tour.created_at), 'dd MMMM yyyy', { locale })
        });
      });
    } else {
      data.push({
        [t('admin.excel.tourName')]: tour.title,
        [t('admin.excel.destination')]: tour.destination,
        [t('admin.excel.type')]: t(`admin.tourTypes.${tour.type === 'DAYTRIP' ? 'daytrip' : tour.type === 'N2' ? 'n2' : 'n3'}`),
        [t('admin.excel.departureDate')]: t('admin.excel.noDate'),
        [t('admin.excel.returnDate')]: '-',
        [t('admin.excel.adultPrice')]: '-',
        [t('admin.excel.currency')]: tour.currency,
        [t('admin.excel.childPrice')]: '-',
        [t('admin.tours.quota')]: '-',
        [t('admin.excel.minPax')]: tour.min_pax,
        [t('admin.registrations.createdAt')]: format(new Date(tour.created_at), 'dd MMMM yyyy', { locale })
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 35 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('admin.excel.toursSheet'));

  const fileName = `${t('admin.excel.toursFile')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportConversationSummariesToExcel = (summaries: ConversationSummary[]) => {
  const locale = getDateLocale();
  const data = summaries.map((summary) => ({
    [t('admin.registrations.phone')]: summary.phone,
    [t('admin.registrations.date')]: format(new Date(summary.conversation_date), 'dd MMMM yyyy', { locale }),
    [t('admin.excel.summary')]: summary.summary,
    [t('admin.excel.topics')]: summary.topics?.join(', ') || '-',
    [t('admin.excel.mentionedTours')]: summary.mentioned_tours?.join(', ') || '-',
    [t('admin.excel.sentiment')]: summary.sentiment || '-',
    [t('admin.excel.messageCount')]: summary.message_count
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 50 }, { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 12 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('admin.excel.conversationsSheet'));

  const fileName = `${t('admin.excel.conversationsFile')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportAnalyticsToExcel = (analytics: {
  revenueByMonth: Array<{ month: string; revenue: number; registrations: number }>;
  topDestinations: Array<{ destination: string; count: number; revenue: number }>;
  conversionRates: Array<{ date: string; conversations: number; registrations: number; rate: number }>;
}) => {
  const workbook = XLSX.utils.book_new();

  const revenueData = analytics.revenueByMonth.map((item) => ({
    [t('admin.excel.month')]: item.month,
    [t('admin.excel.revenue')]: item.revenue,
    [t('admin.excel.registrationCount')]: item.registrations,
    [t('admin.excel.avgRevenue')]: Math.round(item.revenue / (item.registrations || 1))
  }));
  const revenueSheet = XLSX.utils.json_to_sheet(revenueData);
  revenueSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, revenueSheet, t('admin.excel.monthlyRevenueSheet'));

  const destinationData = analytics.topDestinations.map((item) => ({
    [t('admin.excel.destination')]: item.destination,
    [t('admin.excel.registrationCount')]: item.count,
    [t('admin.excel.totalRevenue')]: item.revenue,
    [t('admin.excel.avgRevenue')]: Math.round(item.revenue / (item.count || 1))
  }));
  const destinationSheet = XLSX.utils.json_to_sheet(destinationData);
  destinationSheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, destinationSheet, t('admin.excel.popularDestinationsSheet'));

  const conversionData = analytics.conversionRates.map((item) => ({
    [t('admin.registrations.date')]: item.date,
    [t('admin.excel.conversations')]: item.conversations,
    [t('admin.excel.registrationCount')]: item.registrations,
    [t('admin.excel.conversionRate')]: (item.rate * 100).toFixed(2)
  }));
  const conversionSheet = XLSX.utils.json_to_sheet(conversionData);
  conversionSheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, conversionSheet, t('admin.excel.conversionRatesSheet'));

  const fileName = `${t('admin.excel.analyticsFile')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
