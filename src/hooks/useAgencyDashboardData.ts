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
  /**
   * K1: GERÇEK TAHSİLAT — `paid_amount` toplamı (CANCELLED hariç).
   * Acentenin kasaya giren tutar. Vergi/muhasebe için doğru rakam.
   */
  totalRevenue: number;
  /**
   * K1: REZERVASYON HACMİ — `total_amount` snapshot (K3) toplamı (CANCELLED hariç).
   * Acentenin beklediği toplam ciro. Henüz tahsil edilmemiş olabilir.
   */
  bookingVolume: number;
  avgBasket: number;
  confirmedRegistrations: number;
}

export interface ComparisonStats {
  /** K1: önceki dönem tahsilat (paid_amount) */
  previousRevenue: number;
  /** K1: önceki dönem rezervasyon hacmi (total_amount) */
  previousBookingVolume: number;
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
  tours: { title: string; currency?: string };
  tour_dates: { departure_date: string; price_adult: number };
}

export interface PopularTour {
  id: string;
  title: string;
  destination: string;
  registrationCount: number;
}

export interface ChartData { name: string; registrations: number }

/**
 * K1: "Bugünkü" KPI'ı artık iki metrik gösterir.
 * - revenue: bugün TAHSİL EDİLEN (paid_amount; karşılaştırılabilir vergi rakamı).
 * - bookingVolume: bugün REZERVE EDİLEN (total_amount; toplam ciro beklentisi).
 */
export interface TodayStats { registrations: number; revenue: number; bookingVolume: number; pendingCount: number }

export function useAgencyDashboardData(dateRange: DateRange | undefined, agencyId?: string | null) {
  const [stats, setStats] = useState<AgencyStats>({
    totalTours: 0, totalRegistrations: 0, activeDates: 0,
    pendingRegistrations: 0, totalRevenue: 0, bookingVolume: 0, avgBasket: 0, confirmedRegistrations: 0,
  });
  const [comparison, setComparison] = useState<ComparisonStats>({
    previousRevenue: 0, previousBookingVolume: 0,
    previousRegistrations: 0, previousCustomers: 0,
    currentCustomers: 0, currentConversion: 0, previousConversion: 0,
  });
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [popularTours, setPopularTours] = useState<PopularTour[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [revenueSpark, setRevenueSpark] = useState<SparkPoint[]>([]);
  const [regSpark, setRegSpark] = useState<SparkPoint[]>([]);
  const [weekTrend, setWeekTrend] = useState<TrendPoint[]>([]);
  const [monthTrend, setMonthTrend] = useState<TrendPoint[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({ registrations: 0, revenue: 0, bookingVolume: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);
  // O2: Sorgu fail olursa sessiz boş veri yerine kullanıcıya banner gösterilir.
  // Önceden catch sadece console.error atıyordu → acente "rezervasyonum yok" sanıyordu.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [dateRange, agencyId]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);  // O2: yeni yükleme → eski hata temizlenir
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
      // K1 + K3: tahsilat (paid_amount) + rezervasyon hacmi (total_amount snapshot) için ek kolonlar.
      let registrationsQuery = supabase
        .from("registrations")
        .select("id, status, created_at, tour_dates(price_adult), pax, phone, paid_amount, total_amount", { count: "exact" });
      let datesQuery = supabase.from("tour_dates").select("id, departure_date", { count: "exact" });

      if (agencyId) {
        toursQuery = toursQuery.eq("agency_id", agencyId) as typeof toursQuery;
        registrationsQuery = registrationsQuery.eq("agency_id", agencyId);
        datesQuery = (datesQuery as any).eq("agency_id", agencyId);
      }

      if (startDate) {
        registrationsQuery = registrationsQuery.gte("created_at", startDate);
        datesQuery = datesQuery.gte("departure_date", startDate);
      }
      if (endDate) {
        registrationsQuery = registrationsQuery.lte("created_at", endDate);
        datesQuery = datesQuery.lte("departure_date", endDate);
      }

      // ── Comparison 7-day window (only when no custom date range) ─────────────
      // K1: paid_amount + total_amount eklendi (önceki dönem tahsilat + hacim hesabı için)
      let prevQuery = supabase
        .from("registrations")
        .select("id, status, created_at, tour_dates(price_adult), pax, phone, paid_amount, total_amount")
        .gte("created_at", twoWeeksAgo)
        .lt("created_at", weekAgo);
      if (agencyId) prevQuery = prevQuery.eq("agency_id", agencyId);

      // ── Today stats ──────────────────────────────────────────────────────────
      // K1: paid_amount + total_amount — bugünkü tahsilat ve hacim ayrı KPI'lar olarak
      let todayQuery = supabase
        .from("registrations")
        .select("id, status, tour_dates(price_adult), pax, paid_amount, total_amount")
        .gte("created_at", todayStart);
      if (agencyId) todayQuery = todayQuery.eq("agency_id", agencyId);

      const [toursResult, registrationsResult, datesResult, prevResult, todayResult] = await Promise.all([
        toursQuery, registrationsQuery, datesQuery, prevQuery, todayQuery,
      ]);

      // ── Main stats ────────────────────────────────────────────────────────────
      const pendingCount = registrationsResult.data?.filter(
        (r) => r.status === "NEW" || r.status === "PENDING"
      ).length || 0;

      const confirmedRegs = registrationsResult.data?.filter((r) => r.status === "CONFIRMED") || [];
      // K1: GERÇEK TAHSİLAT — paid_amount toplamı (CANCELLED hariç tüm aktif statüler).
      // Acentenin kasaya giren tutar. Vergi/muhasebe için doğru rakam.
      const _activeRegs = registrationsResult.data?.filter((r) => r.status !== "CANCELLED") || [];
      const totalRevenue = _activeRegs.reduce((sum, r: any) => {
        return sum + (Number(r.paid_amount) || 0);
      }, 0);
      // K1: REZERVASYON HACMİ — total_amount snapshot (K3). Yoksa price_adult × pax fallback.
      // Aktif rezervasyonlar (CANCELLED hariç). "Beklenen ciro" — henüz tahsil edilmemiş olabilir.
      const bookingVolume = _activeRegs.reduce((sum, r: any) => {
        const _snap = Number(r.total_amount) || 0;
        if (_snap > 0) return sum + _snap;
        return sum + ((r.tour_dates?.price_adult || 0) * (r.pax || 1));
      }, 0);
      // avgBasket — sepet ortalaması rezervasyon hacmi üzerinden (önce de potansiyel ciroya bakıyordu)
      const avgBasket = _activeRegs.length > 0 ? bookingVolume / _activeRegs.length : 0;

      setStats({
        totalTours: toursResult.count || 0,
        totalRegistrations: registrationsResult.count || 0,
        activeDates: datesResult.count || 0,
        pendingRegistrations: pendingCount,
        totalRevenue,
        bookingVolume,
        avgBasket,
        confirmedRegistrations: confirmedRegs.length,
      });

      // ── Comparison stats (last 7 days vs 7 days before) ──────────────────────
      const prevData = prevResult.data || [];
      const prevActive = prevData.filter((r) => r.status !== "CANCELLED");
      const prevConfirmed = prevData.filter((r) => r.status === "CONFIRMED");
      // K1: önceki dönem tahsilat = paid_amount (gerçek kasaya giren)
      const previousRevenue = prevActive.reduce((s, r: any) => s + (Number(r.paid_amount) || 0), 0);
      // K1: önceki dönem rezervasyon hacmi = total_amount snapshot (varsa) | fallback
      const previousBookingVolume = prevActive.reduce((s, r: any) => {
        const _snap = Number(r.total_amount) || 0;
        if (_snap > 0) return s + _snap;
        return s + ((r.tour_dates?.price_adult || 0) * (r.pax || 1));
      }, 0);
      const previousRegistrations = prevData.length;
      const previousCustomers = new Set(prevData.map((r) => r.phone)).size;

      // Current 7-day window (not filtered by date range)
      const currentWeekData = registrationsResult.data?.filter(
        (r) => !dateRange && new Date(r.created_at) >= new Date(weekAgo)
      ) ?? registrationsResult.data ?? [];
      const currentCustomers = new Set(currentWeekData.map((r) => r.phone)).size;

      setComparison({
        previousRevenue,
        previousBookingVolume,
        previousRegistrations,
        previousCustomers,
        currentCustomers,
        currentConversion: confirmedRegs.length,
        previousConversion: prevConfirmed.length,
      });

      // ── Today stats ───────────────────────────────────────────────────────────
      const todayData = todayResult.data || [];
      const _todayActive = todayData.filter((r) => r.status !== "CANCELLED");
      // K1: bugün TAHSİL edilen — paid_amount (gerçek kasaya giren)
      const todayRevenue = _todayActive.reduce((s, r: any) => s + (Number(r.paid_amount) || 0), 0);
      // K1: bugün REZERVE edilen — total_amount snapshot (yoksa fallback)
      const todayBookingVolume = _todayActive.reduce((s, r: any) => {
        const _snap = Number(r.total_amount) || 0;
        if (_snap > 0) return s + _snap;
        return s + ((r.tour_dates?.price_adult || 0) * (r.pax || 1));
      }, 0);
      const todayPending = todayData.filter((r) => r.status === "NEW" || r.status === "PENDING").length;
      setTodayStats({
        registrations: _todayActive.length,
        revenue: todayRevenue,
        bookingVolume: todayBookingVolume,
        pendingCount: todayPending,
      });

      // ── Sparklines (daily, last 7 days) ──────────────────────────────────────
      // K1: trend grafiklerinde "rezervasyon hacmi" — snapshot varsa onu, yoksa fallback
      let last7 = supabase
        .from("registrations")
        .select("created_at, status, tour_dates(price_adult), pax, total_amount")
        .gte("created_at", weekAgo)
        .neq("status", "CANCELLED");
      if (agencyId) last7 = last7.eq("agency_id", agencyId);

      const { data: sparkRaw } = await last7;

      const sparkByDay = (sparkRaw || []).reduce<Record<string, { rev: number; reg: number }>>(
        (acc, r: any) => {
          const key = format(new Date(r.created_at), "dd MMM", { locale: tr });
          if (!acc[key]) acc[key] = { rev: 0, reg: 0 };
          const _snap = Number(r.total_amount) || 0;
          const _amt = _snap > 0 ? _snap : (r.tour_dates?.price_adult || 0) * (r.pax || 1);
          acc[key].rev += _amt;
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
        // K1: trendlerde rezervasyon hacmi (snapshot varsa onu, yoksa fallback)
        const prevRev = prev.filter((r) => r.status !== "CANCELLED").reduce((s, r: any) => {
          const _snap = Number(r.total_amount) || 0;
          return s + (_snap > 0 ? _snap : (r.tour_dates?.price_adult || 0) * (r.pax || 1));
        }, 0);
        trend7.push({ date: key, current: sparkByDay[key]?.rev || 0, previous: prevRev });
      }
      setWeekTrend(trend7);

      // Month trend (last 30 days daily)
      let month30Query = supabase
        .from("registrations")
        .select("created_at, status, tour_dates(price_adult), pax, total_amount")
        .gte("created_at", subDays(now, 60).toISOString())
        .neq("status", "CANCELLED");
      if (agencyId) month30Query = month30Query.eq("agency_id", agencyId);
      const { data: month30Raw } = await month30Query;

      const m30ByDay = (month30Raw || []).reduce<Record<string, number>>((acc, r: any) => {
        const key = format(new Date(r.created_at), "dd MMM", { locale: tr });
        const _snap = Number(r.total_amount) || 0;
        const _amt = _snap > 0 ? _snap : (r.tour_dates?.price_adult || 0) * (r.pax || 1);
        acc[key] = (acc[key] || 0) + _amt;
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
        .select("id, full_name, phone, pax, status, created_at, tours(title, currency), tour_dates(departure_date, price_adult)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (agencyId) recentQuery = recentQuery.eq("agency_id", agencyId);
      if (startDate) recentQuery = recentQuery.gte("created_at", startDate);
      if (endDate) recentQuery = recentQuery.lte("created_at", endDate);
      const { data: recentData } = await recentQuery;
      setRecentRegistrations((recentData as any[]) || []);

      // ── Popular tours ─────────────────────────────────────────────────────────
      // O6: GELECEK tur tarihlerine kayıt yapanları say. Önceden geçmiş turlar
      // "popüler" diye listeleniyordu (acente "bu turu tekrar açayım mı?" diye karıştırıyordu).
      // tour_dates join + departure_date >= today filtresi.
      const _todayIso = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
      let popularQuery = supabase
        .from("registrations")
        .select("tour_id, created_at, tours(id, title, destination), tour_dates!inner(departure_date)")
        .gte("tour_dates.departure_date", _todayIso)
        .neq("status", "CANCELLED");
      if (agencyId) popularQuery = popularQuery.eq("agency_id", agencyId);
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
    } catch (err: any) {
      // O2: catch artık sessiz değil — error state set ediliyor, UI banner gösteriyor.
      console.error("Dashboard data error:", err);
      const _msg = err?.message
        || (typeof err === "string" ? err : "")
        || "unknown";
      setError(_msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    stats, comparison, recentRegistrations, popularTours,
    chartData, revenueSpark, regSpark, weekTrend, monthTrend, todayStats, loading,
    error,            // O2: dashboard banner için
    reload: loadDashboardData,  // O2: "Tekrar dene" butonu için
  };
}
