// P5-1b + P5-2c (2026-07-28): Süper-admin — ödeme talepleri onayı + süresi kritik acenteler.
// Onay ATOMİK RPC ile (approve_payment_request): uzatma MAX-KURALI + plan + status + bildirim
// tek-yerde (DB). Panel yalnız çağırır — kural client'ta TEKRARLANMAZ.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CreditCard, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { daysLeftUtc, packageEndDate, expiryTier } from "@/lib/subscription-days";

interface PayReq {
  id: string; agency_id: string; plan: string; amount: number | null;
  period: string; reference_code: string; status: string; created_at: string;
  agencies?: { name: string } | null;
}
interface AgencyRow {
  id: string; name: string; plan_type: string; subscription_status: string;
  trial_ends_at: string | null; subscription_ends_at: string | null;
}

export const SuperAdminPayments = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [reqs, setReqs] = useState<PayReq[]>([]);
  const [expiring, setExpiring] = useState<Array<AgencyRow & { days: number }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: prs } = await (supabase as any)
      .from("payment_requests")
      .select("*, agencies(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setReqs((prs || []) as PayReq[]);

    const { data: ags } = await (supabase as any)
      .from("agencies")
      .select("id, name, plan_type, subscription_status, trial_ends_at, subscription_ends_at")
      .eq("active", true);
    const rows = ((ags || []) as AgencyRow[])
      .map((a) => ({ ...a, days: daysLeftUtc(packageEndDate(a)) }))
      .filter((a): a is AgencyRow & { days: number } => a.days !== null)
      .filter((a) => a.days <= 7) // P5-1b: 7-güne girmiş VEYA süresi geçmiş
      .sort((a, b) => a.days - b.days);
    setExpiring(rows);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setBusy(id);
    const { data, error } = await (supabase as any).rpc("approve_payment_request", { p_request_id: id });
    setBusy(null);
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    toast({
      title: t("superPayments.approved"),
      description: data?.new_ends_at ? format(new Date(data.new_ends_at), "dd.MM.yyyy") : undefined,
    });
    load();
  };
  const reject = async (id: string) => {
    setBusy(id);
    const { error } = await (supabase as any).from("payment_requests").update({ status: "rejected" }).eq("id", id);
    setBusy(null);
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    load();
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />{t("superPayments.pendingTitle")}
            {reqs.length > 0 && <Badge className="bg-red-600 text-white">{reqs.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reqs.length === 0
            ? <p className="text-sm text-muted-foreground">{t("superPayments.noPending")}</p>
            : reqs.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.agencies?.name || r.agency_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.plan} · {t(`superPayments.period.${r.period}`)} · {r.amount ? `${Number(r.amount).toLocaleString("tr-TR")}₺` : "—"} · <span className="font-mono">{r.reference_code}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), "dd.MM.yyyy HH:mm")}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" disabled={busy === r.id} onClick={() => approve(r.id)}>
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                    {t("superPayments.approve")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => reject(r.id)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" />{t("superPayments.reject")}
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />{t("superPayments.expiringTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {expiring.length === 0
            ? <p className="text-sm text-muted-foreground">{t("superPayments.noExpiring")}</p>
            : expiring.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.plan_type} · {a.subscription_status} · {packageEndDate(a) ? format(new Date(packageEndDate(a)!), "dd.MM.yyyy") : "—"}
                  </p>
                </div>
                <Badge className={expiryTier(a.days) === "past" ? "bg-gray-700 text-white" : "bg-red-600 text-white"}>
                  {a.days < 0 ? t("admin.subscription.expiredBadge") : a.days === 0 ? t("admin.subscription.lastDay") : t("admin.subscription.daysLeftBadge", { count: a.days })}
                </Badge>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
};
