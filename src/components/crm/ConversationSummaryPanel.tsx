// ConversationSummaryPanel — whatsapp_conversation_summaries tablosundaki
// AI özetlerini görselleştirir. Backend hazırdı, UI hiç bağlanmamıştı —
// TUR 2'de ortaya çıkardık.
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smile, Meh, Frown, MessageSquare, MapPin, Hash, FileText } from "lucide-react";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";

export interface ConversationSummary {
  id: string;
  summary: string;
  topics: string[] | null;
  mentioned_tours: string[] | null;
  sentiment: string | null;
  conversation_date: string;
  message_count: number | null;
  created_at: string;
}

const DATE_LOCALES = { tr, en: enUS, de, ru, ar, fr, es } as const;

interface SentimentStyle {
  Icon: typeof Smile;
  bg: string;
  text: string;
  border: string;
  i18nKey: string;
}

const SENTIMENT_STYLES: Record<string, SentimentStyle> = {
  positive: {
    Icon: Smile,
    bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/40",
    i18nKey: "admin.whatsapp.userProfiles.summary.sentiment.positive",
  },
  neutral: {
    Icon: Meh,
    bg: "bg-muted/60",
    text: "text-muted-foreground",
    border: "border-border",
    i18nKey: "admin.whatsapp.userProfiles.summary.sentiment.neutral",
  },
  negative: {
    Icon: Frown,
    bg: "bg-rose-500/15 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/40",
    i18nKey: "admin.whatsapp.userProfiles.summary.sentiment.negative",
  },
};

interface Props {
  summaries: ConversationSummary[];
  loading: boolean;
  language: string;
}

export const ConversationSummaryPanel = ({ summaries, loading, language }: Props) => {
  const { t } = useTranslation();
  const locale = DATE_LOCALES[language as keyof typeof DATE_LOCALES] ?? tr;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 animate-pulse" />
          <p className="text-sm">{t("admin.whatsapp.userProfiles.summary.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  if (summaries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("admin.whatsapp.userProfiles.summary.empty")}</p>
          <p className="text-xs mt-1 opacity-75">
            {t("admin.whatsapp.userProfiles.summary.emptyHint", {
              defaultValue: "AI özetleri konuşma bittikten sonra otomatik üretilir.",
            })}
          </p>
        </CardContent>
      </Card>
    );
  }

  // En son özet en üstte (sentiment+topics özet kartı), altında günlük listesi
  const sorted = [...summaries].sort(
    (a, b) =>
      new Date(b.conversation_date).getTime() - new Date(a.conversation_date).getTime()
  );

  // Genel sentiment: en sık görülen
  const sentimentCounts = summaries.reduce<Record<string, number>>((acc, s) => {
    const key = (s.sentiment || "neutral").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const dominantSentiment =
    Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
  const dominantStyle = SENTIMENT_STYLES[dominantSentiment] || SENTIMENT_STYLES.neutral;
  const DominantIcon = dominantStyle.Icon;

  // Tüm konuları/turları topla (en sık görülen 8)
  const allTopics = new Map<string, number>();
  const allTours = new Map<string, number>();
  for (const s of summaries) {
    for (const topic of s.topics || []) {
      allTopics.set(topic, (allTopics.get(topic) || 0) + 1);
    }
    for (const tour of s.mentioned_tours || []) {
      allTours.set(tour, (allTours.get(tour) || 0) + 1);
    }
  }
  const topTopics = Array.from(allTopics.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
  const topTours = Array.from(allTours.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);

  const totalMessages = summaries.reduce((sum, s) => sum + (s.message_count || 0), 0);

  return (
    <div className="space-y-4">
      {/* Genel sentiment + meta kartı */}
      <Card className={`border ${dominantStyle.border}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex w-12 h-12 rounded-full items-center justify-center ${dominantStyle.bg} ${dominantStyle.text}`}
              >
                <DominantIcon className="w-6 h-6" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {t("admin.whatsapp.userProfiles.summary.dominantSentiment")}
                </p>
                <p className={`text-lg font-bold ${dominantStyle.text}`}>
                  {t(dominantStyle.i18nKey)}
                </p>
              </div>
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">
                {t("admin.whatsapp.userProfiles.summary.totalDays")}
              </p>
              <p className="text-2xl font-bold tabular-nums">{summaries.length}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {totalMessages} {t("admin.whatsapp.userProfiles.summary.messages")}
              </p>
            </div>
          </div>

          {/* Konular */}
          {topTopics.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {t("admin.whatsapp.userProfiles.summary.topics")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topTopics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="bg-primary/10 text-primary border-primary/30"
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bahsedilen turlar */}
          {topTours.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {t("admin.whatsapp.userProfiles.summary.mentionedTours")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topTours.map((tour) => (
                  <Badge
                    key={tour}
                    variant="outline"
                    className="border-yellow-500/40 text-yellow-700 dark:text-yellow-300 bg-yellow-500/10"
                  >
                    {tour}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Günlük özetler */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t("admin.whatsapp.userProfiles.summary.dailyBreakdown")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 relative ms-2">
            {/* Vertical timeline line */}
            <div
              aria-hidden="true"
              className="absolute start-2 top-0 bottom-0 w-px bg-border"
            />
            {sorted.map((s) => {
              const senKey = (s.sentiment || "neutral").toLowerCase();
              const senStyle = SENTIMENT_STYLES[senKey] || SENTIMENT_STYLES.neutral;
              const SenIcon = senStyle.Icon;
              return (
                <li key={s.id} className="relative ps-8">
                  <span
                    className={`absolute start-0 top-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-card ${senStyle.bg}`}
                  >
                    <SenIcon className={`w-2.5 h-2.5 ${senStyle.text}`} />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground">
                      {format(new Date(s.conversation_date), "d MMM yyyy", { locale })}
                    </p>
                    <span className="text-[10px] text-muted-foreground tabular-nums inline-flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {s.message_count || 0}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap mb-2">
                    {s.summary}
                  </p>
                  {(s.topics?.length || 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.topics!.slice(0, 6).map((topic, idx) => (
                        <span
                          key={`${s.id}-topic-${idx}`}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground"
                        >
                          #{topic}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};
