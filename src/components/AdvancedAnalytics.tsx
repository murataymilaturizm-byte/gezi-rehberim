import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, DollarSign, Users, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, subYears, startOfDay, endOfDay, differenceInMilliseconds } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DateRange } from "react-day-picker";
import { formatPrice } from "@/utils/currency";
import { DateRangeFilter, DateFilterType } from "@/components/admin/DateRangeFilter";
import { AnalyticsSkeleton } from "@/components/admin/skeletons/AnalyticsSkeleton";
import { AnalyticsEmptyIllustration } from "@/components/illustrations/AnalyticsEmptyIllustration";
import { getChartColors } from "@/lib/chartColors";
import { exportToCsv } from "@/utils/csvExport";

interface AnalyticsData {
  /** K1: aylık trend — paid (tahsilat) + reserved (hacim) ayrı */
  revenueByMonth: Array<{ month: string; revenue: number; reservedVolume: number; registrations: number }>;
  topDestinations: Array<{ destination: string; count: number; revenue: number; reservedVolume: number }>;
  conversionRate: { conversations: number; registrations: number; rate: number };
  periodGrowth: number;
  averageOrderValue: number;
  /** K1: GERÇEK TAHSİLAT — paid_amount toplamı (vergi/muhasebe için doğru rakam) */
  totalRevenue: number;
  /** K1: REZERVASYON HACMİ — total_amount snapshot toplamı (CANCELLED hariç) */
  reservedVolume: number;
  totalRegistrations: number;
  totalConversations: number;
}

type FilterDeps = {
  dateFilter: DateFilterType;
  customDateRange: DateRange | undefined;
};

const localeMap = { tr, en: enUS, de, ru, ar, fr, es };
// K1: Hacim hesabı için aktif rezervasyonlar (CANCELLED hariç tüm statüler).
// Tahsilat hesabı paid_amount > 0 olanları otomatik kapsar — ayrı filter gerekmez.
const ACTIVE_REGISTRATION_STATUSES = ["CONFIRMED", "NEW", "PENDING"];

export const AdvancedAnalytics = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const locale = localeMap[i18n.language as keyof typeof localeMap] || tr;

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('6months');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [currency, setCurrency] = useState<string>('TRY');

  const chartColors = useMemo(() => getChartColors(), []);

  const dateRange = useMemo(() => getDateRangeFromFilter({ dateFilter, customDateRange }), [dateFilter, customDateRange]);

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, customDateRange]);

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case '1month': return t('analytics.filter.last1Month');
      case '3months': return t('analytics.filter.last3Months');
      case '6months': return t('analytics.filter.last6Months');
      case '1year': return t('analytics.filter.last1Year');
      case 'custom':
        if (customDateRange?.from) {
          const fromDate = format(customDateRange.from, 'dd MMM yyyy', { locale });
          const toDate = customDateRange.to
            ? format(customDateRange.to, 'dd MMM yyyy', { locale })
            : t('analytics.filter.today');
          return `${fromDate} - ${toDate}`;
        }
        return t('analytics.filter.customDate');
      default: return t('analytics.filter.last6Months');
    }
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      const isSuperAdmin = !!roleData;

      let agencyId: string | null = null;
      if (!isSuperAdmin) {
        const { data: agency } = await supabase
          .from("agencies")
          .select("id, primary_currency")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!agency) {
          setIsLoading(false);
          return;
        }
        agencyId = agency.id;
        setCurrency((agency as any).primary_currency || 'TRY');
      }

      const { startDate, endDate } = dateRange;

      // K1 + K3: paid_amount (tahsilat) + total_amount snapshot (hacim) seçildi
      let registrationsQuery = supabase
        .from("registrations")
        .select(`
          id,
          pax,
          created_at,
          status,
          paid_amount,
          total_amount,
          tours(destination),
          tour_dates(price_adult)
        `)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .in("status", ACTIVE_REGISTRATION_STATUSES);

      if (agencyId) registrationsQuery = registrationsQuery.eq("agency_id", agencyId);

      const { data: registrations } = await registrationsQuery;

      // K1: Aylık trend — paid (tahsilat) + reserved (hacim) ayrı
      const revenueByMonth: Record<string, { revenue: number; reserved: number; registrations: number }> = {};
      let totalRevenue = 0;       // K1: gerçek tahsilat (paid_amount)
      let reservedVolume = 0;     // K1: rezervasyon hacmi (total_amount snapshot, yoksa fallback)

      registrations?.forEach((reg: any) => {
        const month = format(new Date(reg.created_at), 'MMM yyyy', { locale });
        const _paid = Number(reg.paid_amount) || 0;
        const _snap = Number(reg.total_amount) || 0;
        const _reserved = _snap > 0 ? _snap : (reg.tour_dates?.price_adult || 0) * (reg.pax || 1);
        totalRevenue += _paid;
        reservedVolume += _reserved;

        if (!revenueByMonth[month]) revenueByMonth[month] = { revenue: 0, reserved: 0, registrations: 0 };
        revenueByMonth[month].revenue += _paid;
        revenueByMonth[month].reserved += _reserved;
        revenueByMonth[month].registrations += 1;
      });

      const revenueArray = Object.entries(revenueByMonth)
        .map(([month, data]) => ({
          month,
          revenue: Math.round(data.revenue),
          reservedVolume: Math.round(data.reserved),
          registrations: data.registrations,
        }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      // Destinasyonlar — K1: revenue=tahsilat, reservedVolume=hacim
      const destinationMap: Record<string, { count: number; revenue: number; reserved: number }> = {};
      registrations?.forEach((reg: any) => {
        const dest = reg.tours?.destination || t('common.unspecified');
        const _paid = Number(reg.paid_amount) || 0;
        const _snap = Number(reg.total_amount) || 0;
        const _reserved = _snap > 0 ? _snap : (reg.tour_dates?.price_adult || 0) * (reg.pax || 1);

        if (!destinationMap[dest]) destinationMap[dest] = { count: 0, revenue: 0, reserved: 0 };
        destinationMap[dest].count += 1;
        destinationMap[dest].revenue += _paid;
        destinationMap[dest].reserved += _reserved;
      });

      const topDestinations = Object.entries(destinationMap)
        .map(([destination, data]) => ({
          destination,
          count: data.count,
          revenue: Math.round(data.revenue),
          reservedVolume: Math.round(data.reserved),
        }))
        // Sıralama hacme göre — "en büyük bölgeler" iş anlamında daha karar verici
        .sort((a, b) => b.reservedVolume - a.reservedVolume)
        .slice(0, 5);

      // Dönüşüm oranı — F-R1 (2026-07-28): payda artık GERÇEK konuşma sayısı
      // (distinct phone, RPC — SECURITY INVOKER/RLS'li). Eski satır-sayımı
      // user+assistant+system-state satırlarını "konuşma" sayıyordu (fbad140f
      // 6-ay kanıtı: 1312 satır vs 4 konuşma → yapısal-yanıltıcı oran).
      const { data: _distinctPhones } = await supabase.rpc("count_distinct_conversation_phones", {
        p_agency_id: agencyId || null,
        p_start: startDate.toISOString(),
        p_end: endDate.toISOString(),
      });
      const conversationCount = (_distinctPhones as number | null) ?? 0;

      let registrationCountQuery = supabase
        .from("registrations")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .in("status", ACTIVE_REGISTRATION_STATUSES);
      if (agencyId) registrationCountQuery = registrationCountQuery.eq("agency_id", agencyId);
      const { count: registrationCount } = await registrationCountQuery;

      const conversionRate = {
        conversations: conversationCount || 0,
        registrations: registrationCount || 0,
        rate: conversationCount ? ((registrationCount || 0) / conversationCount) * 100 : 0,
      };

      // Dönem büyümesi — TAHSİLAT (paid_amount) bazlı (gerçek kasa hareketi)
      const periodMs = differenceInMilliseconds(endDate, startDate);
      const midPoint = new Date(startDate.getTime() + periodMs / 2);

      let firstHalfRevenue = 0;
      let secondHalfRevenue = 0;
      registrations?.forEach((reg: any) => {
        const regDate = new Date(reg.created_at);
        const _paid = Number(reg.paid_amount) || 0;
        if (regDate < midPoint) firstHalfRevenue += _paid;
        else secondHalfRevenue += _paid;
      });

      const periodGrowth = firstHalfRevenue > 0
        ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
        : (secondHalfRevenue > 0 ? 100 : 0);

      // K1: ortalama sepet — hacim üzerinden (mantıklı iş tanımı, tahsilat henüz tam olmayabilir)
      const averageOrderValue = registrations && registrations.length > 0
        ? reservedVolume / registrations.length
        : 0;

      setAnalytics({
        revenueByMonth: revenueArray,
        topDestinations,
        conversionRate,
        periodGrowth,
        averageOrderValue,
        totalRevenue,
        reservedVolume,
        totalRegistrations: registrations?.length || 0,
        totalConversations: conversationCount || 0,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      toast({ title: t("common.error"), description: t("common.loadError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!analytics) return;
    exportToCsv(
      analytics.topDestinations,
      [
        { header: t('analytics.advanced.destinationDetails'), accessor: (r) => r.destination },
        { header: t('analytics.advanced.registrationCount', { count: '' }).replace('{{count}}', '').trim() || 'Count', accessor: (r) => r.count },
        // K1: tahsilat (paid) + hacim (reserved) ayrı sütun
        { header: t('analytics.advanced.collectedRevenue', { defaultValue: 'Tahsilat' }), accessor: (r) => r.revenue },
        { header: t('analytics.advanced.reservedVolumeShort', { defaultValue: 'Rezerve hacim' }), accessor: (r) => r.reservedVolume },
      ],
      t('analytics.advanced.exportFilename'),
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DateRangeFilter
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          customDateRange={customDateRange}
          setCustomDateRange={setCustomDateRange}
        />
        <AnalyticsSkeleton kpiCount={4} showList />
      </div>
    );
  }

  if (!analytics || analytics.totalRegistrations === 0) {
    return (
      <div className="space-y-6">
        <DateRangeFilter
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          customDateRange={customDateRange}
          setCustomDateRange={setCustomDateRange}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AnalyticsEmptyIllustration className="w-32 h-32 mb-4" />
            <p className="text-lg font-medium text-foreground">{t('analytics.advanced.noData')}</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
              {t('analytics.advanced.noDataDescription')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DateRangeFilter
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customDateRange={customDateRange}
        setCustomDateRange={setCustomDateRange}
        onExport={handleExport}
      />

      {/* KPI Kartlar — K1: Tahsilat + Hacim ayrı */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('analytics.advanced.collectedRevenue', { defaultValue: 'Tahsilat' })}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatPrice(analytics.totalRevenue, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('analytics.advanced.collectedRevenueDesc', {
                defaultValue: 'Gerçek tahsilat (paid_amount) · {{period}}',
                period: getDateFilterLabel(),
              })}
            </p>
            {/* K1: ikincil — rezervasyon hacmi (henüz tahsil edilmemiş olabilir) */}
            <div className="mt-2 pt-2 border-t border-border/40">
              <p className="text-[11px] text-muted-foreground">
                {t('analytics.advanced.reservedVolumeShort', { defaultValue: 'Rezerve hacim' })}:{' '}
                <span className="font-semibold text-foreground">
                  {formatPrice(analytics.reservedVolume, currency)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.advanced.periodGrowth')}</CardTitle>
            {analytics.periodGrowth >= 0
              ? <TrendingUp className="h-4 w-4 text-green-500" />
              : <TrendingDown className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.periodGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analytics.periodGrowth >= 0 ? '+' : ''}{analytics.periodGrowth.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('analytics.advanced.vsPreviousHalf')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.advanced.averageBasket')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(Math.round(analytics.averageOrderValue), currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('analytics.advanced.perRegistration')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.advanced.conversionRate')}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.conversionRate.rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('analytics.advanced.conversionDesc', {
                registrations: analytics.conversionRate.registrations,
                conversations: analytics.conversionRate.conversations,
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aylık Gelir Grafiği */}
      {analytics.revenueByMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.advanced.monthlyTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <div style={{ minWidth: Math.max(300, analytics.revenueByMonth.length * 60) }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.revenueByMonth} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" angle={-25} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => formatPrice(value, currency)}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    {/* K1: Tahsilat çizgisi (gerçek kasa) */}
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke={chartColors[0]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name={t('analytics.advanced.collectedRevenue', { defaultValue: 'Tahsilat' })}
                    />
                    {/* K1: Rezerve hacim çizgisi (toplam beklenen ciro) */}
                    <Line
                      type="monotone"
                      dataKey="reservedVolume"
                      stroke={chartColors[1] || 'hsl(38 92% 50%)'}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name={t('analytics.advanced.reservedVolumeShort', { defaultValue: 'Rezerve hacim' })}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Destinasyon Detayları */}
      {analytics.topDestinations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.advanced.destinationDetails')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topDestinations.map((dest, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{dest.destination}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('analytics.advanced.registrationCount', { count: dest.count })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {/* K1: önce hacim (büyük), altında tahsilat (gerçekleşen) */}
                    <p className="font-bold">{formatPrice(dest.reservedVolume, currency)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t('analytics.advanced.collectedRevenue', { defaultValue: 'Tahsilat' })}: {formatPrice(dest.revenue, currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('analytics.advanced.average')}: {formatPrice(Math.round(dest.reservedVolume / dest.count), currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── Helper: date range calc ────────────────────────────────────────────────
function getDateRangeFromFilter(deps: FilterDeps): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  let startDate: Date;

  switch (deps.dateFilter) {
    case '1month': startDate = subMonths(endDate, 1); break;
    case '3months': startDate = subMonths(endDate, 3); break;
    case '6months': startDate = subMonths(endDate, 6); break;
    case '1year': startDate = subYears(endDate, 1); break;
    case 'custom':
      if (deps.customDateRange?.from) {
        startDate = startOfDay(deps.customDateRange.from);
        if (deps.customDateRange.to) return { startDate, endDate: endOfDay(deps.customDateRange.to) };
        return { startDate, endDate: endOfDay(endDate) };
      }
      startDate = subMonths(endDate, 6);
      break;
    default: startDate = subMonths(endDate, 6);
  }

  return { startDate: startOfDay(startDate), endDate: endOfDay(endDate) };
}
