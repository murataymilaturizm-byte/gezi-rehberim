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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar as CalendarIcon, Users, Plane, TrendingUp, X, Building2, MessageSquare, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { UsageStats } from "@/components/UsageStats";

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

interface SuperAdminStats {
  totalAgencies: number;
  activeAgencies: number;
  inactiveAgencies: number;
  trialAgencies: number;
  totalMessagesUsed: number;
  agenciesByPlan: {
    starter: number;
    professional: number;
    enterprise: number;
  };
}

interface AdminDashboardProps {
  isSuperAdmin?: boolean;
}

export const AdminDashboard = ({ isSuperAdmin = false }: AdminDashboardProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
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
  const [superAdminStats, setSuperAdminStats] = useState<SuperAdminStats | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      loadSuperAdminStats();
    } else {
      loadDashboardData();
    }
  }, [dateRange, isSuperAdmin]);

  const loadSuperAdminStats = async () => {
    setLoading(true);
    try {
      // Get all agencies
      const { data: agencies, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, active, subscription_status, plan_type, monthly_message_count');

      if (agenciesError) throw agenciesError;

      const totalAgencies = agencies?.length || 0;
      const activeAgencies = agencies?.filter(a => a.active).length || 0;
      const inactiveAgencies = totalAgencies - activeAgencies;
      const trialAgencies = agencies?.filter(a => a.subscription_status === 'trial').length || 0;
      const totalMessagesUsed = agencies?.reduce((sum, a) => sum + (a.monthly_message_count || 0), 0) || 0;

      const agenciesByPlan = {
        starter: agencies?.filter(a => a.plan_type === 'starter').length || 0,
        professional: agencies?.filter(a => a.plan_type === 'professional').length || 0,
        enterprise: agencies?.filter(a => a.plan_type === 'enterprise').length || 0,
      };

      setSuperAdminStats({
        totalAgencies,
        activeAgencies,
        inactiveAgencies,
        trialAgencies,
        totalMessagesUsed,
        agenciesByPlan,
      });
    } catch (error) {
      console.error('Super admin stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Determine date filter
      const startDate = dateRange?.from ? dateRange.from.toISOString() : undefined;
      const endDate = dateRange?.to ? dateRange.to.toISOString() : undefined;

      // Get statistics
      let toursQuery = supabase.from("tours").select("id", { count: "exact", head: true });
      let registrationsQuery = supabase.from("registrations").select("id, status, created_at", { count: "exact" });
      let datesQuery = supabase.from("tour_dates").select("id, departure_date", { count: "exact" });

      // Apply date filters
      if (startDate) {
        registrationsQuery = registrationsQuery.gte("created_at", startDate);
        datesQuery = datesQuery.gte("departure_date", startDate);
      }
      if (endDate) {
        registrationsQuery = registrationsQuery.lte("created_at", endDate);
        datesQuery = datesQuery.lte("departure_date", endDate);
      }

      const [toursResult, registrationsResult, datesResult] = await Promise.all([
        toursQuery,
        registrationsQuery,
        datesQuery
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
      let recentQuery = supabase
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

      if (startDate) recentQuery = recentQuery.gte("created_at", startDate);
      if (endDate) recentQuery = recentQuery.lte("created_at", endDate);

      const { data: recentData } = await recentQuery;

      setRecentRegistrations(recentData || []);

      // Get popular tours
      let popularQuery = supabase
        .from("registrations")
        .select(`
          tour_id,
          created_at,
          tours (id, title, destination)
        `);

      if (startDate) popularQuery = popularQuery.gte("created_at", startDate);
      if (endDate) popularQuery = popularQuery.lte("created_at", endDate);

      const { data: popularData } = await popularQuery;

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

      // Get chart data
      let chartQuery = supabase
        .from("registrations")
        .select("created_at");

      if (startDate) {
        chartQuery = chartQuery.gte("created_at", startDate);
      } else {
        // Default to last 7 days if no start date
        chartQuery = chartQuery.gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      }
      
      if (endDate) chartQuery = chartQuery.lte("created_at", endDate);

      const { data: chartDataRaw } = await chartQuery;

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

  const clearDateRange = () => {
    setDateRange(undefined);
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
    );
  }

  // Super Admin Dashboard
  if (isSuperAdmin && superAdminStats) {
    return (
      <div className="space-y-6">
        {/* Super Admin Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Acenteler</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{superAdminStats.totalAgencies}</div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  {superAdminStats.activeAgencies} aktif
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-500" />
                  {superAdminStats.inactiveAgencies} pasif
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deneme Sürümü</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{superAdminStats.trialAgencies}</div>
              <p className="text-xs text-muted-foreground">
                Deneme sürecindeki acenteler
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Mesaj</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {superAdminStats.totalMessagesUsed.toLocaleString('tr-TR')}
              </div>
              <p className="text-xs text-muted-foreground">
                Bu ay kullanılan mesaj
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktif Oran</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                %{superAdminStats.totalAgencies > 0 
                  ? Math.round((superAdminStats.activeAgencies / superAdminStats.totalAgencies) * 100)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Aktif acente oranı
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plan Distribution */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Başlangıç Planı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">
                {superAdminStats.agenciesByPlan.starter}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                500 mesaj/ay
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Profesyonel Planı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-500">
                {superAdminStats.agenciesByPlan.professional}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                2.000 mesaj/ay
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Kurumsal Planı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-500">
                {superAdminStats.agenciesByPlan.enterprise}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Sınırsız mesaj
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info Message */}
        <Card className="shadow-card bg-accent/30 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Super Admin Dashboard</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tüm acentelerin genel durumunu ve kullanım istatistiklerini buradan takip edebilirsiniz.
                  Detaylı yönetim için "Acenteler" sekmesini kullanın.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Usage Stats */}
      <UsageStats />
      
      {/* Date Range Filter */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "d MMM yyyy", { locale: tr })} -{" "}
                        {format(dateRange.to, "d MMM yyyy", { locale: tr })}
                      </>
                    ) : (
                      format(dateRange.from, "d MMM yyyy", { locale: tr })
                    )
                  ) : (
                    <span>Tarih aralığı seç</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            {dateRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateRange}
              >
                <X className="h-4 w-4 mr-2" />
                Temizle
              </Button>
            )}
            
            <p className="text-sm text-muted-foreground ml-auto">
              {dateRange?.from && dateRange?.to
                ? "Seçilen dönem verileri gösteriliyor"
                : "Tüm veriler gösteriliyor"}
            </p>
          </div>
        </CardContent>
      </Card>

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
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
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
          <CardTitle>
            {dateRange?.from && dateRange?.to
              ? `${format(dateRange.from, "d MMM", { locale: tr })} - ${format(dateRange.to, "d MMM", { locale: tr })} Kayıtları`
              : "Son 7 Gün - Kayıtlar"}
          </CardTitle>
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
