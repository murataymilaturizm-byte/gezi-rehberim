import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, TrendingUp, DollarSign, Users, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, subYears, startOfDay, endOfDay } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { formatPrice } from "@/utils/currency";
import { DateRangeFilter, DateFilterType } from "@/components/admin/DateRangeFilter";
import { AnalyticsSkeleton } from "@/components/admin/skeletons/AnalyticsSkeleton";
import { AnalyticsEmptyIllustration } from "@/components/illustrations/AnalyticsEmptyIllustration";
import { getChartColors } from "@/lib/chartColors";
import { exportToCsv } from "@/utils/csvExport";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import { DateRange } from "react-day-picker";

const localeMap = { tr, en: enUS, de, ru, ar, fr, es };

interface DestinationData {
  destination: string;
  count: number;
  revenue: number;
  averagePrice: number;
  totalPax: number;
  growthRate: number;
}

interface DestinationStats {
  topDestinations: DestinationData[];
  totalDestinations: number;
  totalRevenue: number;
  totalBookings: number;
  averageBookingValue: number;
  monthlyTrends: Array<{ month: string; [key: string]: string | number }>;
}

export const DestinationAnalytics = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [stats, setStats] = useState<DestinationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('6months');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [currency, setCurrency] = useState<string>('TRY');

  useEffect(() => {
    loadDestinationStats();
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
    const { startDate, endDate } = getDateRange();
    const locale = localeMap[i18n.language as keyof typeof localeMap] || tr;
    return `${format(startDate, 'dd MMM yyyy', { locale })} - ${format(endDate, 'dd MMM yyyy', { locale })}`;
  };

  const loadDestinationStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if super admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      const isSuperAdmin = !!roleData;

      let agencyId = null;
      if (!isSuperAdmin) {
        const { data: agency } = await supabase
          .from("agencies")
          .select("id, primary_currency")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!agency) return;
        agencyId = agency.id;
        setCurrency((agency as any).primary_currency || 'TRY');
      }

      // Tarih filtreyi de uygula
      const { startDate, endDate } = getDateRange();

      // Get all registrations with tour details (left join — silinmiş tour'lar kaybolmasın)
      let registrationsQuery = supabase
        .from("registrations")
        .select(`
          *,
          tours (destination, title, currency),
          tour_dates (price_adult, departure_date)
        `)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .in("status", ["CONFIRMED", "NEW", "PENDING"]);

      if (agencyId) {
        registrationsQuery = registrationsQuery.eq("agency_id", agencyId);
      }

      const { data: registrations } = await registrationsQuery;

      if (!registrations || registrations.length === 0) {
        setStats(null);
        return;
      }

      // Calculate destination statistics
      const destinationMap: Record<string, {
        count: number;
        revenue: number;
        totalPax: number;
        bookings: Array<{ date: string; amount: number }>;
      }> = {};

      registrations.forEach((reg: any) => {
        const destination = reg.tours?.destination || t("destinationAnalytics.unknown");
        const price = (reg.tour_dates?.price_adult || 0) * reg.pax;
        const date = reg.tour_dates?.departure_date;

        if (!destinationMap[destination]) {
          destinationMap[destination] = {
            count: 0,
            revenue: 0,
            totalPax: 0,
            bookings: []
          };
        }

        destinationMap[destination].count += 1;
        destinationMap[destination].revenue += price;
        destinationMap[destination].totalPax += reg.pax;
        if (date) {
          destinationMap[destination].bookings.push({ date, amount: price });
        }
      });

      // Calculate growth rates and sort
      const topDestinations: DestinationData[] = Object.entries(destinationMap)
        .map(([destination, data]) => {
          const sortedBookings = data.bookings.sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          
          // Calculate growth rate (comparing first half vs second half)
          const midPoint = Math.floor(sortedBookings.length / 2);
          const firstHalfRevenue = sortedBookings.slice(0, midPoint)
            .reduce((sum, b) => sum + b.amount, 0);
          const secondHalfRevenue = sortedBookings.slice(midPoint)
            .reduce((sum, b) => sum + b.amount, 0);
          
          const growthRate = firstHalfRevenue > 0 
            ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 
            : 0;

          return {
            destination,
            count: data.count,
            revenue: data.revenue,
            averagePrice: data.revenue / data.count,
            totalPax: data.totalPax,
            growthRate
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      const totalRevenue = topDestinations.reduce((sum, d) => sum + d.revenue, 0);
      const totalBookings = topDestinations.reduce((sum, d) => sum + d.count, 0);

      // Calculate monthly trends for top 3 destinations
      const top3Destinations = topDestinations.slice(0, 3);
      const monthlyData: Record<string, any> = {};

      const currentLocale = localeMap[i18n.language as keyof typeof localeMap] || tr;
      registrations.forEach((reg: any) => {
        if (!reg.tour_dates?.departure_date) return;

        const destination = reg.tours?.destination;
        if (!top3Destinations.find(d => d.destination === destination)) return;

        const date = new Date(reg.tour_dates.departure_date);
        const monthKey = format(date, 'MMM yyyy', { locale: currentLocale });
        const price = (reg.tour_dates?.price_adult || 0) * reg.pax;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { month: monthKey };
        }
        
        if (!monthlyData[monthKey][destination]) {
          monthlyData[monthKey][destination] = 0;
        }
        
        monthlyData[monthKey][destination] += price;
      });

      const monthlyTrends = Object.values(monthlyData).slice(-6);

      setStats({
        topDestinations,
        totalDestinations: topDestinations.length,
        totalRevenue,
        totalBookings,
        averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
        monthlyTrends
      });
    } catch (error) {
      console.error("Destination analytics error:", error);
      toast({ title: t("common.error"), description: t("common.loadError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const chartColors = useMemo(() => getChartColors(), []);

  const handleExport = () => {
    if (!stats) return;
    exportToCsv(
      stats.topDestinations,
      [
        { header: 'Destination', accessor: (r) => r.destination },
        { header: 'Bookings', accessor: (r) => r.count },
        { header: 'Pax', accessor: (r) => r.totalPax },
        { header: 'Revenue', accessor: (r) => r.revenue },
        { header: 'Avg Price', accessor: (r) => Math.round(r.averagePrice) },
        { header: 'Growth %', accessor: (r) => r.growthRate.toFixed(1) },
      ],
      `destinations_${t('analytics.advanced.exportFilename')}`,
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

  if (!stats || stats.topDestinations.length === 0) {
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
            <p className="text-lg font-medium text-foreground">{t("destinationAnalytics.noDestinationData")}</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">{t("destinationAnalytics.noDestinationDataDescription")}</p>
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

      {/* Özet Kartlar */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("destinationAnalytics.totalDestinations")}</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDestinations}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("destinationAnalytics.differentDestinations")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("destinationAnalytics.totalRevenue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(stats.totalRevenue, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("destinationAnalytics.allDestinations")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("destinationAnalytics.totalBookings")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("destinationAnalytics.bookingCount")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("destinationAnalytics.averageBasket")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(Math.round(stats.averageBookingValue), currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("destinationAnalytics.perBooking")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Popüler Destinasyonlar ve Dağılım */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t("destinationAnalytics.destinationRevenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <div style={{ minWidth: Math.max(400, stats.topDestinations.slice(0, 8).length * 70) }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={stats.topDestinations.slice(0, 8)} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="destination" angle={-35} textAnchor="end" height={90} tick={{ fontSize: 11 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => formatPrice(value, currency)}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="revenue" fill={chartColors[1]} name={t("destinationAnalytics.revenue")} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("destinationAnalytics.bookingDistribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.topDestinations.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.destination} (${entry.count})`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {stats.topDestinations.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Aylık Trend - Top 3 Destinasyonlar */}
      {stats.monthlyTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t("destinationAnalytics.topDestinationsTrend")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatPrice(value, currency)}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                {stats.topDestinations.slice(0, 3).map((dest, index) => (
                  <Line 
                    key={dest.destination}
                    type="monotone" 
                    dataKey={dest.destination} 
                    stroke={chartColors[index % chartColors.length]} 
                    strokeWidth={2}
                    name={dest.destination}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detaylı Destinasyon Listesi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t("destinationAnalytics.allDestinationsDetailed")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topDestinations.map((destination, index) => (
              <div 
                key={destination.destination} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-lg">{destination.destination}</p>
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{destination.count} {t("customerAnalytics.reservations")}</span>
                      <span>•</span>
                      <span>{destination.totalPax} {t("destinationAnalytics.people")}</span>
                      <span>•</span>
                      <span>{t("destinationAnalytics.average")}: {formatPrice(Math.round(destination.averagePrice), currency)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">
                    {formatPrice(destination.revenue, currency)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {destination.growthRate >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
                    )}
                    <span className={`text-sm font-medium ${destination.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {destination.growthRate >= 0 ? '+' : ''}{destination.growthRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
