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
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare, TrendingUp, Users } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

export const CustomerFeedback = () => {
  const { t, i18n } = useTranslation();
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

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const loadFeedbacks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get agency ID
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agency) return;

      // Get feedbacks
      const { data, error } = await supabase
        .from("whatsapp_user_profiles")
        .select("*")
        .eq("agency_id", agency.id)
        .not("feedback_score", "is", null)
        .order("last_feedback_sent_at", { ascending: false });

      if (error) throw error;

      setFeedbacks(data || []);
      calculateStats(data || []);
      calculateNPSTrend(data || []);
      calculateScoreDistribution(data || []);
    } catch (error) {
      console.error("Error loading feedbacks:", error);
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
            className={i < score ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
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

  const currentLocale = localeMap[i18n.language as keyof typeof localeMap] || tr;

  return (
    <div className="space-y-6">
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
              {stats.totalResponses > 0 ? Math.round((stats.totalResponses / (stats.totalResponses * 1.5)) * 100) : 0}%
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
                          {feedback.total_spent.toLocaleString()} ₺
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
