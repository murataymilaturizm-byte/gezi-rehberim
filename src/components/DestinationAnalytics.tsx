import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, TrendingUp, DollarSign, Users, Calendar as CalendarIcon, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, subMonths, subYears, startOfDay, endOfDay } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { formatPrice } from "@/utils/currency";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

type DateFilterType = '1month' | '3months' | '6months' | '1year' | 'custom';

const localeMap = {
  tr: tr,
  en: enUS,
  de: de,
  ru: ru,
  ar: ar,
  fr: fr,
  es: es,
};

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c'];

export const DestinationAnalytics = () => {
  const { t, i18n } = useTranslation();
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
        averageBookingValue: totalRevenue / totalBookings,
        monthlyTrends
      });
    } catch (error) {
      console.error("Destination analytics error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
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

  if (!stats || stats.topDestinations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">{t("destinationAnalytics.noDestinationData")}</p>
          <p className="text-sm text-muted-foreground mt-2">{t("destinationAnalytics.noDestinationDataDescription")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarih Filtreleme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t("destinationAnalytics.dateFilter")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={dateFilter === '1month' ? 'default' : 'outline'}
              onClick={() => {
                setDateFilter('1month');
                setCustomDateRange(undefined);
              }}
              size="sm"
            >
              {t("analytics.filter.last1Month")}
            </Button>
            <Button
              variant={dateFilter === '3months' ? 'default' : 'outline'}
              onClick={() => {
                setDateFilter('3months');
                setCustomDateRange(undefined);
              }}
              size="sm"
            >
              {t("analytics.filter.last3Months")}
            </Button>
            <Button
              variant={dateFilter === '6months' ? 'default' : 'outline'}
              onClick={() => {
                setDateFilter('6months');
                setCustomDateRange(undefined);
              }}
              size="sm"
            >
              {t("analytics.filter.last6Months")}
            </Button>
            <Button
              variant={dateFilter === '1year' ? 'default' : 'outline'}
              onClick={() => {
                setDateFilter('1year');
                setCustomDateRange(undefined);
              }}
              size="sm"
            >
              {t("analytics.filter.last1Year")}
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={dateFilter === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal",
                    !customDateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter === 'custom' && customDateRange?.from ? (
                    getDateFilterLabel()
                  ) : (
                    <span>{t("analytics.filter.customDate")}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={customDateRange}
                  onSelect={(range) => {
                    setCustomDateRange(range);
                    if (range?.from) {
                      setDateFilter('custom');
                    }
                  }}
                  numberOfMonths={2}
                  locale={localeMap[i18n.language as keyof typeof localeMap] || tr}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <p className="text-sm text-muted-foreground mt-4">
            {t("analytics.filter.showingData")}: <span className="font-medium">{getDateFilterLabel()}</span>
          </p>
        </CardContent>
      </Card>

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
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.topDestinations.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="destination" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatPrice(value, currency)}
                  labelStyle={{ color: '#000' }}
                />
                <Bar dataKey="revenue" fill="#82ca9d" name={t("destinationAnalytics.revenue")} />
              </BarChart>
            </ResponsiveContainer>
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                    stroke={COLORS[index]} 
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
