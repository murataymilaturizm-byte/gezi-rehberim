// CustomerListItem — zenginleştirilmiş liste satırı.
// Eski satır sadece ad+telefon+aktivite+mesaj sayısı gösteriyordu.
// Yeni satır: avatar + ad + telefon + otomatik etiketler + harcama + rezervasyon
// + mesaj + aktivite dot — kullanıcı listede iken karar verebilsin,
// her birine tıklamak zorunda kalmasın.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingBag, MessageSquare, UserPlus } from "lucide-react";
import { computeAutoTags } from "./customerTags";
import { AutoTagBadge } from "./TagBadge";

interface CustomerListItemProps {
  id: string;
  name: string | null;
  phone: string;
  totalMessages: number;
  totalBookings: number;
  totalSpent: number;
  lastInteractionAt: string;
  lastSearchQuery: string | null;
  manualTagCount: number;
  source: string | null;
  isSelected: boolean;
  currencySym: string;
  onClick: () => void;
}

// Initial harf çıkar — Türkçe karakterler için
const getInitial = (name: string | null, phone: string): string => {
  if (name && name.trim().length > 0) {
    const first = name.trim()[0];
    return first.toLocaleUpperCase("tr-TR");
  }
  // İsim yoksa telefonun son hanesi
  return phone.slice(-1) || "?";
};

const getActivityColor = (daysSince: number): string => {
  if (daysSince === 0) return "bg-emerald-500";
  if (daysSince === 1) return "bg-blue-500";
  if (daysSince <= 7) return "bg-yellow-500";
  if (daysSince <= 30) return "bg-orange-500";
  return "bg-muted-foreground/60";
};

export const CustomerListItem = ({
  name,
  phone,
  totalMessages,
  totalBookings,
  totalSpent,
  lastInteractionAt,
  lastSearchQuery,
  manualTagCount,
  source,
  isSelected,
  currencySym,
  onClick,
}: CustomerListItemProps) => {
  const { t } = useTranslation();

  const daysSince = Math.floor(
    (Date.now() - new Date(lastInteractionAt).getTime()) / 86_400_000
  );
  const activityColor = getActivityColor(daysSince);
  const activityLabel =
    daysSince === 0
      ? t("admin.whatsapp.userProfiles.todayActive")
      : daysSince === 1
      ? t("admin.whatsapp.userProfiles.yesterdayActive")
      : `${daysSince} ${t("admin.whatsapp.userProfiles.daysAgo")}`;

  const autoTags = useMemo(
    () =>
      computeAutoTags({
        total_bookings: totalBookings,
        total_spent: totalSpent,
        total_messages: totalMessages,
        last_search_query: lastSearchQuery,
        last_interaction_at: lastInteractionAt,
        source,
      }),
    [totalBookings, totalSpent, totalMessages, lastSearchQuery, lastInteractionAt, source]
  );

  const isManual = source === "manual";

  const displayName = name?.trim() || t("admin.whatsapp.userProfiles.unnamed");
  const initial = getInitial(name, phone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-start p-3 rounded-lg border transition-all ${
        isSelected
          ? "bg-primary/8 border-primary/40 ring-1 ring-primary/30 shadow-sm"
          : "bg-card border-border/60 hover:bg-accent/30 hover:border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar — initial harf rozeti */}
        <div className="relative flex-shrink-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shadow-sm ${
              isSelected
                ? "bg-gradient-ocean text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {initial}
          </div>
          {/* Aktivite dot — avatarın sağ-altında */}
          <span
            className={`absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full border-2 border-card ${activityColor}`}
            title={activityLabel}
            aria-label={activityLabel}
          />
        </div>

        {/* İçerik */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <p className="font-semibold text-sm text-foreground truncate leading-tight flex items-center gap-1.5">
              {displayName}
              {isManual && (
                <span
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                  title={t("admin.whatsapp.userProfiles.manualBadgeTooltip", { defaultValue: "Manuel eklenen müşteri" })}
                >
                  <UserPlus className="w-2.5 h-2.5" />
                  {t("admin.whatsapp.userProfiles.manualBadge", { defaultValue: "Manuel" })}
                </span>
              )}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono mb-2 truncate">
            {phone}
          </p>

          {/* Etiket satırı */}
          {(autoTags.length > 0 || manualTagCount > 0) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {autoTags.slice(0, 3).map((tag) => (
                <AutoTagBadge key={tag} tag={tag} size="xs" />
              ))}
              {manualTagCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-secondary/20 border border-secondary/40 text-[10px] text-secondary-foreground font-medium">
                  +{manualTagCount}
                </span>
              )}
            </div>
          )}

          {/* Metrik şeridi */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
            {totalSpent > 0 && (
              <span
                className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 dark:text-emerald-400"
                title={t("admin.whatsapp.userProfiles.totalSpent")}
              >
                {totalSpent.toLocaleString()}
                {currencySym}
              </span>
            )}
            {totalBookings > 0 && (
              <span
                className="inline-flex items-center gap-0.5"
                title={t("admin.whatsapp.userProfiles.totalBookings")}
              >
                <ShoppingBag className="w-3 h-3" />
                {totalBookings}
              </span>
            )}
            <span
              className="inline-flex items-center gap-0.5"
              title={t("admin.whatsapp.userProfiles.totalMessages")}
            >
              <MessageSquare className="w-3 h-3" />
              {totalMessages}
            </span>
            <span className="ms-auto text-[10px] opacity-75">{activityLabel}</span>
          </div>
        </div>
      </div>
    </button>
  );
};
