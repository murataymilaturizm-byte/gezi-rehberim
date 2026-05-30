import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { ClipboardList } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { formatPrice } from "@/utils/currency";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };
import { useToast } from "@/hooks/use-toast";
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
  onStatusChange,
  onViewDetail
}: RegistrationsListProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  const statusLabels: Record<string, string> = {
    NEW: t("admin.status.new"),
    PENDING: t("admin.status.pending"),
    CONFIRMED: t("admin.status.confirmed"),
    CANCELLED: t("admin.status.cancelled")
  };

  const sourceChannelLabels: Record<string, string> = {
    WHATSAPP: t("admin.sourceChannel.WHATSAPP"),
    PHONE: t("admin.sourceChannel.PHONE"),
    OFFICE: t("admin.sourceChannel.OFFICE"),
    INSTAGRAM: t("admin.sourceChannel.INSTAGRAM"),
    OTHER: t("admin.sourceChannel.OTHER")
  };

  const paymentStatusLabels: Record<string, string> = {
    UNPAID: t("admin.paymentStatusLabels.UNPAID"),
    DEPOSIT: t("admin.paymentStatusLabels.DEPOSIT"),
    PAID: t("admin.paymentStatusLabels.PAID")
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
      {/* Mobile (md altı): kart layout — telefondan operasyon-dostu */}
      <div className="md:hidden space-y-3">
        {registrations.map((reg) => {
          const unitPrice = reg.tour_dates?.price_adult || 0;
          const totalPrice = unitPrice * reg.pax;
          const waUrl = buildWhatsAppUrl(reg.phone);
          const remaining = (reg.paid_amount && reg.paid_amount > 0 && reg.paid_amount < totalPrice)
            ? totalPrice - reg.paid_amount : 0;
          return (
            <div key={reg.id} className="rounded-lg border bg-card p-3 space-y-2 motion-safe:transition-shadow motion-safe:hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{reg.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{reg.phone}</p>
                </div>
                <Badge
                  variant={reg.payment_status === 'PAID' ? 'default' : reg.payment_status === 'DEPOSIT' ? 'secondary' : 'outline'}
                  className="text-[10px] shrink-0"
                >
                  {paymentStatusLabels[reg.payment_status || 'UNPAID']}
                </Badge>
              </div>
              <div className="text-xs space-y-0.5">
                <p className="text-foreground"><span className="text-muted-foreground">{t("admin.registrations.tour")}:</span> {reg.tours?.title}</p>
                <p className="text-muted-foreground">
                  {reg.tour_dates?.departure_date
                    ? format(new Date(reg.tour_dates.departure_date), "d MMM yyyy", { locale: dateLocale })
                    : '-'} · {reg.pax} {t("common.people", { defaultValue: "kişi" })}
                </p>
              </div>
              {totalPrice > 0 && (
                <div className="flex items-baseline gap-2 text-sm">
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
              <div className="flex gap-1.5 pt-1">
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

      {/* Desktop (md+): tablo (mevcut, dokunulmadı) */}
      <div className="hidden md:block w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">{t("admin.registrations.name")}</TableHead>
              <TableHead className="min-w-[200px]">{t("admin.registrations.tour")}</TableHead>
              <TableHead className="min-w-[120px]">{t("admin.registrations.date")}</TableHead>
              <TableHead className="text-center min-w-[80px]">{t("admin.registrations.pax")}</TableHead>
              <TableHead className="min-w-[100px]">{t("admin.registrations.paymentStatus")}</TableHead>
              <TableHead className="text-right min-w-[100px] font-semibold">{t("admin.registrations.totalPrice")}</TableHead>
              <TableHead className="text-center min-w-[120px]">{t("admin.registrations.detail")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.map((reg) => {
              const unitPrice = reg.tour_dates?.price_adult || 0;
              const totalPrice = unitPrice * reg.pax;
              const waUrl = buildWhatsAppUrl(reg.phone);
              return (
                <TableRow key={reg.id} className="hover:bg-accent/50">
                  <TableCell className="font-medium">{reg.full_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{reg.tours?.title}</span>
                      <span className="text-xs text-muted-foreground">{reg.tours?.destination}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {reg.tour_dates?.departure_date
                      ? format(new Date(reg.tour_dates.departure_date), "d MMM yyyy", { locale: dateLocale })
                      : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-semibold">{reg.pax}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={reg.payment_status === 'PAID' ? 'default' : reg.payment_status === 'DEPOSIT' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {paymentStatusLabels[reg.payment_status || 'UNPAID']}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {totalPrice > 0 ? (
                      <div>
                        {(reg.paid_amount && reg.paid_amount > 0 && reg.paid_amount < totalPrice) ? (
                          <>
                            <span className="text-base font-semibold text-green-600">
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
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
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
  );
};
