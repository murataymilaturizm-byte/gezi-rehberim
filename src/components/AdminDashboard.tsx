import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Calendar as CalendarIcon, Users, Plane, TrendingUp, X, Building2, MessageSquare, CheckCircle, XCircle, Filter, MapPin } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { UsageStats } from "@/components/UsageStats";
import { RevenueAnalytics } from "@/components/RevenueAnalytics";

interface Stats {
  totalTours: number;
  totalRegistrations: number;
  activeDates: number;
  pendingRegistrations: number;
  totalRevenue?: number;
  avgBasket?: number;
  confirmedRegistrations?: number;
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
  registrations: number;
}

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
  geographicData: { location: string; count: number }[];
}

interface RevenueChartData {
  month: string;
  revenue: number;
  newAgencies: number;
}

interface AdminDashboardProps {
  isSuperAdmin?: boolean;
}

export const AdminDashboard = ({ isSuperAdmin = false }: AdminDashboardProps) => {
  const { t } = useTranslation();
  
  const statusLabels: Record<string, string> = {
    NEW: t("admin.status.new"),
    PENDING: t("admin.status.pending"),
    CONFIRMED: t("admin.status.confirmed"),
    CANCELLED: t("admin.status.cancelled")
  };
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [stats, setStats] = useState<Stats>({
    totalTours: 0,
    totalRegistrations: 0,
    activeDates: 0,
    pendingRegistrations: 0,
    totalRevenue: 0,
    avgBasket: 0,
    confirmedRegistrations: 0
  });
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [popularTours, setPopularTours] = useState<PopularTour[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [superAdminStats, setSuperAdminStats] = useState<SuperAdminStats | null>(null);
  const [revenueChartData, setRevenueChartData] = useState<RevenueChartData[]>([]);
  const [chartMonths, setChartMonths] = useState<number>(12);
  const [selectedPlans, setSelectedPlans] = useState<string[]>(["starter", "professional", "enterprise"]);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      loadSuperAdminStats();
    } else {
      loadDashboardData();
    }
  }, [dateRange, isSuperAdmin]);

  // Reload chart when filters change
  useEffect(() => {
    if (isSuperAdmin && superAdminStats) {
      loadRevenueTrendWithFilters();
    }
  }, [chartMonths, selectedPlans]);

  const loadSuperAdminStats = async () => {
    setLoading(true);
    try {
      // Get all agencies
      const { data: agencies, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, active, subscription_status, plan_type, monthly_message_count, created_at, city, region');

      if (agenciesError) throw agenciesError;

      const totalAgencies = agencies?.length || 0;
      const activeAgencies = agencies?.filter(a => a.active).length || 0;
      const inactiveAgencies = totalAgencies - activeAgencies;
      const trialAgencies = agencies?.filter(a => a.subscription_status === 'trial').length || 0;
      const totalMessagesUsed = agencies?.reduce((sum, a) => sum + (a.monthly_message_count || 0), 0) || 0;

      // Sadece aktif ve ücretli acenteleri say (trial hariç)
      const paidAgencies = agencies?.filter(a => a.active && a.subscription_status === 'active') || [];
      
      const agenciesByPlan = {
        starter: paidAgencies.filter(a => a.plan_type === 'starter').length || 0,
        professional: paidAgencies.filter(a => a.plan_type === 'professional').length || 0,
        enterprise: paidAgencies.filter(a => a.plan_type === 'enterprise').length || 0,
      };

      // Calculate geographic distribution
      const cityDistribution = agencies?.reduce((acc: { [key: string]: number }, agency: any) => {
        const location = agency.city || agency.region || t("admin.dashboard.unspecified");
        acc[location] = (acc[location] || 0) + 1;
        return acc;
      }, {}) || {};

      const geographicData = Object.entries(cityDistribution)
        .map(([location, count]) => ({
          location,
          count: count as number,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 locations

      setSuperAdminStats({
        totalAgencies,
        activeAgencies,
        inactiveAgencies,
        trialAgencies,
        totalMessagesUsed,
        agenciesByPlan,
        geographicData,
      });

      // Load revenue trend data
      await loadRevenueTrendWithFilters();
    } catch (error) {
      console.error('Super admin stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRevenueTrendWithFilters = async () => {
    try {
      // Get all agencies with filters
      const { data: agencies, error } = await supabase
        .from('agencies')
        .select('id, active, subscription_status, plan_type, monthly_message_count, created_at')
        .in('plan_type', selectedPlans.length > 0 ? selectedPlans : ['starter', 'professional', 'enterprise']);

      if (error) throw error;
      await loadRevenueTrend(agencies || []);
    } catch (error) {
      console.error('Error loading filtered data:', error);
    }
  };

  const loadRevenueTrend = async (agencies: any[]) => {
    try {
      const planPrices = {
        starter: 2999,
        professional: 7999,
        enterprise: 14999,
      };

      // Generate months based on selected range
      const months: RevenueChartData[] = [];
      for (let i = chartMonths - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthLabel = format(monthDate, 'MMM yy', { locale: tr });

        // Count new agencies added in this month (filtered by selected plans)
        const newAgenciesInMonth = agencies.filter(a => {
          const createdDate = new Date(a.created_at);
          return createdDate >= monthStart && createdDate <= monthEnd;
        }).length;

        // Get payment transactions for this month
        let transactionQuery = supabase
          .from('payment_transactions')
          .select('amount, status, plan_type')
          .eq('status', 'success')
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString());

        // Filter by selected plans
        if (selectedPlans.length > 0) {
          transactionQuery = transactionQuery.in('plan_type', selectedPlans);
        }

        const { data: transactions } = await transactionQuery;

        // Calculate revenue from successful transactions
        const monthRevenue = transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

        months.push({
          month: monthLabel,
          revenue: monthRevenue,
          newAgencies: newAgenciesInMonth,
        });
      }

      setRevenueChartData(months);
    } catch (error) {
      console.error('Error loading revenue trend:', error);
    }
  };

  const handlePlanToggle = (plan: string) => {
    setSelectedPlans(prev => 
      prev.includes(plan) 
        ? prev.filter(p => p !== plan)
        : [...prev, plan]
    );
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Determine date filter
      const startDate = dateRange?.from ? dateRange.from.toISOString() : undefined;
      const endDate = dateRange?.to ? dateRange.to.toISOString() : undefined;

      // Get statistics
      let toursQuery = supabase.from("tours").select("id", { count: "exact", head: true });
      let registrationsQuery = supabase.from("registrations").select("id, status, created_at, tour_dates(price_adult), pax", { count: "exact" });
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

      // Calculate revenue metrics
      const confirmedRegistrations = registrationsResult.data?.filter(r => r.status === "CONFIRMED") || [];
      const totalRevenue = confirmedRegistrations.reduce((sum, r: any) => {
        const price = r.tour_dates?.price_adult || 0;
        return sum + (price * (r.pax || 1));
      }, 0);

      const avgBasket = confirmedRegistrations.length > 0 
        ? totalRevenue / confirmedRegistrations.length 
        : 0;

      setStats({
        totalTours: toursResult.count || 0,
        totalRegistrations: registrationsResult.count || 0,
        activeDates: datesResult.count || 0,
        pendingRegistrations: pendingCount,
        totalRevenue,
        avgBasket,
        confirmedRegistrations: confirmedRegistrations.length
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

      const formattedChartData: ChartData[] = Object.entries(dailyCounts || {}).map(([name, registrations]) => ({
        name,
        registrations: registrations as number
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
      <div className="text-center py-8 text-muted-foreground">{t("admin.loading")}</div>
    );
  }

  // Super Admin Dashboard
  if (isSuperAdmin && superAdminStats) {
    // Plan fiyatları (aylık)
    const planPrices = {
      starter: 2999,
      professional: 7999,
      enterprise: 14999,
    };

    // Aylık gelir hesaplama (sadece aktif ve ücretli acenteler)
    const monthlyRevenue = 
      (superAdminStats.agenciesByPlan.starter * planPrices.starter) +
      (superAdminStats.agenciesByPlan.professional * planPrices.professional) +
      (superAdminStats.agenciesByPlan.enterprise * planPrices.enterprise);

    // Yıllık gelir tahmini
    const yearlyRevenue = monthlyRevenue * 12;

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
              <CardTitle className="text-sm font-medium">{t("admin.dashboard.activeRate")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                %{superAdminStats.totalAgencies > 0 
                  ? Math.round((superAdminStats.activeAgencies / superAdminStats.totalAgencies) * 100)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.dashboard.activeAgencyRate")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plan Distribution */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{t("admin.dashboard.starterPlan")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">
                {superAdminStats.agenciesByPlan.starter}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {superAdminStats.agenciesByPlan.starter} × 2.999₺ = {(superAdminStats.agenciesByPlan.starter * planPrices.starter).toLocaleString('tr-TR')}₺/{t("admin.dashboard.month")}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{t("admin.dashboard.professionalPlan")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-500">
                {superAdminStats.agenciesByPlan.professional}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {superAdminStats.agenciesByPlan.professional} × 7.999₺ = {(superAdminStats.agenciesByPlan.professional * planPrices.professional).toLocaleString('tr-TR')}₺/{t("admin.dashboard.month")}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{t("admin.dashboard.enterprisePlan")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-500">
                {superAdminStats.agenciesByPlan.enterprise}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {superAdminStats.agenciesByPlan.enterprise} × 14.999₺ = {(superAdminStats.agenciesByPlan.enterprise * planPrices.enterprise).toLocaleString('tr-TR')}₺/{t("admin.dashboard.month")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <TrendingUp className="w-5 h-5" />
                {t("admin.dashboard.monthlyRevenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                {monthlyRevenue.toLocaleString('tr-TR')}₺
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {t("admin.dashboard.activeSubscriptionsOnly")}
              </p>
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("admin.dashboard.trialAgenciesLabel")}</span>
                  <Badge variant="secondary">{superAdminStats.trialAgencies} {t("admin.dashboard.agency")}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <TrendingUp className="w-5 h-5" />
                Yıllık Gelir (Tahmin)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {yearlyRevenue.toLocaleString('tr-TR')}₺
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Mevcut ücretli aboneliklerin yıllık değeri
              </p>
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ortalama acente değeri:</span>
                  <span className="font-medium">
                    {((superAdminStats.agenciesByPlan.starter + superAdminStats.agenciesByPlan.professional + superAdminStats.agenciesByPlan.enterprise) > 0
                      ? Math.round(monthlyRevenue / (superAdminStats.agenciesByPlan.starter + superAdminStats.agenciesByPlan.professional + superAdminStats.agenciesByPlan.enterprise))
                      : 0
                    ).toLocaleString('tr-TR')}₺/ay
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Real Revenue Analytics - Based on actual payment transactions */}
        <RevenueAnalytics />

        {/* Revenue Trend Chart */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Gelir ve Büyüme Trendi</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerçek ödeme verilerine dayalı analiz
                </p>
              </div>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Filter className="w-4 h-4" />
                      Filtreler
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-3">Tarih Aralığı</h4>
                        <Select
                          value={chartMonths.toString()}
                          onValueChange={(value) => setChartMonths(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">Son 3 Ay</SelectItem>
                            <SelectItem value="6">Son 6 Ay</SelectItem>
                            <SelectItem value="12">Son 12 Ay</SelectItem>
                            <SelectItem value="24">Son 24 Ay</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3">Plan Tipleri</h4>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="starter"
                              checked={selectedPlans.includes("starter")}
                              onCheckedChange={() => handlePlanToggle("starter")}
                            />
                            <label htmlFor="starter" className="text-sm cursor-pointer">
                              Başlangıç (2.999₺/ay)
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="professional"
                              checked={selectedPlans.includes("professional")}
                              onCheckedChange={() => handlePlanToggle("professional")}
                            />
                            <label htmlFor="professional" className="text-sm cursor-pointer">
                              Profesyonel (7.999₺/ay)
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="enterprise"
                              checked={selectedPlans.includes("enterprise")}
                              onCheckedChange={() => handlePlanToggle("enterprise")}
                            />
                            <label htmlFor="enterprise" className="text-sm cursor-pointer">
                              Kurumsal (14.999₺/ay)
                            </label>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="comparison"
                            checked={showComparison}
                            onCheckedChange={(checked) => setShowComparison(!!checked)}
                          />
                          <label htmlFor="comparison" className="text-sm cursor-pointer">
                            Önceki dönem ile karşılaştır
                          </label>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  yAxisId="left"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K₺`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    if (name === 'Gelir') {
                      return [`${Number(value).toLocaleString('tr-TR')}₺`, name];
                    }
                    return [value, name];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Gelir"
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="newAgencies" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  name="Yeni Acenteler"
                  dot={{ fill: 'hsl(142, 76%, 36%)' }}
                />
              </LineChart>
            </ResponsiveContainer>
            
            {selectedPlans.length > 0 && selectedPlans.length < 3 && (
              <div className="mt-4 p-3 bg-accent/30 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Aktif Filtre:</strong> Sadece {selectedPlans.map(p => {
                    const labels: Record<string, string> = {
                      starter: "Başlangıç",
                      professional: "Profesyonel",
                      enterprise: "Kurumsal"
                    };
                    return labels[p];
                  }).join(", ")} planları gösteriliyor
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Geographic Distribution Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Acente Coğrafi Dağılımı</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Acentelerin illere ve bölgelere göre dağılımı (En çok 10 lokasyon)
            </p>
          </CardHeader>
          <CardContent>
            {superAdminStats.geographicData.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={superAdminStats.geographicData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="location" 
                      className="text-xs"
                      angle={-45}
                      textAnchor="end"
                      height={120}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))"
                      radius={[8, 8, 0, 0]}
                      name="Acente Sayısı"
                    />
                  </BarChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-border">
                  {superAdminStats.geographicData.slice(0, 5).map((item, index) => (
                    <div key={item.location} className="text-center">
                      <div className="text-2xl font-bold text-primary">#{index + 1}</div>
                      <div className="text-sm font-medium">{item.location}</div>
                      <div className="text-xs text-muted-foreground">{item.count} acente</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-medium mb-2">Konum Bilgisi Bulunamadı</h4>
                <p className="text-sm text-muted-foreground max-w-md">
                  Henüz hiçbir acentenin konum bilgisi girilmemiş. Acentelere şehir ve bölge bilgisi 
                  eklendiğinde coğrafi dağılım burada görüntülenecek.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Message */}
        <Card className="shadow-card bg-accent/30 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{t("admin.superAdmin")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("admin.dashboard.superAdminDescription")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal Admin Dashboard
  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.totalRevenue")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.totalRevenue || 0).toLocaleString('tr-TR')}₺
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.confirmedReservations")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.avgBasket")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.avgBasket || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}₺
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.avgPerBooking")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.conversionRate")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              %{stats.totalRegistrations > 0 
                ? ((stats.confirmedRegistrations || 0) / stats.totalRegistrations * 100).toFixed(1)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.confirmedRegistrations || 0} / {stats.totalRegistrations} {t("admin.dashboard.registrations")}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.totalTours")}</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTours}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.activeTourCount")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.totalRegistrations")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRegistrations}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.allRegistrations")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.activeDates")}</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeDates}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.tourDates")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.pendingRegistrations")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRegistrations}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.awaitingReview")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "d MMM", { locale: tr })} - ${format(dateRange.to, "d MMM", { locale: tr })} ${t("admin.dashboard.registrationsTitle")}`
                : t("admin.dashboard.last7Days")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="registrations" fill="hsl(var(--primary))" name={t("admin.dashboard.chartRegistrations")} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Popular Destinations & Recent Registrations Side by Side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Popular Destinations */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t("admin.dashboard.popularDestinations")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {popularTours.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t("admin.dashboard.noData")}
                </div>
              ) : (
                popularTours.map((tour) => (
                  <div key={tour.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{tour.title}</p>
                      <p className="text-sm text-muted-foreground">{tour.destination}</p>
                    </div>
                    <Badge variant="secondary">{tour.registrationCount} {t("admin.dashboard.registration")}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Registrations with Date Filter */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t("admin.dashboard.recentRegistrations")}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 text-xs",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM", { locale: tr })} - {format(dateRange.to, "dd/MM", { locale: tr })}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yy", { locale: tr })
                        )
                      ) : (
                        <span>{t("admin.dashboard.filter")}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50 bg-popover" align="end">
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
                    className="h-8 w-8 p-0"
                    onClick={clearDateRange}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRegistrations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t("admin.registrations.noRegistrations")}
                </div>
              ) : (
                recentRegistrations.map((reg) => (
                  <div key={reg.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{reg.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{reg.tours?.title}</p>
                    </div>
                    <Badge
                      className="ml-2 shrink-0"
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
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Usage Stats - At Bottom */}
      <UsageStats />
    </div>
  );
};
