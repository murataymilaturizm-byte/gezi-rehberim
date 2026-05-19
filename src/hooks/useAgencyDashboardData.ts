import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import { DateRange } from "react-day-picker";

export interface AgencyStats {
  totalTours: number;
  totalRegistrations: number;
  activeDates: number;
  pendingRegistrations: number;
  totalRevenue: number;
  avgBasket: number;
  confirmedRegistrations: number;
}

export interface ComparisonStats {
  previousRevenue: number;
  previousRegistrations: number;
  previousCustomers: number;
  currentCustomers: number;
  currentConversion: number;
  previousConversion: number;
}

export interface SparkPoint { date: string; value: number }

export interface TrendPoint { date: string; current: number; previous: number }

export interface RecentRegistration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  created_at: string;
  tours: { title: string };
  tour_dates: { departure_date: string; price_adult: number };
}

export interface PopularTour {
  id: string;
  title: string;
  destination: string;
  registrationCount: number;
}

export interface ChartData { name: string; registrations: number }

export interface TodayStats { registrations: number; revenue: number; pendingCount: number }

export function useAgencyDashboardData(dateRange: DateRange | undefined) {
  const [stats, setStats] = useState<AgencyStats>({
    totalTours: 0, totalRegistrations: 0, activeDates: 0,
    pendingRegistrations: 0, totalRevenue: 0, avgBasket: 0, confirmedRegistrations: 0,
  });
  const [comparison, setComparison] = useState<ComparisonStats>({
    previousRevenue: 0, previousRegistrations: 0, previousCustomers: 0,
    currentCustomers: 0, currentConversion: 0, previousConversion: 0,
  });
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [popularTours, setPopularTours] = useState<PopularTour[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [revenueSpark, setRevenueSpark] = useState<SparkPoint[]>([]);
  const [regSpark, setRegSpark] = useState<SparkPoint[]>([]);
  const [weekTrend, setWeekTrend] = useState<TrendPoint[]>([]);
  const [monthTrend, setMonthTrend] = useState<TrendPoint[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({ registrations: 0, revenue: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const startDate = dateRange?.from?.toISOString();
      const endDate = dateRange?.to?.toISOString();

      // Current 7-day window for comparison
      const now = new Date();
      const weekAgo = subDays(now, 7).toISOString();
      const twoWeeksAgo = subDays(now, 14).toISOString();
      const todayStart = startOfDay(now).toISOString();

      // ── Main queries ─────────────────────────────────────────────────────────

      let toursQuery = supabase.from("tours").select("id", { count: "exact", head: true });
      let registrationsQuery = supabase
        .from("registrations")
        .select("id, status, created_at, tour_dates(price_adult), pax, phone", { count: "exact" });
      let datesQuery = supabase.from("tour_dates").select("id, departure_date", { count: "exact" });

      if (startDate) {
        registrationsQuery = registrationsQuery.gte("created_at", startDate);
        datesQuery = datesQuery.gte("departure_date", startDate);
      }
      if (endDate) {
        registrationsQuery = registrationsQuery.lte("created_at", endDate);
        datesQuery = datesQuery.lte("departure_date", endDate);
      }

      // ── Comparison 7-day window (only when no custom date range) ─────────────
      const prevQuery = supabase
        .from("registrations")
        .select("id, status, created_at, tour_dates(price_adult), pax, phone")
        .gte("created_at", twoWeeksAgo)
        .lt("created_at", weekAgo);

      // ── Today stats ──────────────────────────────────────────────────────────
      const todayQuery = supabase
        .from("registrations")
        .select("id, status, tour_dates(price_adult), pax")
        .gte("created_at", todayStart);

      const [toursResult, registrationsResult, datesResult, prevResult, todayResult] = await Promise.all([
        toursQuery, registrationsQuery, datesQuery, prevQuery, todayQuery,
      ]);

      // ── Main stats ────────────────────────────────────────────────────────────
      const pendingCount = registrationsResult.data?.filter(
        (r) => r.status === "NEW" || r.status === "PENDING"
      ).length || 0;

      const confirmedRegs = registrationsResult.data?.filter((r) => r.status === "CONFIRMED") || [];
      const totalRevenue = confirmedRegs.reduce((sum, r: any) => {
        return sum + ((r.tour_dates?.price_adult || 0) * (r.pax || 1));
      }, 0);
      const avgBasket = confirmedRegs.length > 0 ? totalRevenue / confirmedRegs.length : 0;

      setStats({
        totalTours: toursResult.count || 0,
        totalRegistrations: registrationsResult.count || 0,
        activeDates: datesResult.count || 0,
        pendingRegistrations: pendingCount,
        totalRevenue,
        avgBasket,
        confirmedRegistrations: confirmedRegs.length,
      });

      // ── Comparison stats (last 7 days vs 7 days before) ──────────────────────
      const prevData = prevResult.data || [];
      const prevConfirmed = prevData.filter((r) => r.status === "CONFIRMED");
      const previousRevenue = prevConfirmed.reduce((s, r: any) => s + ((r.tour_dates?.price_adult || 0) * (r.pax || 1)), 0);
      const previousRegistrations = prevData.length;
      const previousCustomers = new Set(prevData.map((r) => r.phone)).size;

      // Current 7-day window (not filtered by date range)
      const currentWeekData = registrationsResult.data?.filter(
        (r) => !dateRange && new Date(r.created_at) >= new Date(weekAgo)
      ) ?? registrationsResult.data ?? [];
      const currentCustomers = new Set(currentWeekData.map((r) => r.phone)).size;

      setComparison({
        previousRevenue,
        previousRegistrations,
        previousCustomers,
        currentCustomers,
        currentConversion: confirmedRegs.length,
        previousConversion: prevConfirmed.length,
      });

      // ── Today stats ───────────────────────────────────────────────────────────
      const todayData = todayResult.data || [];
      const todayRevenue = todayData
        .filter((r) => r.status !== "CANCELLED")
        .reduce((s, r: any) => s + ((r.tour_dates?.price_adult || 0) * (r.pax || 1)), 0);
      const todayPending = todayData.filter((r) => r.status === "NEW" || r.status === "PENDING").length;
      setTodayStats({
        registrations: todayData.filter((r) => r.status !== "CANCELLED").length,
        revenue: todayRevenue,
        pendingCount: todayPending,
      });

      // ── Sparklines (daily, last 7 days) ──────────────────────────────────────
      const last7 = supabase
        .from("registrations")
        .select("created_at, status, tour_dates(price_adult), pax")
        .gte("created_at", weekAgo)
        .neq("status", "CANCELLED");

      const { data: sparkRaw } = await last7;

      const sparkByDay = (sparkRaw || []).reduce<Record<string, { rev: number; reg: number }>>(
        (acc, r: any) => {
          const key = format(new Date(r.created_at), "dd MMM", { locale: tr });
          if (!acc[key]) acc[key] = { rev: 0, reg: 0 };
          acc[key].rev += (r.tour_dates?.price_adult || 0) * (r.pax || 1);
          acc[key].reg += 1;
          return acc;
        },
        {}
      );

      // Fill last 7 days with 0 if no data
      const days7: SparkPoint[] = [];
      const rDays7: SparkPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(now, i);
        const key = format(d, "dd MMM", { locale: tr });
        days7.push({ date: key, value: sparkByDay[key]?.rev || 0 });
        rDays7.push({ date: key, value: sparkByDay[key]?.reg || 0 });
      }
      setRevenueSpark(days7);
      setRegSpark(rDays7);

      // ── Trend (week vs previous week) ─────────────────────────────────────────
      const trend7: TrendPoint[] = [];
      const trend30: TrendPoint[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = subDays(now, i);
        const key = format(d, "dd MMM", { locale: tr });
        const prevKey = format(subDays(d, 7), "dd MMM", { locale: tr });
        const prev = prevData.filter((r) => format(new Date(r.created_at), "dd MMM", { locale: tr }) === prevKey);
        const prevRev = prev.filter((r) => r.status !== "CANCELLED").reduce((s, r: any) => s + ((r.tour_dates?.price_adult || 0) * (r.pax || 1)), 0);
        trend7.push({ date: key, current: sparkByDay[key]?.rev || 0, previous: prevRev });
      }
      setWeekTrend(trend7);

      // Month trend (last 30 days daily)
      const { data: month30Raw } = await supabase
        .from("registrations")
        .select("created_at, status, tour_dates(price_adult), pax")
        .gte("created_at", subDays(now, 60).toISOString())
        .neq("status", "CANCELLED");

      const m30ByDay = (month30Raw || []).reduce<Record<string, number>>((acc, r: any) => {
        const key = format(new Date(r.created_at), "dd MMM", { locale: tr });
        acc[key] = (acc[key] || 0) + ((r.tour_dates?.price_adult || 0) * (r.pax || 1));
        return acc;
      }, {});

      for (let i = 29; i >= 0; i--) {
        const d = subDays(now, i);
        const key = format(d, "dd MMM", { locale: tr });
        const prevKey = format(subDays(d, 30), "dd MMM", { locale: tr });
        trend30.push({ date: key, current: m30ByDay[key] || 0, previous: m30ByDay[prevKey] || 0 });
      }
      setMonthTrend(trend30);

      // ── Recent registrations ──────────────────────────────────────────────────
      let recentQuery = supabase
        .from("registrations")
        .select("id, full_name, phone, pax, status, created_at, tours(title), tour_dates(departure_date, price_adult)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (startDate) recentQuery = recentQuery.gte("created_at", startDate);
      if (endDate) recentQuery = recentQuery.lte("created_at", endDate);
      const { data: recentData } = await recentQuery;
      setRecentRegistrations((recentData as any[]) || []);

      // ── Popular tours ─────────────────────────────────────────────────────────
      let popularQuery = supabase
        .from("registrations")
        .select("tour_id, created_at, tours(id, title, destination)");
      if (startDate) popularQuery = popularQuery.gte("created_at", startDate);
      if (endDate) popularQuery = popularQuery.lte("created_at", endDate);
      const { data: popularData } = await popularQuery;

      const tourCounts = (popularData || []).reduce<Record<string, any>>((acc, reg: any) => {
        const tourId = reg.tours?.id;
        if (!tourId) return acc;
        if (!acc[tourId]) {
          acc[tourId] = { id: tourId, title: reg.tours.title, destination: reg.tours.destination, registrationCount: 0 };
        }
        acc[tourId].registrationCount++;
        return acc;
      }, {});
      setPopularTours(
        Object.values(tourCounts).sort((a: any, b: any) => b.registrationCount - a.registrationCount).slice(0, 5) as PopularTour[]
      );

      // ── Chart data (legacy) ───────────────────────────────────────────────────
      setChartData(rDays7.map((d) => ({ name: d.date, registrations: d.value })));
    } catch (error) {
      console.error("Dashboard data error:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    stats, comparison, recentRegistrations, popularTours,
    chartData, revenueSpark, regSpark, weekTrend, monthTrend, todayStats, loading,
  };
}
