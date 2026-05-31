import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { ClipboardList, Search, X } from "lucide-react";
import { RegistrationsListSkeleton } from "./skeletons/RegistrationsListSkeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { formatPrice } from "@/utils/currency";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };
import { Eye, MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

interface Registration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  note?: string;
  created_at: string;
  tour_id: string;
  tour_date_id?: string;
  source_channel?: string;
  payment_status?: string;
  total_amount?: number;
  paid_amount?: number;
  deposit_amount?: number;
  tours: {
    id?: string;
    title: string;
    destination: string;
    currency?: string;
  };
  tour_dates: {
    id?: string;
    departure_date: string;
    return_date?: string | null;
    price_adult: number;
    price_child?: number | null;
    quota?: number | null;
  };
}

interface RegistrationsListProps {
  registrations: Registration[];
  loading: boolean;
  onStatusChange: (registrationId: string, newStatus: "NEW" | "PENDING" | "CONFIRMED" | "CANCELLED") => void;
  onViewDetail: (registration: Registration) => void;
}

export const RegistrationsList = ({
  registrations,
  loading,
  onViewDetail
}: RegistrationsListProps) => {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  // Tasarım Turu 2 P2: client-side search (isim/telefon/tur). Mevcut veri üzerinde
  // çalışır — yeni query/RPC YOK. Parent'tan gelen `registrations` zaten filter
  // panelinden geçmiş; search bu sonucun üstüne ek filtre.
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter((r) => {
      const tour = (r.tours?.title || "").toLowerCase();
      const dest = (r.tours?.destination || "").toLowerCase();
      const name = (r.full_name || "").toLowerCase();
      const phone = (r.phone || "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        tour.includes(q) ||
        dest.includes(q)
      );
    });
  }, [registrations, search]);

  const paymentStatusLabels: Record<string, string> = {
    UNPAID: t("admin.paymentStatusLabels.UNPAID"),
    DEPOSIT: t("admin.paymentStatusLabels.DEPOSIT"),
    PAID: t("admin.paymentStatusLabels.PAID")
  };

  // Payment durumu için küçük renkli daire indicator (mevcut palet, opaklık)
  const paymentDot = (s?: string) => {
    if (s === "PAID") return "bg-primary";
    if (s === "DEPOSIT") return "bg-primary/40";
    return "bg-muted-foreground/30";
  };

  if (loading) {
    return <RegistrationsListSkeleton />;
  }

  if (registrations.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t("registrations.emptyTitle")}
        description={t("registrations.emptyDescription")}
      />
    );
  }

  return (
    <>
      {/* Tasarım Turu 2 P2: Search bar — isim/telefon/tur/destinasyon içinde ara */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
          <Input
            type="search"
            placeholder={t("admin.registrations.searchPlaceholder", {
              defaultValue: "İsim, telefon veya tur ara…",
            })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted/60 transition-colors"
              aria-label={t("admin.registrations.clearSearch", { defaultValue: "Aramayı temizle" })}
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        {search && (
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {filtered.length}/{registrations.length}{" "}
            {t("admin.registrations.match", { defaultValue: "eşleşme" })}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("admin.registrations.noSearchResults", { defaultValue: "Eşleşme bulunamadı" })}
          description={t("admin.registrations.noSearchResultsDesc", {
            defaultValue: "Farklı bir kelime deneyin veya aramayı temizleyin.",
          })}
        />
      ) : (
      <>
      {/* Faz 2-C Mobile (md altı): kart layout */}
      <div className="md:hidden space-y-3">
        {filtered.map((reg) => {
          const unitPrice = reg.tour_dates?.price_adult || 0;
          const totalPrice = unitPrice * reg.pax;
          const waUrl = buildWhatsAppUrl(reg.phone);
          const remaining = (reg.paid_amount && reg.paid_amount > 0 && reg.paid_amount < totalPrice)
            ? totalPrice - reg.paid_amount : 0;
          return (
            <div key={reg.id} className="rounded-lg border border-border/60 bg-card p-4 space-y-2.5 motion-safe:transition-shadow motion-safe:hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tracking-tight truncate">{reg.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate tabular-nums">{reg.phone}</p>
                </div>
                <Badge
                  variant={reg.payment_status === 'PAID' ? 'default' : reg.payment_status === 'DEPOSIT' ? 'secondary' : 'outline'}
                  className="text-[11px] font-medium px-2 py-0.5 shrink-0"
                >
                  {paymentStatusLabels[reg.payment_status || 'UNPAID']}
                </Badge>
              </div>
              <div className="text-xs space-y-1">
                <p className="text-foreground">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">{t("admin.registrations.tour")}</span>
                  {reg.tours?.title}
                </p>
                <p className="text-muted-foreground tabular-nums">
                  {reg.tour_dates?.departure_date
                    ? format(new Date(reg.tour_dates.departure_date), "d MMM yyyy", { locale: dateLocale })
                    : '-'} · {reg.pax} {t("common.people", { defaultValue: "kişi" })}
                </p>
              </div>
              {totalPrice > 0 && (
                <div className="flex items-baseline gap-2 text-sm font-mono tabular-nums">
                  <span className="font-semibold">
                    {formatPrice(reg.paid_amount && reg.paid_amount > 0 ? reg.paid_amount : totalPrice, reg.tours?.currency || 'TRY', { showCode: false })}
                  </span>
                  {remaining > 0 && (
                    <span className="text-[11px] text-orange-500">
                      / {formatPrice(totalPrice, reg.tours?.currency || 'TRY', { showCode: false })}
                    </span>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => onViewDetail(reg)}>
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  {t("admin.registrations.detail")}
                </Button>
                {waUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-xs border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/5"
                    asChild
                  >
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" aria-label={t("common.openWhatsApp")}>
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Faz 2-C Desktop (md+): tablo — uppercase header eyebrow, h-14 satır, tabular-nums fiyat */}
      <div className="hidden md:block w-full overflow-x-auto rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/60">
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium py-3">
                {t("admin.registrations.name")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium py-3">
                {t("admin.registrations.tour")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium py-3">
                {t("admin.registrations.date")}
              </TableHead>
              <TableHead className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium py-3">
                {t("admin.registrations.pax")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium py-3">
                {t("admin.registrations.paymentStatus")}
              </TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium py-3">
                {t("admin.registrations.totalPrice")}
              </TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium py-3">
                {t("admin.registrations.detail")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((reg, rowIdx) => {
              const unitPrice = reg.tour_dates?.price_adult || 0;
              const totalPrice = unitPrice * reg.pax;
              const waUrl = buildWhatsAppUrl(reg.phone);
              const zebra = rowIdx % 2 === 1 ? "bg-muted/10" : "";
              return (
                <TableRow
                  key={reg.id}
                  className={`group h-14 hover:bg-accent/30 transition-colors border-b border-border/40 ${zebra}`}
                >
                  <TableCell className="font-medium">{reg.full_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium tracking-tight">{reg.tours?.title}</span>
                      <span className="text-xs text-muted-foreground">{reg.tours?.destination}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {reg.tour_dates?.departure_date
                      ? format(new Date(reg.tour_dates.departure_date), "d MMM yyyy", { locale: dateLocale })
                      : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md border border-border/60 font-mono tabular-nums font-semibold text-sm">
                      {reg.pax}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${paymentDot(reg.payment_status)}`}
                        aria-hidden="true"
                      />
                      <span className="text-xs">
                        {paymentStatusLabels[reg.payment_status || 'UNPAID']}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {totalPrice > 0 ? (
                      <div className="font-mono tabular-nums">
                        {(reg.paid_amount && reg.paid_amount > 0 && reg.paid_amount < totalPrice) ? (
                          <>
                            <span className="text-base font-semibold text-green-600 dark:text-green-400">
                              {formatPrice(reg.paid_amount, reg.tours?.currency || 'TRY', { showCode: false })}
                            </span>
                            <span className="block text-[10px] text-orange-500">
                              {t('admin.registrations.remainingAmount')}: {formatPrice(totalPrice - reg.paid_amount, reg.tours?.currency || 'TRY', { showCode: false })}
                            </span>
                          </>
                        ) : (
                          <span className="text-base font-semibold">
                            {formatPrice(totalPrice, reg.tours?.currency || 'TRY', { showCode: false })}
                          </span>
                        )}
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {/* P2: Slide-in actions — hover'da soldan kayarak görünür */}
                    <div className="flex items-center justify-end gap-1.5 opacity-60 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetail(reg)}
                        aria-label={t("admin.registrations.viewDetail")}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {waUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/5"
                          asChild
                        >
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("common.openWhatsApp")}
                            title={t("common.openWhatsApp")}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      </>
      )}
    </>
  );
};
