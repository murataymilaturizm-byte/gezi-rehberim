import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, differenceInCalendarDays, startOfToday } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { RegistrationsListSkeleton } from "@/components/admin/skeletons/RegistrationsListSkeleton";
import { ClipboardList, Users, ChevronRight, ChevronDown } from "lucide-react";
import type { RegistrationRow } from "./types";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

interface Props {
  registrations: RegistrationRow[];
  loading: boolean;
  onSelectDeparture: (group: DepartureGroup) => void;
}

export interface DepartureGroup {
  dateId: string;
  tourId: string;
  tourTitle: string;
  tourDestination: string;
  currency: string;
  departureDate: string;
  returnDate?: string | null;
  quota: number | null;
  soldPax: number;
  totalRegs: number;
  regs: RegistrationRow[];
}

type Bucket = "today" | "thisWeek" | "upcoming" | "later" | "past";
interface BucketedGroup extends DepartureGroup {
  days: number | null;
  bucket: Bucket;
}

/**
 * Faz 2-C2 PARÇA 1 — Sefer Bazlı operasyon paneli.
 *
 * BİLGİ MİMARİSİ: Acentenin gerçek iş akışı → zamansal öncelik DOM'da fiziksel öncelik.
 *   ① "Bugün" özet bandı (sticky-ish) — günün kritik bilgisi
 *   ② Bu Hafta (0-7 gün) — operasyonel pencere
 *   ③ Yaklaşan (7-30 gün) — planlama pencere
 *   ④ İleride/Geçmiş (collapsible) — arşiv
 *
 * Kart: "Ticket stub" — sol date-block, sağ içerik + mini doluluk dot strip.
 * Hover: shadow grow + ChevronRight reveal. Stagger fade-up ilk yüklemede.
 *
 * RENK PALETİ: sıfır yeni hex. Mevcut primary/muted/destructive opaklıkları.
 */
export const RegistrationsByDeparture = ({
  registrations,
  loading,
  onSelectDeparture,
}: Props) => {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;
  const [laterOpen, setLaterOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

  const groups = useMemo<DepartureGroup[]>(() => {
    const map = new Map<string, DepartureGroup>();
    for (const reg of registrations) {
      const dateId = reg.tour_date_id || reg.tour_dates?.id || `unknown-${reg.tour_id}`;
      if (!map.has(dateId)) {
        map.set(dateId, {
          dateId,
          tourId: reg.tour_id || reg.tours?.id || "",
          tourTitle: reg.tours?.title || "—",
          tourDestination: reg.tours?.destination || "",
          currency: reg.tours?.currency || "TRY",
          departureDate: reg.tour_dates?.departure_date || "",
          returnDate: reg.tour_dates?.return_date,
          quota: reg.tour_dates?.quota ?? null,
          soldPax: 0,
          totalRegs: 0,
          regs: [],
        });
      }
      const g = map.get(dateId)!;
      g.totalRegs++;
      if (reg.status !== "CANCELLED") g.soldPax += reg.pax;
      g.regs.push(reg);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.departureDate || "").localeCompare(b.departureDate || "")
    );
  }, [registrations]);

  const bucketed = useMemo<{
    today: BucketedGroup[];
    thisWeek: BucketedGroup[];
    upcoming: BucketedGroup[];
    later: BucketedGroup[];
    past: BucketedGroup[];
  }>(() => {
    const today = startOfToday();
    const buckets = {
      today: [] as BucketedGroup[],
      thisWeek: [] as BucketedGroup[],
      upcoming: [] as BucketedGroup[],
      later: [] as BucketedGroup[],
      past: [] as BucketedGroup[],
    };
    for (const g of groups) {
      const days = g.departureDate
        ? differenceInCalendarDays(new Date(g.departureDate), today)
        : null;
      let bucket: Bucket;
      if (days == null) bucket = "past"; // tarihsiz kayıtlar geçmişe düşsün
      else if (days < 0) bucket = "past";
      else if (days === 0) bucket = "today";
      else if (days <= 7) bucket = "thisWeek";
      else if (days <= 30) bucket = "upcoming";
      else bucket = "later";
      buckets[bucket].push({ ...g, days, bucket });
    }
    // İleride: tarih ASC (en yakın gelecek önce)
    buckets.later.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
    // Geçmiş: tarih DESC (en yakın geçmiş önce — yani days=-1 önce, days=-365 sonra)
    buckets.past.sort((a, b) => (b.days ?? -Infinity) - (a.days ?? -Infinity));
    return buckets;
  }, [groups]);

  // Bugün özet bandı sayıları
  const todaySummary = useMemo(() => {
    const list = bucketed.today;
    const pax = list.reduce((s, g) => s + g.soldPax, 0);
    const remaining = list.reduce(
      (s, g) => s + (g.quota != null ? Math.max(0, g.quota - g.soldPax) : 0),
      0
    );
    return { count: list.length, pax, remaining };
  }, [bucketed.today]);

  if (loading) return <RegistrationsListSkeleton />;
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t("registrations.emptyTitle")}
        description={t("registrations.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ① BUGÜN özet bandı */}
      {bucketed.today.length > 0 && (
        <TodayBanner
          summary={todaySummary}
          items={bucketed.today}
          onSelect={onSelectDeparture}
        />
      )}

      {/* ② BU HAFTA */}
      {bucketed.thisWeek.length > 0 && (
        <Section
          title={t("admin.registrations.timeBuckets.thisWeek", { defaultValue: "Bu Hafta" })}
          items={bucketed.thisWeek}
          onSelect={onSelectDeparture}
          dateLocale={dateLocale}
          t={t}
        />
      )}

      {/* ③ YAKLAŞAN */}
      {bucketed.upcoming.length > 0 && (
        <Section
          title={t("admin.registrations.timeBuckets.upcoming", { defaultValue: "Yaklaşan" })}
          items={bucketed.upcoming}
          onSelect={onSelectDeparture}
          dateLocale={dateLocale}
          t={t}
        />
      )}

      {/* ④ İLERİDE (30+ gün gelecek) — ayrı collapsible */}
      {bucketed.later.length > 0 && (
        <CollapsibleSection
          title={t("admin.registrations.timeBuckets.later", { defaultValue: "İleride" })}
          count={bucketed.later.length}
          open={laterOpen}
          onToggle={() => setLaterOpen((x) => !x)}
          items={bucketed.later}
          onSelect={onSelectDeparture}
          dateLocale={dateLocale}
          t={t}
        />
      )}

      {/* ⑤ GEÇMİŞ (geçmiş tarihli) — ayrı collapsible, kartlar opacity-60 */}
      {bucketed.past.length > 0 && (
        <CollapsibleSection
          title={t("admin.registrations.timeBuckets.past", { defaultValue: "Geçmiş" })}
          count={bucketed.past.length}
          open={pastOpen}
          onToggle={() => setPastOpen((x) => !x)}
          items={bucketed.past}
          onSelect={onSelectDeparture}
          dateLocale={dateLocale}
          t={t}
        />
      )}
    </div>
  );
};

// Collapsible bölüm wrapper'ı — İleride ve Geçmiş için ortak kullanım.
// Sefer kartları (TicketStubCard) zaten kendisini past → opacity-60 ile soluklaştırıyor;
// burada ekstra bir şey gerekmiyor.
interface CollapsibleSectionProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  items: BucketedGroup[];
  onSelect: (g: DepartureGroup) => void;
  dateLocale: typeof tr;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

const CollapsibleSection = ({
  title,
  count,
  open,
  onToggle,
  items,
  onSelect,
  dateLocale,
  t,
}: CollapsibleSectionProps) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      className="group flex items-center gap-2 w-full text-left mb-3 py-1.5 hover:opacity-80 transition-opacity"
    >
      <ChevronDown
        className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
          open ? "" : "-rotate-90"
        }`}
      />
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <span className="text-xs text-muted-foreground font-mono tabular-nums">
        · {count} {t("admin.registrations.tripsShort", { defaultValue: "sefer" })}
      </span>
    </button>
    {open && (
      <Section
        title=""
        items={items}
        onSelect={onSelect}
        dateLocale={dateLocale}
        t={t}
        hideHeader
      />
    )}
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// ① BUGÜN özet bandı — yatay mini-kart şeridi + sticky özet
// ════════════════════════════════════════════════════════════════════════════
interface TodayBannerProps {
  summary: { count: number; pax: number; remaining: number };
  items: BucketedGroup[];
  onSelect: (g: DepartureGroup) => void;
}

const TodayBanner = ({ summary, items, onSelect }: TodayBannerProps) => {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold text-primary">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t("admin.registrations.timeBuckets.today", { defaultValue: "Bugün" })}
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            ·{" "}
            {format(new Date(), "d MMMM yyyy", {
              locale:
                DATE_LOCALE_MAP[useTranslation().i18n.language as keyof typeof DATE_LOCALE_MAP] || tr,
            })}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Stat label={t("admin.registrations.tripsShort", { defaultValue: "sefer" })} value={summary.count} />
          <span className="text-muted-foreground/40">·</span>
          <Stat label={t("common.people", { defaultValue: "kişi" })} value={summary.pax} />
          <span className="text-muted-foreground/40">·</span>
          <Stat
            label={t("admin.registrations.remainingShort", { defaultValue: "kalan koltuk" })}
            value={summary.remaining}
            muted
          />
        </div>
      </div>

      {/* Yatay mini-kart şeridi */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {items.map((g, idx) => (
          <TodayMiniCard
            key={g.dateId}
            group={g}
            onClick={() => onSelect(g)}
            delayMs={idx * 40}
          />
        ))}
      </div>
    </div>
  );
};

const Stat = ({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) => (
  <span className="inline-flex items-baseline gap-1">
    <span
      className={`font-mono tabular-nums font-bold text-base ${
        muted ? "text-muted-foreground" : "text-foreground"
      }`}
    >
      {value}
    </span>
    <span className="text-muted-foreground text-xs">{label}</span>
  </span>
);

const TodayMiniCard = ({
  group,
  onClick,
  delayMs,
}: {
  group: BucketedGroup;
  onClick: () => void;
  delayMs: number;
}) => {
  const occupancyPct =
    group.quota && group.quota > 0
      ? Math.min(100, Math.round((group.soldPax / group.quota) * 100))
      : null;
  const isFull = group.quota != null && group.soldPax >= group.quota;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delayMs}ms` }}
      className="group shrink-0 snap-start w-[220px] text-left rounded-lg border border-border/60 bg-card hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-[transform,box-shadow,border-color] duration-200 p-3 space-y-2 animate-in fade-in slide-in-from-bottom-1"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight truncate flex-1">
          {group.tourTitle}
        </p>
        {isFull && (
          <span className="inline-flex items-center text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
            FULL
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-0.5">
          <span className="text-xl font-mono tabular-nums font-bold leading-none">
            {group.soldPax}
          </span>
          {group.quota != null && (
            <span className="text-sm font-mono tabular-nums text-muted-foreground leading-none">
              /{group.quota}
            </span>
          )}
        </div>
        {occupancyPct != null && (
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
            %{occupancyPct}
          </span>
        )}
      </div>
      {group.quota != null && (
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isFull ? "bg-destructive/80" : occupancyPct! >= 80 ? "bg-primary/80" : "bg-primary/60"
            }`}
            style={{ width: `${occupancyPct ?? 0}%` }}
          />
        </div>
      )}
    </button>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SECTION — başlık + ticket-stub kartlar
// ════════════════════════════════════════════════════════════════════════════
interface SectionProps {
  title: string;
  items: BucketedGroup[];
  onSelect: (g: DepartureGroup) => void;
  dateLocale: typeof tr;
  t: (k: string, opts?: Record<string, unknown>) => string;
  hideHeader?: boolean;
}

const Section = ({ title, items, onSelect, dateLocale, t, hideHeader }: SectionProps) => {
  const stats = useMemo(() => {
    let full = 0;
    let available = 0;
    for (const g of items) {
      if (g.quota != null) {
        if (g.soldPax >= g.quota) full++;
        else available++;
      }
    }
    return { full, available };
  }, [items]);

  return (
    <section>
      {!hideHeader && (
        <div className="flex items-baseline justify-between gap-3 mb-3 pb-2 border-b border-border/40">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              · {items.length} {t("admin.registrations.tripsShort", { defaultValue: "sefer" })}
            </span>
          </div>
          {(stats.full > 0 || stats.available > 0) && (
            <div className="flex items-center gap-2 text-[11px]">
              {stats.full > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-medium uppercase tracking-wider">
                  <span className="font-mono tabular-nums">{stats.full}</span>{" "}
                  {t("admin.registrations.countFull", { defaultValue: "dolu" })}
                </span>
              )}
              {stats.available > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium uppercase tracking-wider">
                  <span className="font-mono tabular-nums">{stats.available}</span>{" "}
                  {t("admin.registrations.countAvailable", { defaultValue: "müsait" })}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((g, idx) => (
          <TicketStubCard
            key={g.dateId}
            group={g}
            onClick={() => onSelect(g)}
            dateLocale={dateLocale}
            t={t}
            delayMs={idx * 30}
          />
        ))}
      </div>
    </section>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// TICKET-STUB SEFER KARTI
// ════════════════════════════════════════════════════════════════════════════
interface TicketStubCardProps {
  group: BucketedGroup;
  onClick: () => void;
  dateLocale: typeof tr;
  t: (k: string, opts?: Record<string, unknown>) => string;
  delayMs: number;
}

const TicketStubCard = ({ group, onClick, dateLocale, t, delayMs }: TicketStubCardProps) => {
  const occupancyPct =
    group.quota && group.quota > 0
      ? Math.min(100, Math.round((group.soldPax / group.quota) * 100))
      : null;
  const isFull = group.quota != null && group.soldPax >= group.quota;
  const isPast = group.days != null && group.days < 0;

  // Durum rozeti
  let statusBadge: { label: string; cls: string } | null = null;
  if (isFull) {
    statusBadge = {
      label: t("admin.registrations.full", { defaultValue: "Dolu" }),
      cls: "bg-destructive/10 text-destructive border-destructive/30",
    };
  } else if (group.days === 0) {
    statusBadge = {
      label: t("admin.registrations.badgeToday", { defaultValue: "Bugün" }),
      cls: "bg-primary/15 text-primary border-primary/30",
    };
  } else if (group.days === 1) {
    statusBadge = {
      label: t("admin.registrations.badgeTomorrow", { defaultValue: "Yarın" }),
      cls: "bg-primary/10 text-primary border-primary/20",
    };
  }

  // Date block — büyük gün + ay
  const dateParts = group.departureDate
    ? {
        day: format(new Date(group.departureDate), "d", { locale: dateLocale }),
        month: format(new Date(group.departureDate), "MMM", { locale: dateLocale }),
        weekday: format(new Date(group.departureDate), "EEE", { locale: dateLocale }),
      }
    : { day: "—", month: "", weekday: "" };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ animationDelay: `${delayMs}ms` }}
      className={`group cursor-pointer overflow-hidden hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] transition-[transform,box-shadow,border-color] duration-200 animate-in fade-in slide-in-from-bottom-2 ${
        isPast ? "opacity-60" : ""
      }`}
    >
      <div className="flex">
        {/* SOL: Date block — "ticket koçanı" */}
        <div className="shrink-0 w-[72px] bg-muted/30 border-r border-dashed border-border/60 flex flex-col items-center justify-center py-4 px-2 group-hover:translate-x-0.5 transition-transform duration-200">
          <span className="text-3xl font-bold tabular-nums leading-none tracking-tighter">
            {dateParts.day}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mt-1.5">
            {dateParts.month}
          </span>
          <span className="text-[10px] text-muted-foreground/70 capitalize mt-0.5">
            {dateParts.weekday}
          </span>
          {group.returnDate && (
            <span className="text-[9px] text-muted-foreground/60 mt-2 font-mono tabular-nums">
              →{" "}
              {format(new Date(group.returnDate), "d MMM", { locale: dateLocale })}
            </span>
          )}
        </div>

        {/* SAĞ: İçerik */}
        <CardContent className="flex-1 min-w-0 p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight truncate">
                {group.tourTitle}
              </p>
              {group.tourDestination && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {group.tourDestination}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {statusBadge && (
                <span
                  className={`inline-flex items-center text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${statusBadge.cls}`}
                >
                  {statusBadge.label}
                </span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
          </div>

          {/* Doluluk */}
          {group.quota != null ? (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-mono tabular-nums font-bold leading-none">
                    {group.soldPax}
                  </span>
                  <span className="text-sm font-mono tabular-nums text-muted-foreground leading-none">
                    /{group.quota}
                  </span>
                </div>
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground uppercase tracking-wider">
                  %{occupancyPct}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isFull
                      ? "bg-destructive/80"
                      : occupancyPct! >= 80
                      ? "bg-primary/80"
                      : "bg-primary/60"
                  }`}
                  style={{ width: `${occupancyPct ?? 0}%` }}
                />
              </div>
              {/* Mini koltuk yoğunluk strip'i — 20 nokta yatay */}
              <DotStrip filled={occupancyPct ?? 0} isFull={isFull} />
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono tabular-nums font-bold leading-none">
                  {group.totalRegs}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("admin.registrations.records", { defaultValue: "Kayıt" })}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 italic">
                {t("admin.registrations.noQuotaSet", { defaultValue: "Kontenjan ayarlı değil" })}
              </p>
            </div>
          )}

          {/* Yardımcı meta — kalan koltuk veya gün-uzaklığı */}
          {group.quota != null && !isFull && !isPast && (
            <p className="text-[10px] text-muted-foreground/70 mt-auto">
              {t("admin.registrations.remainingSeats", {
                count: Math.max(0, group.quota - group.soldPax),
                defaultValue: `${Math.max(0, group.quota - group.soldPax)} koltuk boş`,
              })}
            </p>
          )}
        </CardContent>
      </div>
    </Card>
  );
};

// Mini nokta strip'i — 20 nokta yatay, doluluk yüzdesine göre filled
const DotStrip = ({ filled, isFull }: { filled: number; isFull: boolean }) => {
  const totalDots = 20;
  const filledDots = Math.round((filled / 100) * totalDots);
  return (
    <div className="flex gap-[3px] mt-1" aria-hidden="true">
      {Array.from({ length: totalDots }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 h-1 rounded-[1px] transition-colors ${
            i < filledDots
              ? isFull
                ? "bg-destructive/70"
                : "bg-primary/70"
              : "bg-muted-foreground/15"
          }`}
        />
      ))}
    </div>
  );
};
