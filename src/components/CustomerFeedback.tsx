import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare, TrendingUp, Users, Calendar as CalendarIcon, Filter } from "lucide-react";
import { format, startOfMonth, subMonths, subYears, startOfDay, endOfDay } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

type DateFilterType = '1month' | '3months' | '6months' | '1year' | 'custom';

interface FeedbackData {
  id: string;
  phone: string;
  full_name: string | null;
  feedback_score: number | null;
  feedback_comment: string | null;
  last_feedback_sent_at: string | null;
  total_bookings: number;
  total_spent: number;
  language_preference: string;
}

interface FeedbackStats {
  totalResponses: number;
  averageScore: number;
  promoters: number;
  detractors: number;
  nps: number;
}

interface NPSTrendData {
  month: string;
  nps: number;
  responses: number;
}

interface ScoreDistributionData {
  score: string;
  count: number;
  percentage: number;
}

const localeMap = {
  tr: tr,
  en: enUS,
  de: de,
  ru: ru,
  ar: ar,
  fr: fr,
  es: es,
};

interface CustomerFeedbackProps {
  isSuperAdmin?: boolean;
}

export const CustomerFeedback = ({ isSuperAdmin = false }: CustomerFeedbackProps = {}) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({
    totalResponses: 0,
    averageScore: 0,
    promoters: 0,
    detractors: 0,
    nps: 0,
  });
  const [npsTrend, setNpsTrend] = useState<NPSTrendData[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<ScoreDistributionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('6months');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [agencyCurrency, setAgencyCurrency] = useState<string>("TRY");

  // Super admin: acente seçimi (K1 fix)
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");

  const CURRENCY_SYM: Record<string, string> = {
    TRY: "₺", USD: "$", EUR: "€", GBP: "£", SAR: "﷼", AED: "د.إ", RUB: "₽",
  };
  const currencySym = CURRENCY_SYM[agencyCurrency] ?? agencyCurrency;

  // Super admin için acente listesini yükle
  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase
      .from("agencies")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        const list = (data || []) as { id: string; name: string }[];
        setAgencies(list);
        if (list.length > 0 && !selectedAgencyId) setSelectedAgencyId(list[0].id);
      });
  }, [isSuperAdmin]);

  useEffect(() => {
    // Normal acente: kendi verisi (agency by user_id). Super admin: seçili acente.
    if (isSuperAdmin && !selectedAgencyId) return;
    loadFeedbacks();
  }, [dateFilter, customDateRange, selectedAgencyId, isSuperAdmin]);

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

  const loadFeedbacks = async () => {
    try {
      // K1: Super admin → selectedAgencyId üzerinden acente sorgula
      //     Normal acente → user_id ile kendi acentesi
      let agencyId: string;
      let primaryCurrency: string | null = null;

      if (isSuperAdmin) {
        if (!selectedAgencyId) return;
        agencyId = selectedAgencyId;
        const { data: agency } = await supabase
          .from("agencies")
          .select("primary_currency")
          .eq("id", selectedAgencyId)
          .maybeSingle();
        primaryCurrency = agency?.primary_currency ?? null;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: agency } = await supabase
          .from("agencies")
          .select("id, primary_currency")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!agency) return;
        agencyId = agency.id;
        primaryCurrency = agency.primary_currency ?? null;
      }

      if (primaryCurrency) setAgencyCurrency(primaryCurrency);

      // Get date range
      const { startDate, endDate } = getDateRange();

      // Get feedbacks within date range
      const { data, error } = await supabase
        .from("whatsapp_user_profiles")
        .select("*")
        .eq("agency_id", agencyId)
        .not("feedback_score", "is", null)
        .gte('last_feedback_sent_at', startDate.toISOString())
        .lte('last_feedback_sent_at', endDate.toISOString())
        .order("last_feedback_sent_at", { ascending: false });

      if (error) throw error;

      setFeedbacks(data || []);
      calculateStats(data || []);
      calculateNPSTrend(data || []);
      calculateScoreDistribution(data || []);
    } catch (error) {
      console.error("Error loading feedbacks:", error);
      toast({ title: t("common.error"), description: t("common.loadError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: FeedbackData[]) => {
    const totalResponses = data.length;
    if (totalResponses === 0) {
      setStats({
        totalResponses: 0,
        averageScore: 0,
        promoters: 0,
        detractors: 0,
        nps: 0,
      });
      return;
    }

    const scores = data.map(f => f.feedback_score || 0);
    const averageScore = scores.reduce((a, b) => a + b, 0) / totalResponses;
    
    const promoters = scores.filter(s => s >= 9).length;
    const detractors = scores.filter(s => s <= 6).length;
    const nps = ((promoters - detractors) / totalResponses) * 100;

    setStats({
      totalResponses,
      averageScore: Math.round(averageScore * 10) / 10,
      promoters,
      detractors,
      nps: Math.round(nps),
    });
  };

  const calculateNPSTrend = (data: FeedbackData[]) => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return startOfMonth(date);
    });

    const trendData = last6Months.map(month => {
      const monthFeedbacks = data.filter(f => {
        if (!f.last_feedback_sent_at) return false;
        const feedbackDate = new Date(f.last_feedback_sent_at);
        return (
          feedbackDate.getMonth() === month.getMonth() &&
          feedbackDate.getFullYear() === month.getFullYear()
        );
      });

      const totalResponses = monthFeedbacks.length;
      if (totalResponses === 0) {
        return {
          month: format(month, "MMM yy", { locale: localeMap[i18n.language as keyof typeof localeMap] || tr }),
          nps: 0,
          responses: 0,
        };
      }

      const scores = monthFeedbacks.map(f => f.feedback_score || 0);
      const promoters = scores.filter(s => s >= 9).length;
      const detractors = scores.filter(s => s <= 6).length;
      const nps = ((promoters - detractors) / totalResponses) * 100;

      return {
        month: format(month, "MMM yy", { locale: localeMap[i18n.language as keyof typeof localeMap] || tr }),
        nps: Math.round(nps),
        responses: totalResponses,
      };
    });

    setNpsTrend(trendData);
  };

  const calculateScoreDistribution = (data: FeedbackData[]) => {
    const distribution = Array.from({ length: 11 }, (_, i) => ({
      score: i.toString(),
      count: 0,
      percentage: 0,
    }));

    data.forEach(feedback => {
      if (feedback.feedback_score !== null) {
        distribution[feedback.feedback_score].count++;
      }
    });

    const total = data.length;
    distribution.forEach(item => {
      item.percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
    });

    setScoreDistribution(distribution.filter(item => item.count > 0));
  };

  const getScoreBadge = (score: number) => {
    if (score >= 9) return <Badge className="bg-green-500">{t("feedback.promoter")}</Badge>;
    if (score >= 7) return <Badge className="bg-yellow-500">{t("feedback.passive")}</Badge>;
    return <Badge className="bg-red-500">{t("feedback.detractor")}</Badge>;
  };

  const renderStars = (score: number) => {
    return (
      <div className="flex gap-1">
        {[...Array(10)].map((_, i) => (
          <Star
            key={i}
            size={16}
            className={i < score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!loading && stats.totalResponses === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Star className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">{t("customerFeedback.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("customerFeedback.emptyDesc")}</p>
        </div>
      </div>
    );
  }

  const currentLocale = localeMap[i18n.language as keyof typeof localeMap] || tr;

  return (
    <div className="space-y-6">
      {/* Super admin: acente seçimi */}
      {isSuperAdmin && agencies.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t("admin.dashboard.activeAgencies")}
              </CardTitle>
              <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Tarih Filtreleme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t("customerFeedback.dateFilter")}
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("feedback.totalResponses")}
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalResponses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("feedback.averageScore")}
            </CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}/10</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("feedback.npsScore")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.nps}</div>
            <p className="text-xs text-muted-foreground">
              {stats.promoters} {t("feedback.promoters")} / {stats.detractors} {t("feedback.detractors")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("feedback.responseRate")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalResponses}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* NPS Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("feedback.npsTrend")}</CardTitle>
          </CardHeader>
          <CardContent>
            {npsTrend.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("feedback.noTrendData")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={npsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis domain={[-100, 100]} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="nps"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name={t("feedback.npsScore")}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Score Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("feedback.scoreDistribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreDistribution.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("feedback.noDistributionData")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="score" label={{ value: t("feedback.score"), position: "insideBottom", offset: -5 }} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "count") return [value, t("feedback.responses")];
                      return [value + "%", t("feedback.percentage")];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    name={t("feedback.responses")}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feedbacks Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("feedback.customerFeedback")}</CardTitle>
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("feedback.noFeedbacks")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("feedback.customer")}</TableHead>
                  <TableHead>{t("feedback.score")}</TableHead>
                  <TableHead>{t("feedback.category")}</TableHead>
                  <TableHead>{t("feedback.comment")}</TableHead>
                  <TableHead>{t("feedback.bookings")}</TableHead>
                  <TableHead>{t("feedback.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbacks.map((feedback) => (
                  <TableRow key={feedback.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{feedback.full_name || feedback.phone}</div>
                        <div className="text-sm text-muted-foreground">{feedback.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {feedback.feedback_score && renderStars(feedback.feedback_score)}
                      <div className="text-sm mt-1">{feedback.feedback_score}/10</div>
                    </TableCell>
                    <TableCell>
                      {feedback.feedback_score && getScoreBadge(feedback.feedback_score)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {feedback.feedback_comment || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{feedback.total_bookings} {t("feedback.tours")}</div>
                        <div className="text-muted-foreground">
                          {feedback.total_spent.toLocaleString()} {currencySym}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {feedback.last_feedback_sent_at
                        ? format(new Date(feedback.last_feedback_sent_at), "PPp", { locale: currentLocale })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
