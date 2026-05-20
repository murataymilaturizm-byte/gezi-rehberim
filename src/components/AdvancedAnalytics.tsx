import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Award, Calendar as CalendarIcon, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, subMonths, subYears, startOfDay, endOfDay, differenceInMilliseconds } from "date-fns";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { formatPrice } from "@/utils/currency";

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

type DateFilterType = '1month' | '3months' | '6months' | '1year' | 'custom';

const localeMap = { tr, en: enUS, de, ru, ar, fr, es };

// Tüm rapor query'lerinde aynı status filter — tutarlılık için
const ACTIVE_REGISTRATION_STATUSES = ["CONFIRMED", "NEW", "PENDING"];

export const AdvancedAnalytics = () => {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.language as keyof typeof localeMap] || tr;

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('6months');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [currency, setCurrency] = useState<string>('TRY');

  useEffect(() => {
    loadAnalytics();
  }, [dateFilter, customDateRange]);

  const getDateRange = () => {
    const endDate = new Date();
    let startDate: Date;

    switch (dateFilter) {
      case '1month':
        startDate = subMonths(endDate, 1);
        break;
      case '3months':
        startDate = subMonths(endDate, 3);
        break;
      case '6months':
        startDate = subMonths(endDate, 6);
        break;
      case '1year':
        startDate = subYears(endDate, 1);
        break;
      case 'custom':
        if (customDateRange?.from) {
          startDate = startOfDay(customDateRange.from);
          if (customDateRange.to) {
            return { startDate, endDate: endOfDay(customDateRange.to) };
          }
          return { startDate, endDate: endOfDay(endDate) };
        }
        startDate = subMonths(endDate, 6);
        break;
      default:
        startDate = subMonths(endDate, 6);
    }

    return { startDate: startOfDay(startDate), endDate: endOfDay(endDate) };
  };

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

      const { startDate, endDate } = getDateRange();

      // Registrations — left join (silinmiş tour/tour_date'i atmasın)
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

      if (agencyId) {
        registrationsQuery = registrationsQuery.eq("agency_id", agencyId);
      }

      const { data: registrations } = await registrationsQuery;

      // Aylık gelir (silinmiş tour_dates için 0 ekle, kayıt sayılır)
      const revenueByMonth: Record<string, { revenue: number; registrations: number }> = {};
      let totalRevenue = 0;

      registrations?.forEach((reg: any) => {
        const month = format(new Date(reg.created_at), 'MMM yyyy', { locale });
        const price = reg.tour_dates?.price_adult || 0;
        const revenue = price * reg.pax;
        totalRevenue += revenue;

        if (!revenueByMonth[month]) {
          revenueByMonth[month] = { revenue: 0, registrations: 0 };
        }
        revenueByMonth[month].revenue += revenue;
        revenueByMonth[month].registrations += 1;
      });

      const revenueArray = Object.entries(revenueByMonth)
        .map(([month, data]) => ({
          month,
          revenue: Math.round(data.revenue),
          registrations: data.registrations,
        }))
        .sort((a, b) => {
          const dateA = new Date(a.month);
          const dateB = new Date(b.month);
          return dateA.getTime() - dateB.getTime();
        });

      // Destinasyon detayları
      const destinationMap: Record<string, { count: number; revenue: number }> = {};
      registrations?.forEach((reg: any) => {
        const dest = reg.tours?.destination || t('common.unspecified');
        const price = reg.tour_dates?.price_adult || 0;
        const revenue = price * reg.pax;

        if (!destinationMap[dest]) {
          destinationMap[dest] = { count: 0, revenue: 0 };
        }
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

      // === Dönüşüm Oranı — AYNI status filter ===
      let conversationQuery = supabase
        .from("whatsapp_conversations")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (agencyId) {
        conversationQuery = conversationQuery.eq("agency_id", agencyId);
      }

      const { count: conversationCount } = await conversationQuery;

      // Registration count: AYNI status filter (CANCELLED hariç) — TUTARLILIK
      let registrationCountQuery = supabase
        .from("registrations")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .in("status", ACTIVE_REGISTRATION_STATUSES);

      if (agencyId) {
        registrationCountQuery = registrationCountQuery.eq("agency_id", agencyId);
      }

      const { count: registrationCount } = await registrationCountQuery;

      const conversionRate = {
        conversations: conversationCount || 0,
        registrations: registrationCount || 0,
        rate: conversationCount ? ((registrationCount || 0) / conversationCount) * 100 : 0,
      };

      // === Dönem Büyümesi — filtre dönemini İKİYE BÖL ===
      // İlk yarı vs ikinci yarı (filtre dönemiyle tutarlı)
      const periodMs = differenceInMilliseconds(endDate, startDate);
      const midPoint = new Date(startDate.getTime() + periodMs / 2);

      let firstHalfRevenue = 0;
      let secondHalfRevenue = 0;

      registrations?.forEach((reg: any) => {
        const regDate = new Date(reg.created_at);
        const price = reg.tour_dates?.price_adult || 0;
        const revenue = price * reg.pax;

        if (regDate < midPoint) {
          firstHalfRevenue += revenue;
        } else {
          secondHalfRevenue += revenue;
        }
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
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Date Filter UI (tek yerde, hem loading hem normal state'de aynı) ───
  const dateFilterCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          {t('analytics.advanced.dateFilter')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {[
            { id: '1month' as const, label: 'last1Month' },
            { id: '3months' as const, label: 'last3Months' },
            { id: '6months' as const, label: 'last6Months' },
            { id: '1year' as const, label: 'last1Year' },
          ].map((opt) => (
            <Button
              key={opt.id}
              variant={dateFilter === opt.id ? 'default' : 'outline'}
              onClick={() => {
                setDateFilter(opt.id);
                setCustomDateRange(undefined);
              }}
              size="sm"
            >
              {t(`analytics.filter.${opt.label}`)}
            </Button>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={dateFilter === 'custom' ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                {dateFilter === 'custom' && customDateRange?.from
                  ? getDateFilterLabel()
                  : <span>{t('analytics.filter.customDate')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={customDateRange}
                onSelect={(range) => {
                  setCustomDateRange(range);
                  if (range?.from) setDateFilter('custom');
                }}
                numberOfMonths={2}
                locale={locale}
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          {t('analytics.filter.showingData')}: <span className="font-medium">{getDateFilterLabel()}</span>
        </p>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {dateFilterCard}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted" />
              <CardContent className="h-24 bg-muted/50" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics || analytics.totalRegistrations === 0) {
    return (
      <div className="space-y-6">
        {dateFilterCard}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Award className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">{t('analytics.advanced.noData')}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('analytics.advanced.noDataDescription')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dateFilterCard}

      {/* Özet Kartlar */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.advanced.totalRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(analytics.totalRevenue, currency)}
            </div>
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
            {analytics.periodGrowth >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.periodGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analytics.periodGrowth >= 0 ? '+' : ''}{analytics.periodGrowth.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('analytics.advanced.vsPreviousHalf')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.advanced.averageBasket')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(Math.round(analytics.averageOrderValue), currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('analytics.advanced.perRegistration')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.advanced.conversionRate')}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.conversionRate.rate.toFixed(1)}%
            </div>
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
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatPrice(value, currency)}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name={t('analytics.advanced.revenueLabel')}
                />
              </LineChart>
            </ResponsiveContainer>
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
            <div className="space-y-4">
              {analytics.topDestinations.map((dest, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-accent/50">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <p className="font-medium">{dest.destination}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('analytics.advanced.registrationCount', { count: dest.count })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
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
