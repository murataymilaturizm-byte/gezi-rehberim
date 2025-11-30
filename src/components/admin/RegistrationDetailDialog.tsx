import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { tr as trLocale } from "date-fns/locale";

interface Registration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  note?: string;
  created_at: string;
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

interface RegistrationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: Registration | null;
  onSuccess: () => void;
}

export const RegistrationDetailDialog = ({
  open,
  onOpenChange,
  registration,
  onSuccess
}: RegistrationDetailDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!registration) return null;

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

  const statusLabels: Record<string, string> = {
    NEW: t("admin.status.new"),
    PENDING: t("admin.status.pending"),
    CONFIRMED: t("admin.status.confirmed"),
    CANCELLED: t("admin.status.cancelled")
  };

  const totalAmount = registration.total_amount || 0;
  const paidAmount = registration.paid_amount || 0;
  const remainingAmount = totalAmount - paidAmount;

  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t("admin.registrations.paymentError"),
        description: t("admin.registrations.enterAmount"),
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newPaidAmount = paidAmount + amount;
      let newPaymentStatus = registration.payment_status;

      // Update payment status based on total amount
      if (registration.total_amount && newPaidAmount >= registration.total_amount) {
        newPaymentStatus = "PAID";
      } else if (newPaidAmount > 0) {
        newPaymentStatus = "DEPOSIT";
      }

      const { error } = await supabase
        .from("registrations")
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus
        })
        .eq("id", registration.id);

      if (error) throw error;

      toast({
        title: t("admin.registrations.paymentSuccess"),
        description: `${amount.toLocaleString('tr-TR')}₺ ödeme eklendi`
      });

      setPaymentAmount("");
      onSuccess();
    } catch (error) {
      console.error("Payment add error:", error);
      toast({
        title: t("admin.registrations.paymentError"),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.registrations.detailTitle")}</DialogTitle>
          <DialogDescription>
            {registration.full_name} - {registration.phone}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t("admin.registrations.basicInfo")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.registrations.tour")}</Label>
                <p className="font-medium">{registration.tours?.title}</p>
                <p className="text-xs text-muted-foreground">{registration.tours?.destination}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.registrations.date")}</Label>
                <p className="font-medium">
                  {registration.tour_dates?.departure_date 
                    ? format(new Date(registration.tour_dates.departure_date), "d MMM yyyy", { locale: trLocale })
                    : '-'}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.registrations.pax")}</Label>
                <p className="font-medium">{registration.pax} kişi</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.registrations.source")}</Label>
                <Badge variant="secondary" className="text-xs">
                  {sourceChannelLabels[registration.source_channel || 'WHATSAPP']}
                </Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.registrations.status")}</Label>
                <Badge variant="outline">
                  {statusLabels[registration.status]}
                </Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.registrations.paymentStatus")}</Label>
                <Badge 
                  variant={
                    registration.payment_status === 'PAID' ? 'default' : 
                    registration.payment_status === 'DEPOSIT' ? 'secondary' : 
                    'outline'
                  }
                >
                  {paymentStatusLabels[registration.payment_status || 'UNPAID']}
                </Badge>
              </div>
            </div>

            {registration.note && (
              <div className="mt-4">
                <Label className="text-xs text-muted-foreground">{t("admin.registrations.note")}</Label>
                <p className="text-sm mt-1 p-2 bg-muted rounded">{registration.note}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Payment Info */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t("admin.registrations.paymentInfo")}</h3>
            <div className="grid grid-cols-2 gap-4">
              {totalAmount > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t("admin.registrations.totalAmount")}</Label>
                  <p className="font-semibold text-lg">{totalAmount.toLocaleString('tr-TR')}₺</p>
                </div>
              )}
              {registration.deposit_amount && registration.deposit_amount > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t("admin.registrations.depositAmount")}</Label>
                  <p className="font-medium">{registration.deposit_amount.toLocaleString('tr-TR')}₺</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.registrations.paidAmount")}</Label>
                <p className="font-medium text-green-600">{paidAmount.toLocaleString('tr-TR')}₺</p>
              </div>
              {totalAmount > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t("admin.registrations.remainingAmount")}</Label>
                  <p className="font-semibold text-orange-600">{remainingAmount.toLocaleString('tr-TR')}₺</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Add Payment */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t("admin.registrations.addPayment")}</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="paymentAmount">{t("admin.registrations.paymentAmount")}</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={t("admin.registrations.enterAmount")}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleAddPayment}
                  disabled={isSubmitting || !paymentAmount}
                >
                  {isSubmitting ? "..." : t("admin.registrations.addPaymentButton")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
