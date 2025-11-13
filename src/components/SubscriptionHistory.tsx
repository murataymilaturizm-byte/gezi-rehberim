import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard, 
  TrendingUp,
  Calendar,
  Ban
} from "lucide-react";

interface SubscriptionHistoryItem {
  id: string;
  event_type: string;
  plan_type: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const eventTypeLabels: Record<string, string> = {
  trial_started: "Deneme Başladı",
  trial_ended: "Deneme Bitti",
  payment_success: "Ödeme Başarılı",
  payment_failed: "Ödeme Başarısız",
  plan_changed: "Plan Değişti",
  subscription_activated: "Abonelik Aktif",
  subscription_expired: "Abonelik Süresi Doldu",
  subscription_cancelled: "Abonelik İptal"
};

const statusLabels: Record<string, string> = {
  success: "Başarılı",
  failed: "Başarısız",
  pending: "Beklemede",
  cancelled: "İptal"
};

const planLabels: Record<string, string> = {
  starter: "Başlangıç",
  professional: "Profesyonel",
  enterprise: "Kurumsal"
};

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case "trial_started":
    case "subscription_activated":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "payment_success":
      return <CreditCard className="h-4 w-4 text-green-600" />;
    case "payment_failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "plan_changed":
      return <TrendingUp className="h-4 w-4 text-primary" />;
    case "trial_ended":
    case "subscription_expired":
      return <Calendar className="h-4 w-4 text-muted-foreground" />;
    case "subscription_cancelled":
      return <Ban className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "success":
      return <Badge variant="default" className="bg-green-600">{statusLabels[status]}</Badge>;
    case "failed":
      return <Badge variant="destructive">{statusLabels[status]}</Badge>;
    case "pending":
      return <Badge variant="secondary">{statusLabels[status]}</Badge>;
    case "cancelled":
      return <Badge variant="outline">{statusLabels[status]}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const SubscriptionHistory = () => {
  const [history, setHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's agency
      const { data: agencyData, error: agencyError } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (agencyError) throw agencyError;
      if (!agencyData) return;

      setAgencyId(agencyData.id);

      // Load subscription history
      const { data: historyData, error: historyError } = await supabase
        .from("subscription_history")
        .select("*")
        .eq("agency_id", agencyData.id)
        .order("created_at", { ascending: false });

      if (historyError) throw historyError;

      setHistory(historyData || []);
    } catch (error) {
      console.error("Error loading subscription history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Abonelik Geçmişi</CardTitle>
            <CardDescription>
              Ödeme geçmişiniz, plan değişiklikleriniz ve abonelik durumunuz
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-foreground font-medium">Henüz işlem geçmişi yok</p>
              <p className="text-sm text-muted-foreground">
                Ödemeler, plan değişiklikleri ve diğer işlemler burada görünecek
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>İşlem</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlem No</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {format(new Date(item.created_at), "d MMM yyyy, HH:mm", { locale: tr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEventIcon(item.event_type)}
                        <span className="text-sm font-medium">
                          {eventTypeLabels[item.event_type] || item.event_type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.plan_type ? (
                        <Badge variant="outline">
                          {planLabels[item.plan_type] || item.plan_type}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(item.amount, item.currency)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {item.transaction_id || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-start gap-3 text-sm">
              <div className="flex-1 space-y-2">
                <p className="font-medium text-foreground">Fatura ve Dekont</p>
                <p className="text-muted-foreground">
                  Ödeme dekontlarınızı ve faturalarınızı email adresinize gönderiyoruz.
                  Geçmiş faturalar için destek ekibimizle iletişime geçebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
