import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, DollarSign, Users, Map, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { tr } from "date-fns/locale";

interface AnalyticsData {
  revenueByMonth: Array<{ month: string; revenue: number; registrations: number }>;
  topDestinations: Array<{ destination: string; count: number; revenue: number }>;
  conversionRate: { conversations: number; registrations: number; rate: number };
  monthlyGrowth: number;
  averageOrderValue: number;
  totalRevenue: number;
}

export const AdvancedAnalytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agency) return;

      // Son 6 aylık gelir analizi
      const sixMonthsAgo = subMonths(new Date(), 6);
      const { data: registrations } = await supabase
        .from("registrations")
        .select(`
          id,
          pax,
          created_at,
          status,
          tours!inner(destination),
          tour_dates!inner(price_adult)
        `)
        .eq("agency_id", agency.id)
        .gte("created_at", sixMonthsAgo.toISOString())
        .in("status", ["CONFIRMED", "NEW", "PENDING"]);

      // Aylık gelir hesaplama
      const revenueByMonth: Record<string, { revenue: number; registrations: number }> = {};
      let totalRevenue = 0;

      registrations?.forEach((reg: any) => {
        const month = format(new Date(reg.created_at), 'MMMM yyyy', { locale: tr });
        const revenue = reg.tour_dates.price_adult * reg.pax;
        totalRevenue += revenue;

        if (!revenueByMonth[month]) {
          revenueByMonth[month] = { revenue: 0, registrations: 0 };
        }
        revenueByMonth[month].revenue += revenue;
        revenueByMonth[month].registrations += 1;
      });

      const revenueArray = Object.entries(revenueByMonth).map(([month, data]) => ({
        month,
        ...data
      }));

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
        .map(([destination, data]) => ({ destination, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Dönüşüm oranı (son 30 gün)
      const thirtyDaysAgo = subMonths(new Date(), 1);
      const { count: conversationCount } = await supabase
        .from("whatsapp_conversations")
        .select("*", { count: 'exact', head: true })
        .eq("agency_id", agency.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      const { count: registrationCount } = await supabase
        .from("registrations")
        .select("*", { count: 'exact', head: true })
        .eq("agency_id", agency.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      const conversionRate = {
        conversations: conversationCount || 0,
        registrations: registrationCount || 0,
        rate: conversationCount ? (registrationCount || 0) / conversationCount : 0
      };

      // Aylık büyüme oranı
      const currentMonth = format(new Date(), 'MMMM yyyy', { locale: tr });
      const lastMonth = format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: tr });
      
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
        totalRevenue
      });
    } catch (error) {
      console.error("Analytics error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20 bg-muted" />
            <CardContent className="h-24 bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) return null;

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
              Son 6 ay
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
              {(analytics.conversionRate.rate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.conversionRate.registrations}/{analytics.conversionRate.conversations} konuşma
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Aylık Gelir Trendi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.revenueByMonth.slice(-6).map((item) => (
                <div key={item.month} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.month}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.registrations} kayıt
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {new Intl.NumberFormat('tr-TR').format(item.revenue)} TL
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ort: {new Intl.NumberFormat('tr-TR').format(Math.round(item.revenue / item.registrations))} TL
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              En Popüler Destinasyonlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topDestinations.map((item, index) => (
                <div key={item.destination} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{item.destination}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} kayıt
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {new Intl.NumberFormat('tr-TR').format(item.revenue)} TL
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
