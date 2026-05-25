// CentralSendLog.tsx — Turzz merkezi WhatsApp gönderim dökümü
// template_send_log WHERE agency_id = TURZZ_CENTRAL_AGENCY_ID
// Super_admin RLS (template_send_log_super_admin_read) zaten erişim veriyor.

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TURZZ_CENTRAL_AGENCY_ID, CENTRAL_EVENT_TYPES } from "@/lib/centralAgency";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, ScrollText, Check, X } from "lucide-react";

interface SendLogRow {
  id: string;
  template_type: string;
  language: string;
  recipient_phone: string;
  recipient_name: string | null;
  success: boolean;
  error_message: string | null;
  sent_at: string;
}

const PAGE_SIZE = 50;

export default function CentralSendLog() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [rows, setRows] = useState<SendLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "fail">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // (supabase as any): zincirlemeli .eq() Supabase generated types ile
      // "type instantiation excessively deep" hatası veriyor — runtime sağlam.
      let query: any = (supabase as any)
        .from("template_send_log")
        .select("id, template_type, language, recipient_phone, recipient_name, success, error_message, sent_at")
        .eq("agency_id", TURZZ_CENTRAL_AGENCY_ID)
        .order("sent_at", { ascending: false })
        .limit(PAGE_SIZE);

      // template_type'ta event_type (mapping'ten) veya template_key (manuel test) tutuluyor.
      // event filter için template_type'a göre filtrele.
      if (eventFilter !== "all") {
        query = query.eq("template_type", eventFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("success", statusFilter === "success");
      }
      const { data, error } = await query;
      if (error) throw error;
      setRows((data as SendLogRow[]) || []);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [eventFilter, statusFilter, toast, t]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(i18n.language || "tr");
    } catch { return iso; }
  };

  // template_type için kullanıcı dostu etiket — bilinen event_type ise çevir, yoksa olduğu gibi.
  const labelForType = (type: string) =>
    CENTRAL_EVENT_TYPES.includes(type as any)
      ? t(`admin.central.events.${type}`, { defaultValue: type })
      : type;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ScrollText className="h-5 w-5 text-primary" />
          {t("admin.central.sendLog.title", { defaultValue: "Bildirim Dökümü" })}
        </CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t("admin.central.sendLog.description", {
            defaultValue:
              "Turzz merkezi WABA üzerinden gönderilen tüm bildirimlerin kaydı. Son 50 kayıt gösterilir.",
          })}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("admin.central.sendLog.filterEvent", { defaultValue: "Olay" })}:
            </span>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all", { defaultValue: "Tümü" })}</SelectItem>
                {CENTRAL_EVENT_TYPES.map((et) => (
                  <SelectItem key={et} value={et}>{labelForType(et)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("admin.central.sendLog.filterStatus", { defaultValue: "Durum" })}:
            </span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all", { defaultValue: "Tümü" })}</SelectItem>
                <SelectItem value="success">{t("admin.central.sendLog.statusSuccess", { defaultValue: "Başarılı" })}</SelectItem>
                <SelectItem value="fail">{t("admin.central.sendLog.statusFail", { defaultValue: "Başarısız" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="ml-auto">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh", { defaultValue: "Yenile" })}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {t("admin.central.sendLog.empty", { defaultValue: "Kayıt yok." })}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.central.sendLog.col.sentAt", { defaultValue: "Zaman" })}</TableHead>
                  <TableHead>{t("admin.central.sendLog.col.type", { defaultValue: "Tip" })}</TableHead>
                  <TableHead>{t("admin.central.sendLog.col.lang", { defaultValue: "Dil" })}</TableHead>
                  <TableHead>{t("admin.central.sendLog.col.recipient", { defaultValue: "Alıcı" })}</TableHead>
                  <TableHead>{t("admin.central.sendLog.col.status", { defaultValue: "Durum" })}</TableHead>
                  <TableHead>{t("admin.central.sendLog.col.error", { defaultValue: "Hata" })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.sent_at)}</TableCell>
                    <TableCell className="text-xs">{labelForType(r.template_type)}</TableCell>
                    <TableCell className="text-xs uppercase">{r.language}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        {r.recipient_name && <span>{r.recipient_name}</span>}
                        <code className="text-[10px] text-muted-foreground">{r.recipient_phone}</code>
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.success ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                          <Check className="h-3 w-3" />
                          {t("admin.central.sendLog.statusSuccess", { defaultValue: "Başarılı" })}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <X className="h-3 w-3" />
                          {t("admin.central.sendLog.statusFail", { defaultValue: "Başarısız" })}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[280px] truncate" title={r.error_message || ""}>
                      {r.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
