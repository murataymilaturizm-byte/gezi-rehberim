import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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

export interface RecentRegistration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  created_at: string;
  tours: { title: string };
  tour_dates: { departure_date: string };
}

export interface PopularTour {
  id: string;
  title: string;
  destination: string;
  registrationCount: number;
}

export interface ChartData {
  name: string;
  registrations: number;
}

export function useAgencyDashboardData(dateRange: DateRange | undefined) {
  const [stats, setStats] = useState<AgencyStats>({
    totalTours: 0, totalRegistrations: 0, activeDates: 0,
    pendingRegistrations: 0, totalRevenue: 0, avgBasket: 0, confirmedRegistrations: 0,
  });
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [popularTours, setPopularTours] = useState<PopularTour[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const startDate = dateRange?.from?.toISOString();
      const endDate = dateRange?.to?.toISOString();

      let toursQuery = supabase.from("tours").select("id", { count: "exact", head: true });
      let registrationsQuery = supabase.from("registrations").select("id, status, created_at, tour_dates(price_adult), pax", { count: "exact" });
      let datesQuery = supabase.from("tour_dates").select("id, departure_date", { count: "exact" });

      if (startDate) {
        registrationsQuery = registrationsQuery.gte("created_at", startDate);
        datesQuery = datesQuery.gte("departure_date", startDate);
      }
      if (endDate) {
        registrationsQuery = registrationsQuery.lte("created_at", endDate);
        datesQuery = datesQuery.lte("departure_date", endDate);
      }

      const [toursResult, registrationsResult, datesResult] = await Promise.all([
        toursQuery, registrationsQuery, datesQuery,
      ]);

      const pendingCount = registrationsResult.data?.filter(
        (r) => r.status === "NEW" || r.status === "PENDING"
      ).length || 0;

      const confirmedRegistrations = registrationsResult.data?.filter(r => r.status === "CONFIRMED") || [];
      const totalRevenue = confirmedRegistrations.reduce((sum, r: any) => {
        const price = r.tour_dates?.price_adult || 0;
        return sum + (price * (r.pax || 1));
      }, 0);
      const avgBasket = confirmedRegistrations.length > 0 ? totalRevenue / confirmedRegistrations.length : 0;

      setStats({
        totalTours: toursResult.count || 0,
        totalRegistrations: registrationsResult.count || 0,
        activeDates: datesResult.count || 0,
        pendingRegistrations: pendingCount,
        totalRevenue, avgBasket,
        confirmedRegistrations: confirmedRegistrations.length,
      });

      // Recent registrations
      let recentQuery = supabase
        .from("registrations")
        .select("id, full_name, phone, pax, status, created_at, tours (title), tour_dates (departure_date)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (startDate) recentQuery = recentQuery.gte("created_at", startDate);
      if (endDate) recentQuery = recentQuery.lte("created_at", endDate);
      const { data: recentData } = await recentQuery;
      setRecentRegistrations(recentData || []);

      // Popular tours
      let popularQuery = supabase.from("registrations").select("tour_id, created_at, tours (id, title, destination)");
      if (startDate) popularQuery = popularQuery.gte("created_at", startDate);
      if (endDate) popularQuery = popularQuery.lte("created_at", endDate);
      const { data: popularData } = await popularQuery;

      const tourCounts = popularData?.reduce((acc: Record<string, any>, reg: any) => {
        const tourId = reg.tours.id;
        if (!acc[tourId]) {
          acc[tourId] = { id: tourId, title: reg.tours.title, destination: reg.tours.destination, registrationCount: 0 };
        }
        acc[tourId].registrationCount++;
        return acc;
      }, {});
      setPopularTours(
        Object.values(tourCounts || {}).sort((a: any, b: any) => b.registrationCount - a.registrationCount).slice(0, 5) as PopularTour[]
      );

      // Chart data
      let chartQuery = supabase.from("registrations").select("created_at");
      if (startDate) {
        chartQuery = chartQuery.gte("created_at", startDate);
      } else {
        chartQuery = chartQuery.gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      }
      if (endDate) chartQuery = chartQuery.lte("created_at", endDate);
      const { data: chartDataRaw } = await chartQuery;

      const dailyCounts = chartDataRaw?.reduce((acc: Record<string, number>, reg) => {
        const date = format(new Date(reg.created_at), "dd MMM", { locale: tr });
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});
      setChartData(Object.entries(dailyCounts || {}).map(([name, registrations]) => ({ name, registrations: registrations as number })));
    } catch (error) {
      console.error("Dashboard data error:", error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, recentRegistrations, popularTours, chartData, loading };
}
