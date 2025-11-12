import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, Users, Plane, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Stats {
  totalTours: number;
  totalRegistrations: number;
  activeDates: number;
  pendingRegistrations: number;
}

interface RecentRegistration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  created_at: string;
  tours: {
    title: string;
  };
  tour_dates: {
    departure_date: string;
  };
}

interface PopularTour {
  id: string;
  title: string;
  destination: string;
  registrationCount: number;
}

interface ChartData {
  name: string;
  kayitlar: number;
}

const statusLabels: Record<string, string> = {
  NEW: "Yeni",
  PENDING: "Beklemede",
  CONFIRMED: "Onaylandı",
  CANCELLED: "İptal"
};

export const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalTours: 0,
    totalRegistrations: 0,
    activeDates: 0,
    pendingRegistrations: 0
  });
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [popularTours, setPopularTours] = useState<PopularTour[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Get statistics
      const [toursResult, registrationsResult, datesResult] = await Promise.all([
        supabase.from("tours").select("id", { count: "exact", head: true }),
        supabase.from("registrations").select("id, status", { count: "exact" }),
        supabase.from("tour_dates").select("id", { count: "exact", head: true })
      ]);

      const pendingCount = registrationsResult.data?.filter(
        (r) => r.status === "NEW" || r.status === "PENDING"
      ).length || 0;

      setStats({
        totalTours: toursResult.count || 0,
        totalRegistrations: registrationsResult.count || 0,
        activeDates: datesResult.count || 0,
        pendingRegistrations: pendingCount
      });

      // Get recent registrations
      const { data: recentData } = await supabase
        .from("registrations")
        .select(`
          id,
          full_name,
          phone,
          pax,
          status,
          created_at,
          tours (title),
          tour_dates (departure_date)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentRegistrations(recentData || []);

      // Get popular tours
      const { data: popularData } = await supabase
        .from("registrations")
        .select(`
          tour_id,
          tours (id, title, destination)
        `);

      const tourCounts = popularData?.reduce((acc: Record<string, any>, reg: any) => {
        const tourId = reg.tours.id;
        if (!acc[tourId]) {
          acc[tourId] = {
            id: tourId,
            title: reg.tours.title,
            destination: reg.tours.destination,
            registrationCount: 0
          };
        }
        acc[tourId].registrationCount++;
        return acc;
      }, {});

      const sortedTours = Object.values(tourCounts || {})
        .sort((a: any, b: any) => b.registrationCount - a.registrationCount)
        .slice(0, 5);

      setPopularTours(sortedTours as PopularTour[]);

      // Get chart data (last 7 days)
      const { data: chartDataRaw } = await supabase
        .from("registrations")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const dailyCounts = chartDataRaw?.reduce((acc: Record<string, number>, reg) => {
        const date = format(new Date(reg.created_at), "dd MMM", { locale: tr });
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const formattedChartData: ChartData[] = Object.entries(dailyCounts || {}).map(([name, kayitlar]) => ({
        name,
        kayitlar: kayitlar as number
      }));

      setChartData(formattedChartData);
    } catch (error) {
      console.error("Dashboard data error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Turlar</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTours}</div>
            <p className="text-xs text-muted-foreground">Aktif tur sayısı</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Kayıtlar</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRegistrations}</div>
            <p className="text-xs text-muted-foreground">Tüm kayıtlar</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Tarihler</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeDates}</div>
            <p className="text-xs text-muted-foreground">Tur tarihleri</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen Kayıtlar</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRegistrations}</div>
            <p className="text-xs text-muted-foreground">İnceleme bekliyor</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Son 7 Gün - Kayıtlar</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="kayitlar" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Registrations */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Son Kayıtlar</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Tur</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRegistrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Henüz kayıt yok
                    </TableCell>
                  </TableRow>
                ) : (
                  recentRegistrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">{reg.full_name}</TableCell>
                      <TableCell className="text-sm">{reg.tours?.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            reg.status === "CONFIRMED"
                              ? "default"
                              : reg.status === "CANCELLED"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {statusLabels[reg.status] || reg.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Popular Tours */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Popüler Turlar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {popularTours.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  Henüz veri yok
                </div>
              ) : (
                popularTours.map((tour) => (
                  <div key={tour.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{tour.title}</p>
                      <p className="text-sm text-muted-foreground">{tour.destination}</p>
                    </div>
                    <Badge variant="secondary">{tour.registrationCount} kayıt</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
