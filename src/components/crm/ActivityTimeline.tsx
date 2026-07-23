// ActivityTimeline — müşterinin kronolojik aktivite akışı.
// Mevcut tabloları client-side birleştirir; yeni event tablosu GEREKMEZ.
//   • Mesajlar: whatsapp_conversations (role != 'system')
//   • Rezervasyonlar: registrations (phone match)
//   • Anket gönderimi: whatsapp_user_profiles.last_feedback_sent_at
//   • Feedback: whatsapp_user_profiles.{feedback_score, feedback_comment}
//     (Geliş anı bilinmiyor — last_feedback_sent_at ≤ olduğu varsayılır;
//      conservative: en son anket gönderiminden sonra göster.)
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageSquare,
  ShoppingBag,
  Send,
  Star,
  Activity as ActivityIcon,
  Bot,
  User as UserIcon,
} from "lucide-react";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";

const DATE_LOCALES = { tr, en: enUS, de, ru, ar, fr, es } as const;

export interface TimelineMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface TimelineRegistration {
  id: string;
  full_name: string;
  pax: number;
  status: string;
  tour_name?: string | null;
  created_at: string;
}

interface Props {
  messages: TimelineMessage[];
  registrations: TimelineRegistration[];
  lastFeedbackSentAt: string | null;
  feedbackScore: number | null;
  feedbackComment: string | null;
  language: string;
}

type EventType = "message" | "registration" | "feedback_sent" | "feedback_received";

interface TimelineEvent {
  id: string;
  type: EventType;
  at: string;
  payload: TimelineMessage | TimelineRegistration | { score: number | null; comment: string | null };
}

const TYPE_STYLE: Record<EventType, { Icon: typeof MessageSquare; bg: string; text: string; ring: string }> = {
  message: {
    Icon: MessageSquare,
    bg: "bg-primary/10",
    text: "text-primary",
    ring: "ring-primary/30",
  },
  registration: {
    Icon: ShoppingBag,
    bg: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/30",
  },
  feedback_sent: {
    Icon: Send,
    bg: "bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-300",
    ring: "ring-blue-500/30",
  },
  feedback_received: {
    Icon: Star,
    bg: "bg-yellow-500/15",
    text: "text-yellow-700 dark:text-yellow-300",
    ring: "ring-yellow-500/30",
  },
};

export const ActivityTimeline = ({
  messages,
  registrations,
  lastFeedbackSentAt,
  feedbackScore,
  feedbackComment,
  language,
}: Props) => {
  const { t } = useTranslation();
  const locale = DATE_LOCALES[language as keyof typeof DATE_LOCALES] ?? tr;

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    // Mesajlar — çok yoğunsa son N tane göster (timeline UI'da sıkışmasın)
    const recentMessages = [...messages]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
    for (const m of recentMessages) {
      list.push({ id: `msg-${m.id}`, type: "message", at: m.created_at, payload: m });
    }

    // Rezervasyonlar — hepsini göster
    for (const r of registrations) {
      list.push({ id: `reg-${r.id}`, type: "registration", at: r.created_at, payload: r });
    }

    // Anket gönderim olayı
    if (lastFeedbackSentAt) {
      list.push({
        id: `fb-sent-${lastFeedbackSentAt}`,
        type: "feedback_sent",
        at: lastFeedbackSentAt,
        payload: { score: null, comment: null },
      });
    }

    // Feedback geldi (score veya comment varsa)
    if ((feedbackScore !== null && feedbackScore !== undefined) || feedbackComment) {
      const at = lastFeedbackSentAt || new Date().toISOString();
      list.push({
        id: `fb-recv`,
        type: "feedback_received",
        at,
        payload: { score: feedbackScore, comment: feedbackComment },
      });
    }

    // Kronolojik (yeni → eski)
    list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return list;
  }, [messages, registrations, lastFeedbackSentAt, feedbackScore, feedbackComment]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ActivityIcon className="w-4 h-4" />
          {t("admin.whatsapp.userProfiles.activity.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {t("admin.whatsapp.userProfiles.activity.description", {
            defaultValue: "Mesajlar, rezervasyonlar ve anket olayları — tek kronolojik akış.",
          })}
        </p>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ActivityIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t("admin.whatsapp.userProfiles.activity.empty")}</p>
          </div>
        ) : (
          <ol className="relative ms-2 space-y-3">
            <div
              aria-hidden="true"
              className="absolute start-3.5 top-0 bottom-0 w-px bg-border"
            />
            {events.map((e) => {
              const style = TYPE_STYLE[e.type];
              const Icon = style.Icon;
              return (
                <li key={e.id} className="relative ps-10">
                  <span
                    className={`absolute start-0 top-0 w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-card ${style.bg} ${style.text}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-foreground">
                      {t(`admin.whatsapp.userProfiles.activity.events.${e.type}`)}
                    </p>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {format(new Date(e.at), "d MMM yyyy, HH:mm", { locale })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.type === "message" && (() => {
                      const m = e.payload as TimelineMessage;
                      const isUser = m.role === "user";
                      return (
                        <div className="flex items-start gap-1.5">
                          {isUser ? (
                            <UserIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Bot className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          )}
                          <span className="line-clamp-2 italic">"{m.content}"</span>
                        </div>
                      );
                    })()}
                    {e.type === "registration" && (() => {
                      const r = e.payload as TimelineRegistration;
                      return (
                        <span>
                          {r.tour_name && <strong className="text-foreground">{r.tour_name}</strong>}
                          {r.tour_name && " · "}
                          {r.pax} {t("admin.whatsapp.userProfiles.activity.pax")} ·{" "}
                          <span className="uppercase text-[10px] font-semibold">{r.status}</span>
                        </span>
                      );
                    })()}
                    {e.type === "feedback_sent" && (
                      <span>{t("admin.whatsapp.userProfiles.activity.feedbackSentDesc")}</span>
                    )}
                    {e.type === "feedback_received" && (() => {
                      const fb = e.payload as { score: number | null; comment: string | null };
                      return (
                        <div>
                          {fb.score !== null && (
                            <span className="font-semibold text-yellow-700 dark:text-yellow-300">
                              {fb.score}/5
                            </span>
                          )}
                          {fb.comment && <p className="mt-0.5 italic">"{fb.comment}"</p>}
                        </div>
                      );
                    })()}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};
