import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { tr as trLocale, enUS, de, ru, ar, fr, es } from "date-fns/locale";

const DATE_LOCALE_MAP = { tr: trLocale, en: enUS, de, ru, ar, fr, es };
import { User, Phone, Users, Calendar, MapPin, CreditCard, Wallet, DollarSign, Receipt, Trash2, MessageCircle } from "lucide-react";
import { formatPrice } from "@/utils/currency";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
// K4: TEK finansal kaynak — bot/template/admin/dashboard hepsi aynı helper kullanır.
import { calculateTotal, calculateRemaining, isOverpayment } from "@/lib/finance";

interface PaymentHistory {
  id: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  note?: string;
}

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
    currency?: string;
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

// PAYMENT_METHOD_LABELS now uses t() inside the component

export const RegistrationDetailDialog = ({
  open,
  onOpenChange,
  registration,
  onSuccess
}: RegistrationDetailDialogProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || trLocale;
  const currency = registration?.tours?.currency || 'TRY';
  const fmt = (amount: number) => formatPrice(amount, currency, { showCode: false });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [editablePhone, setEditablePhone] = useState("");
  const [editableStatus, setEditableStatus] = useState("");
  const [editablePaymentStatus, setEditablePaymentStatus] = useState("");
  const [currentPaidAmount, setCurrentPaidAmount] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (open && registration?.id) {
      loadPaymentHistory();
      setEditablePhone(registration.phone || "");
      setEditableStatus(registration.status || "NEW");
      setEditablePaymentStatus(registration.payment_status || "UNPAID");
      setCurrentPaidAmount(registration.paid_amount || 0);
    }
  }, [open, registration]);

  const loadPaymentHistory = async () => {
    if (!registration?.id) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("registration_payments")
        .select("*")
        .eq("registration_id", registration.id)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      setPaymentHistory(data || []);
    } catch (error) {
      console.error("Payment history load error:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!registration) return null;

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CREDIT_CARD: t("registration.paymentMethods.creditCard"),
    CASH: t("registration.paymentMethods.cash"),
    BANK_TRANSFER: t("registration.paymentMethods.transfer"),
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

  const statusLabels: Record<string, string> = {
    NEW: t("admin.status.new"),
    PENDING: t("admin.status.pending"),
    CONFIRMED: t("admin.status.confirmed"),
    CANCELLED: t("admin.status.cancelled")
  };

  // K3 + K4: DB snapshot total_amount varsa onu kullan, yoksa merkezi calculateTotal.
  // K4: calculateRemaining → Math.max(0, ...) — negatif gösterilmez.
  const totalAmount = (registration.total_amount && registration.total_amount > 0)
    ? registration.total_amount
    : calculateTotal(registration.pax, registration.tour_dates?.price_adult);
  const paidAmount = currentPaidAmount;
  const remainingAmount = calculateRemaining(totalAmount, paidAmount);
  // K2: Aşırı ödeme tespiti — UI badge için, hesap negatife düşmez.
  const hasOverpayment = isOverpayment(totalAmount, paidAmount);

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

    if (!paymentMethod) {
      toast({
        title: t("common.error"),
        description: t("registration.paymentSelectMethod"),
        variant: "destructive"
      });
      return;
    }

    // K2: Aşırı ödeme koruması — toplam tutarı aşarsa kullanıcıya onay sor.
    // Daha önce çift kayıt riski vardı (aynı dekont iki kez girilirse paid_amount > total_amount).
    const _projectedPaid = paidAmount + amount;
    if (isOverpayment(totalAmount, _projectedPaid)) {
      const _diff = _projectedPaid - totalAmount;
      const _confirmMsg = t("admin.registrations.overpaymentConfirm", {
        diff: fmt(_diff),
        total: fmt(totalAmount),
        paid: fmt(_projectedPaid),
        defaultValue: "Bu ödeme toplam tutarı {{diff}} aşıyor (Toplam: {{total}}, Toplam ödenecek: {{paid}}). Yine de kaydedilsin mi?",
      });
      if (!window.confirm(_confirmMsg)) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const newPaidAmount = _projectedPaid;
      let newPaymentStatus = editablePaymentStatus;

      if (totalAmount && newPaidAmount >= totalAmount) {
        newPaymentStatus = "PAID";
      } else if (newPaidAmount > 0) {
        newPaymentStatus = "DEPOSIT";
      }

      const { error: paymentError } = await supabase
        .from("registration_payments")
        .insert({
          registration_id: registration.id,
          amount: amount,
          payment_method: paymentMethod,
          payment_date: new Date().toISOString(),
          note: `${PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod} ile ${fmt(amount)} ödeme`
        });

      if (paymentError) throw paymentError;

      const { error: updateError } = await supabase
        .from("registrations")
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus
        })
        .eq("id", registration.id);

      if (updateError) throw updateError;

      setEditablePaymentStatus(newPaymentStatus);
      setCurrentPaidAmount(newPaidAmount);

      toast({
        title: t("admin.registrations.paymentSuccess"),
        description: `${fmt(amount)} ${t("registration.paymentAdded")}`
      });

      setPaymentAmount("");
      setPaymentMethod("");
      await loadPaymentHistory();
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

  const handleDeletePayment = async (paymentId: string, amount: number) => {
    try {
      const { error: deleteError } = await supabase
        .from("registration_payments")
        .delete()
        .eq("id", paymentId);

      if (deleteError) throw deleteError;

      const newPaidAmount = Math.max(0, paidAmount - amount);
      let newPaymentStatus = "UNPAID";
      if (totalAmount && newPaidAmount >= totalAmount) {
        newPaymentStatus = "PAID";
      } else if (newPaidAmount > 0) {
        newPaymentStatus = "DEPOSIT";
      }

      const { error: updateError } = await supabase
        .from("registrations")
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus
        })
        .eq("id", registration.id);

      if (updateError) throw updateError;

      setCurrentPaidAmount(newPaidAmount);
      setEditablePaymentStatus(newPaymentStatus);

      toast({ title: t("common.success"), description: t("registration.paymentRemoved") });
      await loadPaymentHistory();
      onSuccess();
    } catch (error) {
      console.error("Delete payment error:", error);
      toast({ title: t("common.error"), description: t("registration.paymentRemoveError"), variant: "destructive" });
    }
  };

  const handleUpdateField = async (field: string, value: string) => {
    setIsUpdating(true);
    try {
      const updateData: Record<string, any> = { [field]: value };

      // When payment_status changes, sync paid_amount accordingly
      if (field === "payment_status") {
        if (value === "PAID") {
          // Guard: totalAmount undefined/NaN → 0'a düş, DB'ye NaN gitmesin
          const _safeTotal = Number.isFinite(totalAmount) && totalAmount > 0 ? totalAmount : 0;
          // Mark as fully paid - create a payment record for the full amount if no payments exist
          updateData.paid_amount = _safeTotal;
          setCurrentPaidAmount(_safeTotal);

          // Check if there are existing payments
          if (paymentHistory.length === 0 && _safeTotal > 0) {
            // Auto-create a payment record for the full amount
            await supabase.from("registration_payments").insert({
              registration_id: registration.id,
              amount: _safeTotal,
              payment_method: "CASH",
              payment_date: new Date().toISOString(),
              note: "Tam ödeme (durum değişikliği ile)"
            });
          }
        } else if (value === "UNPAID") {
          // Reset paid amount to 0 and clear payment records
          updateData.paid_amount = 0;
          updateData.deposit_amount = null;
          setCurrentPaidAmount(0);
        }
        // DEPOSIT keeps current paid_amount as is
      }

      const { error } = await supabase
        .from("registrations")
        .update(updateData)
        .eq("id", registration.id);

      if (error) throw error;

      toast({ title: t("common.success"), description: t("registration.updateSuccess") });
      await loadPaymentHistory();
      onSuccess();
    } catch (error) {
      console.error("Update error:", error);
      toast({ title: t("common.error"), description: t("registration.updateError"), variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t("admin.registrations.detailTitle")}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-base flex-wrap">
            <span>{registration.full_name} • {registration.phone}</span>
            {(() => {
              const waUrl = buildWhatsAppUrl(registration.phone);
              return waUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/5"
                  asChild
                >
                  <a href={waUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-3.5 h-3.5 mr-1" />
                    {t("common.openWhatsApp")}
                  </a>
                </Button>
              ) : null;
            })()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                    ? format(new Date(registration.tour_dates.departure_date), "d MMM yyyy", { locale: dateLocale })
                    : '-'}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <Users className="h-3 w-3" />
                  <span>{registration.pax} kişi</span>
                  <span className="text-muted-foreground">•</span>
                  <span>{fmt((registration.tour_dates?.price_adult || 0))}/kişi</span>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  İletişim
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">İsim</p>
                  <p className="font-medium text-sm">{registration.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Telefon</p>
                  <div className="flex gap-1.5">
                    <Input
                      value={editablePhone}
                      onChange={(e) => setEditablePhone(e.target.value)}
                      onBlur={() => {
                        if (editablePhone !== registration.phone) {
                          handleUpdateField("phone", editablePhone);
                        }
                      }}
                      className="h-7 text-xs flex-1"
                      disabled={isUpdating}
                    />
                    <a 
                      href={`tel:${editablePhone}`} 
                      className="text-primary hover:underline text-xs flex items-center"
                    >
                      Ara
                    </a>
                  </div>
                </div>
                {registration.note && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground line-clamp-1" title={registration.note}>
                      📝 {registration.note}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Durum</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Kayıt Durumu</Label>
                  <Select 
                    value={editableStatus} 
                    onValueChange={(value) => {
                      setEditableStatus(value);
                      handleUpdateField("status", value);
                    }}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">{statusLabels.NEW}</SelectItem>
                      <SelectItem value="PENDING">{statusLabels.PENDING}</SelectItem>
                      <SelectItem value="CONFIRMED">{statusLabels.CONFIRMED}</SelectItem>
                      <SelectItem value="CANCELLED">{statusLabels.CANCELLED}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Ödeme Durumu</Label>
                  <Select 
                    value={editablePaymentStatus} 
                    onValueChange={(value) => {
                      setEditablePaymentStatus(value);
                      handleUpdateField("payment_status", value);
                    }}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNPAID">{paymentStatusLabels.UNPAID}</SelectItem>
                      <SelectItem value="DEPOSIT">{paymentStatusLabels.DEPOSIT}</SelectItem>
                      <SelectItem value="PAID">{paymentStatusLabels.PAID}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Kaynak</Label>
                  <Badge variant="secondary" className="text-xs">
                    {sourceChannelLabels[registration.source_channel || 'WHATSAPP']}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Summary */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {t("admin.registrations.paymentInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Birim Fiyat</p>
                  <p className="font-medium text-base">{fmt((registration.tour_dates?.price_adult || 0))}</p>
                  <p className="text-xs text-muted-foreground">{registration.pax} kişi</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("admin.registrations.totalAmount")}</p>
                  <p className="font-semibold text-lg text-primary">{fmt(totalAmount)}</p>
                </div>
                {registration.deposit_amount && registration.deposit_amount > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t("admin.registrations.depositAmount")}</p>
                    <p className="font-medium text-blue-600">{fmt(registration.deposit_amount)}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("admin.registrations.paidAmount")}</p>
                  <p className="font-medium text-green-600">{fmt(paidAmount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("admin.registrations.remainingAmount")}</p>
                  <p className={`font-bold text-xl ${remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {fmt(remainingAmount)}
                  </p>
                  {/* K2: Aşırı ödeme rozeti — negatif sayı yerine açık etiket */}
                  {hasOverpayment && (
                    <Badge variant="destructive" className="text-[10px] h-5 mt-1">
                      {t("admin.registrations.overpaid", {
                        amount: fmt(paidAmount - totalAmount),
                        defaultValue: "Fazla ödeme: {{amount}}",
                      })}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment History & Add Payment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Ödeme İşlemleri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Payment Form */}
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="Ödeme tutarı..."
                      disabled={isSubmitting}
                      className="h-9"
                    />
                  </div>
                  <div className="w-40">
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Ödeme yöntemi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CREDIT_CARD">💳 Kredi Kartı</SelectItem>
                        <SelectItem value="CASH">💵 Nakit</SelectItem>
                        <SelectItem value="BANK_TRANSFER">🏦 Havale/EFT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleAddPayment}
                    disabled={isSubmitting || !paymentAmount || !paymentMethod}
                    size="sm"
                    className="px-6"
                  >
                    {isSubmitting ? "..." : "Ödeme Ekle"}
                  </Button>
                </div>
              </div>

              {/* Payment History */}
              {paymentHistory.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Geçmiş Ödemeler</p>
                  {paymentHistory.map((payment) => (
                    <div 
                      key={payment.id} 
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {fmt(payment.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(payment.payment_date), "d MMMM yyyy, HH:mm", { locale: dateLocale })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {payment.payment_method && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                          </Badge>
                        )}
                        {payment.note && (
                          <p className="text-[10px] text-muted-foreground max-w-[120px] truncate hidden sm:block" title={payment.note}>
                            {payment.note}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => handleDeletePayment(payment.id, payment.amount)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

