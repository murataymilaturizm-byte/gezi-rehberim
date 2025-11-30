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
}

export const RegistrationsList = ({
  registrations,
  loading,
  onStatusChange
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
    WHATSAPP: "WhatsApp",
    PHONE: "Telefon",
    OFFICE: "Ofis",
    INSTAGRAM: "Instagram",
    OTHER: "Diğer"
  };

  const paymentStatusLabels: Record<string, string> = {
    UNPAID: "Ödenmedi",
    DEPOSIT: "Kapora",
    PAID: "Ödendi"
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("admin.loading")}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.registrations.name")}</TableHead>
          <TableHead>{t("admin.registrations.phone")}</TableHead>
          <TableHead>{t("admin.registrations.tour")}</TableHead>
          <TableHead>{t("admin.registrations.date")}</TableHead>
          <TableHead className="text-center">{t("admin.registrations.pax")}</TableHead>
          <TableHead>Kaynak</TableHead>
          <TableHead>Ödeme</TableHead>
          <TableHead className="text-right">Birim Fiyat</TableHead>
          <TableHead className="text-right font-semibold">Toplam</TableHead>
          <TableHead>{t("admin.registrations.status")}</TableHead>
          <TableHead className="text-center">Not</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {registrations.length === 0 ? (
          <TableRow>
            <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
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
                  <a href={`tel:${reg.phone}`} className="text-primary hover:underline">
                    {reg.phone}
                  </a>
                </TableCell>
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
                  <Badge variant="secondary" className="text-xs">
                    {sourceChannelLabels[reg.source_channel || 'WHATSAPP']}
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
                <TableCell className="text-right">
                  {unitPrice > 0 ? (
                    <span className="text-sm text-muted-foreground">
                      {unitPrice.toLocaleString('tr-TR')}₺
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {totalPrice > 0 ? (
                    <span className="text-base font-semibold">
                      {totalPrice.toLocaleString('tr-TR')}₺
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <Select
                    value={reg.status}
                    onValueChange={(value) => onStatusChange(reg.id, value as "NEW" | "PENDING" | "CONFIRMED" | "CANCELLED")}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">
                        <Badge variant="secondary">{statusLabels.NEW}</Badge>
                      </SelectItem>
                      <SelectItem value="PENDING">
                        <Badge variant="secondary">{statusLabels.PENDING}</Badge>
                      </SelectItem>
                      <SelectItem value="CONFIRMED">
                        <Badge variant="default">{statusLabels.CONFIRMED}</Badge>
                      </SelectItem>
                      <SelectItem value="CANCELLED">
                        <Badge variant="destructive">{statusLabels.CANCELLED}</Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center">
                  {reg.note && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        toast({
                          title: "Rezervasyon Notu",
                          description: reg.note,
                          duration: 5000,
                        });
                      }}
                    >
                      📝
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
};
