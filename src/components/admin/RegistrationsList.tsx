import { useTranslation } from "react-i18next";
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
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Eye } from "lucide-react";

interface Registration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  note?: string;
  created_at: string;
  tour_id: string;
  source_channel?: string;
  payment_status?: string;
  total_amount?: number;
  paid_amount?: number;
  deposit_amount?: number;
  tours: {
    title: string;
    destination: string;
  };
  tour_dates: {
    departure_date: string;
    price_adult: number;
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
  const { t } = useTranslation();
  const { toast } = useToast();

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
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("admin.loading")}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">{t("admin.registrations.name")}</TableHead>
            <TableHead className="min-w-[200px]">{t("admin.registrations.tour")}</TableHead>
            <TableHead className="min-w-[120px]">{t("admin.registrations.date")}</TableHead>
            <TableHead className="text-center min-w-[80px]">{t("admin.registrations.pax")}</TableHead>
            <TableHead className="min-w-[100px]">{t("admin.registrations.paymentStatus")}</TableHead>
            <TableHead className="text-right min-w-[100px] font-semibold hidden sm:table-cell">{t("admin.registrations.totalPrice")}</TableHead>
            <TableHead className="text-center min-w-[80px]">{t("admin.registrations.detail")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {t("admin.registrations.noRegistrations")}
              </TableCell>
            </TableRow>
        ) : (
          registrations.map((reg) => {
            const unitPrice = reg.tour_dates?.price_adult || 0;
            const totalPrice = unitPrice * reg.pax;
            
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
                    ? format(new Date(reg.tour_dates.departure_date), "d MMM yyyy", { locale: tr })
                    : '-'}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="font-semibold">
                    {reg.pax}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={
                      reg.payment_status === 'PAID' ? 'default' : 
                      reg.payment_status === 'DEPOSIT' ? 'secondary' : 
                      'outline'
                    }
                    className="text-xs"
                  >
                    {paymentStatusLabels[reg.payment_status || 'UNPAID']}
                  </Badge>
                </TableCell>
                <TableCell className="text-right hidden sm:table-cell">
                  {totalPrice > 0 ? (
                    <div>
                      {(reg.paid_amount && reg.paid_amount > 0 && reg.paid_amount < totalPrice) ? (
                        <>
                          <span className="text-base font-semibold text-green-600">
                            {reg.paid_amount.toLocaleString('tr-TR')}₺
                          </span>
                          <span className="block text-[10px] text-orange-500">
                            Kalan: {(totalPrice - reg.paid_amount).toLocaleString('tr-TR')}₺
                          </span>
                        </>
                      ) : (
                        <span className="text-base font-semibold">
                          {totalPrice.toLocaleString('tr-TR')}₺
                        </span>
                      )}
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetail(reg)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
