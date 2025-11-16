import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, DollarSign, Users, MessageSquare, Target, Award, Calendar as CalendarIcon, MapPin, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, subYears, startOfDay, endOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface AnalyticsData {
  revenueByMonth: Array<{ month: string; revenue: number; registrations: number }>;
  topDestinations: Array<{ destination: string; count: number; revenue: number }>;
  conversionRate: { conversations: number; registrations: number; rate: number };
  monthlyGrowth: number;
  averageOrderValue: number;
  totalRevenue: number;
  totalRegistrations: number;
  totalConversations: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

type DateFilterType = '1month' | '3months' | '6months' | '1year' | 'custom';

export const AdvancedAnalytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('6months');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

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

  const loadAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found for analytics');
        return;
      }

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
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

        if (!agency) {
          console.log('No agency found for user');
          return;
        }
        agencyId = agency.id;
      }

      console.log('Loading analytics for agency:', agencyId || 'all (super admin)');

      // Tarih aralığını al
      const { startDate, endDate } = getDateRange();
      console.log('Date range:', startDate, 'to', endDate);
      let registrationsQuery = supabase
        .from("registrations")
        .select(`
          id,
          pax,
          created_at,
          status,
          tours!inner(destination),
          tour_dates!inner(price_adult)
        `)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .in("status", ["CONFIRMED", "NEW", "PENDING"]);

      if (agencyId) {
        registrationsQuery = registrationsQuery.eq("agency_id", agencyId);
      }

      const { data: registrations } = await registrationsQuery;

      console.log('Loaded registrations:', registrations?.length);

      // Aylık gelir hesaplama
      const revenueByMonth: Record<string, { revenue: number; registrations: number }> = {};
      let totalRevenue = 0;

      registrations?.forEach((reg: any) => {
        const month = format(new Date(reg.created_at), 'MMM yyyy', { locale: tr });
        const revenue = reg.tour_dates.price_adult * reg.pax;
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
          registrations: data.registrations
        }))
        .sort((a, b) => {
          const dateA = new Date(a.month);
          const dateB = new Date(b.month);
          return dateA.getTime() - dateB.getTime();
        });

      // Popüler destinasyonlar
      const destinationMap: Record<string, { count: number; revenue: number }> = {};
      registrations?.forEach((reg: any) => {
        const dest = reg.tours.destination;
        const revenue = reg.tour_dates.price_adult * reg.pax;

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
          revenue: Math.round(data.revenue)
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Dönüşüm oranı (seçili tarih aralığı)
      let conversationQuery = supabase
        .from("whatsapp_conversations")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (agencyId) {
        conversationQuery = conversationQuery.eq("agency_id", agencyId);
      }

      const { count: conversationCount } = await conversationQuery;

      let registrationQuery = supabase
        .from("registrations")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (agencyId) {
        registrationQuery = registrationQuery.eq("agency_id", agencyId);
      }

      const { count: registrationCount } = await registrationQuery;

      const conversionRate = {
        conversations: conversationCount || 0,
        registrations: registrationCount || 0,
        rate: conversationCount ? (registrationCount || 0) / conversationCount : 0
      };

      // Aylık büyüme oranı
      const currentMonth = format(new Date(), 'MMM yyyy', { locale: tr });
      const lastMonth = format(subMonths(new Date(), 1), 'MMM yyyy', { locale: tr });
      
      const currentMonthRevenue = revenueByMonth[currentMonth]?.revenue || 0;
      const lastMonthRevenue = revenueByMonth[lastMonth]?.revenue || 0;
      
      const monthlyGrowth = lastMonthRevenue 
        ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;

      // Ortalama sepet değeri
      const averageOrderValue = registrations && registrations.length > 0
        ? totalRevenue / registrations.length
        : 0;

      setAnalytics({
        revenueByMonth: revenueArray,
        topDestinations,
        conversionRate,
        monthlyGrowth,
        averageOrderValue,
        totalRevenue,
        totalRegistrations: registrations?.length || 0,
        totalConversations: conversationCount || 0
      });
    } catch (error) {
      console.error("Analytics error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case '1month': return 'Son 1 Ay';
      case '3months': return 'Son 3 Ay';
      case '6months': return 'Son 6 Ay';
      case '1year': return 'Son 1 Yıl';
      case 'custom':
        if (customDateRange?.from) {
          const fromDate = format(customDateRange.from, 'dd MMM yyyy', { locale: tr });
          const toDate = customDateRange.to 
            ? format(customDateRange.to, 'dd MMM yyyy', { locale: tr })
            : 'Bugün';
          return `${fromDate} - ${toDate}`;
        }
        return 'Özel Tarih';
      default: return 'Son 6 Ay';
    }
  };

  if (isLoading) {
  return (
    <div className="space-y-6">
      {/* Tarih Filtreleme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Tarih Aralığı Filtresi
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
              Son 1 Ay
            </Button>
            <Button
              variant={dateFilter === '3months' ? 'default' : 'outline'}
              onClick={() => {
                setDateFilter('3months');
                setCustomDateRange(undefined);
              }}
              size="sm"
            >
              Son 3 Ay
            </Button>
            <Button
              variant={dateFilter === '6months' ? 'default' : 'outline'}
              onClick={() => {
                setDateFilter('6months');
                setCustomDateRange(undefined);
              }}
              size="sm"
            >
              Son 6 Ay
            </Button>
            <Button
              variant={dateFilter === '1year' ? 'default' : 'outline'}
              onClick={() => {
                setDateFilter('1year');
                setCustomDateRange(undefined);
              }}
              size="sm"
            >
              Son 1 Yıl
            </Button>
            
            {/* Özel Tarih Aralığı */}
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
                    <span>Özel Tarih</span>
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
                  locale={tr}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <p className="text-sm text-muted-foreground mt-4">
            Gösterilen veriler: <span className="font-medium">{getDateFilterLabel()}</span>
          </p>
        </CardContent>
      </Card>

      {/* Özet Kartlar */}
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

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Award className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Henüz analiz verisi yok</p>
          <p className="text-sm text-muted-foreground mt-2">İlk rezervasyonunuz oluştuğunda analitikler burada görünecek</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Gelir</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('tr-TR').format(analytics.totalRevenue)} TL
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.totalRegistrations} kayıt • {getDateFilterLabel()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aylık Büyüme</CardTitle>
            {analytics.monthlyGrowth >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analytics.monthlyGrowth >= 0 ? '+' : ''}{analytics.monthlyGrowth.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Geçen aya göre
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ortalama Sepet</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('tr-TR').format(Math.round(analytics.averageOrderValue))} TL
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Kayıt başına
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dönüşüm Oranı</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.conversionRate.rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.conversionRate.registrations}/{analytics.conversionRate.conversations} konuşma
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aylık Gelir Grafiği */}
      {analytics.revenueByMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aylık Gelir Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => new Intl.NumberFormat('tr-TR').format(value) + ' TL'}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Gelir (TL)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Popüler Destinasyonlar */}
        {analytics.topDestinations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Popüler Destinasyonlar</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.topDestinations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="destination" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => new Intl.NumberFormat('tr-TR').format(value) + ' TL'}
                    labelStyle={{ color: '#000' }}
                  />
                  <Bar dataKey="revenue" fill="#82ca9d" name="Gelir (TL)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Kayıt Sayıları */}
        {analytics.topDestinations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Destinasyon Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.topDestinations}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.destination} (${entry.count})`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.topDestinations.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Destinasyon Detayları */}
      {analytics.topDestinations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Destinasyon Detayları</CardTitle>
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
                      <p className="text-sm text-muted-foreground">{dest.count} kayıt</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{new Intl.NumberFormat('tr-TR').format(dest.revenue)} TL</p>
                    <p className="text-sm text-muted-foreground">
                      Ort: {new Intl.NumberFormat('tr-TR').format(Math.round(dest.revenue / dest.count))} TL
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
