// P4-3 (2026-07-28): TUR-DIŞI TALEPLER — Kayıtlar 4. görünüm (minimal liste).
// Bot detectOutOfScopeLead ile yakalar → agency_leads (RLS acente-izole).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Inbox, Phone, User } from "lucide-react";

interface Lead {
  id: string;
  phone: string | null;
  full_name: string | null;
  request_text: string;
  source_stage: string | null;
  status: "new" | "contacted" | "closed";
  created_at: string;
}

const STATUS_CLS: Record<Lead["status"], string> = {
  new: "bg-red-600 text-white",
  contacted: "bg-amber-500 text-white",
  closed: "bg-muted text-muted-foreground",
};

export const LeadsList = ({ agencyId }: { agencyId: string | null }) => {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = (supabase as any).from("agency_leads").select("*").order("created_at", { ascending: false }).limit(200);
    if (agencyId) q = q.eq("agency_id", agencyId);
    const { data, error } = await q;
    if (!error) setLeads((data || []) as Lead[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [agencyId]);

  const setStatus = async (id: string, status: Lead["status"]) => {
    await (supabase as any).from("agency_leads").update({ status }).eq("id", id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>;
  if (!leads.length)
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
        {t("admin.leads.empty")}
      </div>
    );

  return (
    <div className="space-y-2">
      {leads.map((l) => (
        <Card key={l.id} className={l.status === "new" ? "border-red-500/40" : undefined}>
          <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div className="min-w-0">
              <p className="text-sm break-words">{l.request_text}</p>
              <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span>{format(new Date(l.created_at), "dd.MM.yyyy HH:mm")}</span>
                {l.full_name && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{l.full_name}</span>}
                {l.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={STATUS_CLS[l.status]}>{t(`admin.leads.status.${l.status}`)}</Badge>
              {l.status === "new" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStatus(l.id, "contacted")}>
                  {t("admin.leads.markContacted")}
                </Button>
              )}
              {l.status === "contacted" && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStatus(l.id, "closed")}>
                  {t("admin.leads.markClosed")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
