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
  revenueByMonth: Array<{ month: string; revenue: number; registrations: number }>;
  topDestinations: Array<{ destination: string; count: number; revenue: number }>;
  conversionRate: { conversations: number; registrations: number; rate: number };
  periodGrowth: number;
  averageOrderValue: number;
  totalRevenue: number;
  totalRegistrations: number;
  totalConversations: number;
}

type FilterDeps = {
  dateFilter: DateFilterType;
  customDateRange: DateRange | undefined;
};

const localeMap = { tr, en: enUS, de, ru, ar, fr, es };
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

      let registrationsQuery = supabase
        .from("registrations")
        .select(`
          id,
          pax,
          created_at,
          status,
          tours(destination),
          tour_dates(price_adult)
        `)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .in("status", ACTIVE_REGISTRATION_STATUSES);

      if (agencyId) registrationsQuery = registrationsQuery.eq("agency_id", agencyId);

      const { data: registrations } = await registrationsQuery;

      // Aylık gelir
      const revenueByMonth: Record<string, { revenue: number; registrations: number }> = {};
      let totalRevenue = 0;

      registrations?.forEach((reg: any) => {
        const month = format(new Date(reg.created_at), 'MMM yyyy', { locale });
        const price = reg.tour_dates?.price_adult || 0;
        const revenue = price * reg.pax;
        totalRevenue += revenue;

        if (!revenueByMonth[month]) revenueByMonth[month] = { revenue: 0, registrations: 0 };
        revenueByMonth[month].revenue += revenue;
        revenueByMonth[month].registrations += 1;
      });

      const revenueArray = Object.entries(revenueByMonth)
        .map(([month, data]) => ({
          month,
          revenue: Math.round(data.revenue),
          registrations: data.registrations,
        }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      // Destinasyonlar
      const destinationMap: Record<string, { count: number; revenue: number }> = {};
      registrations?.forEach((reg: any) => {
        const dest = reg.tours?.destination || t('common.unspecified');
        const price = reg.tour_dates?.price_adult || 0;
        const revenue = price * reg.pax;

        if (!destinationMap[dest]) destinationMap[dest] = { count: 0, revenue: 0 };
        destinationMap[dest].count += 1;
        destinationMap[dest].revenue += revenue;
      });

      const topDestinations = Object.entries(destinationMap)
        .map(([destination, data]) => ({
          destination,
          count: data.count,
          revenue: Math.round(data.revenue),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Dönüşüm oranı — aynı status filter
      let conversationQuery = supabase
        .from("whatsapp_conversations")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      if (agencyId) conversationQuery = conversationQuery.eq("agency_id", agencyId);
      const { count: conversationCount } = await conversationQuery;

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

      // Dönem büyümesi — filtre dönemini ikiye böl
      const periodMs = differenceInMilliseconds(endDate, startDate);
      const midPoint = new Date(startDate.getTime() + periodMs / 2);

      let firstHalfRevenue = 0;
      let secondHalfRevenue = 0;
      registrations?.forEach((reg: any) => {
        const regDate = new Date(reg.created_at);
        const price = reg.tour_dates?.price_adult || 0;
        const revenue = price * reg.pax;
        if (regDate < midPoint) firstHalfRevenue += revenue;
        else secondHalfRevenue += revenue;
      });

      const periodGrowth = firstHalfRevenue > 0
        ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
        : (secondHalfRevenue > 0 ? 100 : 0);

      const averageOrderValue = registrations && registrations.length > 0
        ? totalRevenue / registrations.length
        : 0;

      setAnalytics({
        revenueByMonth: revenueArray,
        topDestinations,
        conversionRate,
        periodGrowth,
        averageOrderValue,
        totalRevenue,
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
        { header: t('analytics.advanced.totalRevenue'), accessor: (r) => r.revenue },
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

      {/* KPI Kartlar */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.advanced.totalRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(analytics.totalRevenue, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('analytics.advanced.totalRevenueDesc', {
                count: analytics.totalRegistrations,
                period: getDateFilterLabel(),
              })}
            </p>
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
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke={chartColors[0]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name={t('analytics.advanced.revenueLabel')}
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
                    <p className="font-bold">{formatPrice(dest.revenue, currency)}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('analytics.advanced.average')}: {formatPrice(Math.round(dest.revenue / dest.count), currency)}
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
