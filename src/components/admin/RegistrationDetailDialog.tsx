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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { tr as trLocale } from "date-fns/locale";
import { User, Phone, Users, Calendar, MapPin, CreditCard, Wallet, DollarSign } from "lucide-react";

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t("admin.registrations.detailTitle")}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-base">
            {registration.full_name} • {registration.phone}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Tour Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {t("admin.registrations.tour")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="font-medium text-sm">{registration.tours?.title}</p>
                <p className="text-xs text-muted-foreground">{registration.tours?.destination}</p>
              </CardContent>
            </Card>

            {/* Date & Pax Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t("admin.registrations.date")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-sm">
                  {registration.tour_dates?.departure_date 
                    ? format(new Date(registration.tour_dates.departure_date), "d MMM yyyy", { locale: trLocale })
                    : '-'}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <Users className="h-3 w-3" />
                  <span>{registration.pax} kişi</span>
                  <span className="text-muted-foreground">•</span>
                  <span>{(registration.tour_dates?.price_adult || 0).toLocaleString('tr-TR')}₺/kişi</span>
                </div>
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Durum</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Kayıt:</span>
                  <Badge variant="outline" className="text-xs">
                    {statusLabels[registration.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ödeme:</span>
                  <Badge 
                    variant={
                      registration.payment_status === 'PAID' ? 'default' : 
                      registration.payment_status === 'DEPOSIT' ? 'secondary' : 
                      'outline'
                    }
                    className="text-xs"
                  >
                    {paymentStatusLabels[registration.payment_status || 'UNPAID']}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Kaynak:</span>
                  <Badge variant="secondary" className="text-xs">
                    {sourceChannelLabels[registration.source_channel || 'WHATSAPP']}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Summary */}
          {totalAmount > 0 && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  {t("admin.registrations.paymentInfo")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t("admin.registrations.totalAmount")}</p>
                    <p className="font-semibold text-lg">{totalAmount.toLocaleString('tr-TR')}₺</p>
                  </div>
                  {registration.deposit_amount && registration.deposit_amount > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("admin.registrations.depositAmount")}</p>
                      <p className="font-medium text-blue-600">{registration.deposit_amount.toLocaleString('tr-TR')}₺</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t("admin.registrations.paidAmount")}</p>
                    <p className="font-medium text-green-600">{paidAmount.toLocaleString('tr-TR')}₺</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t("admin.registrations.remainingAmount")}</p>
                    <p className="font-semibold text-orange-600">{remainingAmount.toLocaleString('tr-TR')}₺</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Note */}
          {registration.note && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("admin.registrations.note")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{registration.note}</p>
              </CardContent>
            </Card>
          )}

          {/* Add Payment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t("admin.registrations.addPayment")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="paymentAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={t("admin.registrations.enterAmount")}
                    disabled={isSubmitting}
                    className="h-9"
                  />
                </div>
                <Button 
                  onClick={handleAddPayment}
                  disabled={isSubmitting || !paymentAmount}
                  size="sm"
                >
                  {isSubmitting ? "..." : t("admin.registrations.addPaymentButton")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
