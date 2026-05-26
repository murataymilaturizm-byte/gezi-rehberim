// AgencyNotificationSettings.tsx — Acente WhatsApp bildirim ayarları + geçmiş.
//
// Acente, Turzz'un merkezi numarasından "yeni rezervasyonunuz var" / "yeni talep" mesajı alır.
// Bu component agency_notification_settings tablosuna UPSERT yapar (RLS: kendi satırı)
// ve template_send_log'tan kendi bildirim geçmişini gösterir (RLS otomatik agency_id filter).
//
// WhatsAppConversations.tsx → "Bildirim Ayarları" sub-tab'ı içinde render edilir
// (sadece acente görünümünde — !isSuperAdmin).

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bell, Loader2, Save, ScrollText, Check, X, AlertCircle,
} from "lucide-react";

interface NotificationSettings {
  agency_id: string;
  phone: string;
  enabled: boolean;
  notify_new_reservation: boolean;
  notify_support: boolean;
}

interface SendLogRow {
  id: string;
  template_type: string;
  language: string;
  recipient_phone: string;
  success: boolean;
  error_message: string | null;
  sent_at: string;
}

const HISTORY_LIMIT = 50;
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function eventLabel(type: string, t: any): string {
  if (type === "agency_new_reservation") {
    return t("agency.notifications.events.new_reservation", { defaultValue: "Yeni Rezervasyon" });
  }
  if (type === "agency_new_support") {
    return t("agency.notifications.events.new_support", { defaultValue: "Talep/Şikayet" });
  }
  return type;
}

export default function AgencyNotificationSettings() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  // Form state
  const [phone, setPhone] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [notifyNewReservation, setNotifyNewReservation] = useState(true);
  const [notifySupport, setNotifySupport] = useState(true);

  // History
  const [history, setHistory] = useState<SendLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const phoneOk = !phone || E164_REGEX.test(phone.trim());

  const loadAll = useCallback(async () => {
    setLoading(true);
    setHistoryLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setHistoryLoading(false);
        return;
      }

      // Acente kendi id'sini çek (WhatsAppSettings.tsx pattern'i ile aynı)
      const { data: agencyData, error: agencyErr } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (agencyErr) throw agencyErr;
      if (!agencyData) {
        setLoading(false);
        setHistoryLoading(false);
        return;
      }

      setAgencyId(agencyData.id);

      // Ayarları çek — yoksa default form değerleri kalır
      const { data: settings, error: settingsErr } = await (supabase as any)
        .from("agency_notification_settings")
        .select("agency_id, phone, enabled, notify_new_reservation, notify_support")
        .eq("agency_id", agencyData.id)
        .maybeSingle();

      if (settingsErr) {
        console.error("[agency-notifications] settings fetch:", settingsErr);
      } else if (settings) {
        const s = settings as NotificationSettings;
        setPhone(s.phone || "");
        setEnabled(!!s.enabled);
        setNotifyNewReservation(s.notify_new_reservation !== false);
        setNotifySupport(s.notify_support !== false);
      }
      setLoading(false);

      // Bildirim geçmişi (RLS otomatik agency_id=own; ekstra olarak 'agency_%' filtresi)
      const { data: logData, error: logErr } = await (supabase as any)
        .from("template_send_log")
        .select("id, template_type, language, recipient_phone, success, error_message, sent_at")
        .eq("agency_id", agencyData.id)
        .like("template_type", "agency_%")
        .order("sent_at", { ascending: false })
        .limit(HISTORY_LIMIT);

      if (logErr) {
        console.error("[agency-notifications] history fetch:", logErr);
      } else {
        setHistory((logData as SendLogRow[]) || []);
      }
      setHistoryLoading(false);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
      setLoading(false);
      setHistoryLoading(false);
    }
  }, [t, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSave = async () => {
    if (!agencyId) return;
    if (phone && !E164_REGEX.test(phone.trim())) {
      toast({
        title: t("common.error"),
        description: t("agency.notifications.invalidPhone", {
          defaultValue: "Telefon E.164 formatında olmalı (+ ülke kodu, sonra rakam).",
        }),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        agency_id: agencyId,
        phone: phone.trim() || null,
        enabled,
        notify_new_reservation: notifyNewReservation,
        notify_support: notifySupport,
      };

      const { error } = await (supabase as any)
        .from("agency_notification_settings")
        .upsert(payload, { onConflict: "agency_id" });

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("agency.notifications.saved", { defaultValue: "Bildirim ayarları kaydedildi." }),
      });
      // Geçmiş tekrar çekilmesin; gönderim olunca zaten yenisi gelir.
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(i18n.language || "tr"); }
    catch { return iso; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const togglesDisabled = !enabled;

  return (
    <div className="space-y-6">
      {/* ─── Ayarlar Kartı ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-primary" />
            {t("agency.notifications.title", { defaultValue: "Bildirim Ayarları" })}
          </CardTitle>
          <CardDescription>
            {t("agency.notifications.description", {
              defaultValue:
                "Turzz'un WhatsApp numarasından yeni rezervasyon ve talep/şikayet bildirimleri alın. Bildirim numaranızı ve hangi olayların gönderileceğini buradan yönetin.",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Genel aç/kapa */}
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="notif-enabled" className="text-sm font-medium cursor-pointer">
                {t("agency.notifications.enabledLabel", { defaultValue: "Bildirimleri aktif et" })}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("agency.notifications.enabledHint", {
                  defaultValue: "Kapalıyken hiçbir bildirim gönderilmez.",
                })}
              </p>
            </div>
            <Switch id="notif-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Telefon */}
          <div className="space-y-2">
            <Label htmlFor="notif-phone">
              {t("agency.notifications.phoneLabel", { defaultValue: "Bildirim Numarası" })}
            </Label>
            <Input
              id="notif-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+905XXXXXXXXX"
              className={!phoneOk ? "border-destructive" : ""}
            />
            {!phoneOk ? (
              <p className="text-xs text-destructive">
                {t("agency.notifications.invalidPhone", {
                  defaultValue: "Telefon E.164 formatında olmalı (+ ülke kodu, sonra rakam).",
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("agency.notifications.phoneHint", {
                  defaultValue: "WhatsApp uygulamanızın bağlı olduğu numarayı yazın (E.164: +90..., +49...).",
                })}
              </p>
            )}
          </div>

          {/* Event toggle'ları */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t("agency.notifications.eventsLabel", { defaultValue: "Bildirim Türleri" })}
            </Label>
            <div className={togglesDisabled ? "opacity-60 pointer-events-none" : ""}>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-reservation" className="text-sm font-medium cursor-pointer">
                    {t("agency.notifications.events.new_reservation", { defaultValue: "Yeni Rezervasyon" })}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("agency.notifications.eventReservationHint", {
                      defaultValue: "Sisteme yeni bir rezervasyon düştüğünde bildirim alın.",
                    })}
                  </p>
                </div>
                <Switch
                  id="notif-reservation"
                  checked={notifyNewReservation}
                  onCheckedChange={setNotifyNewReservation}
                  disabled={togglesDisabled}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3 mt-2">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-support" className="text-sm font-medium cursor-pointer">
                    {t("agency.notifications.events.new_support", { defaultValue: "Talep & Şikayet" })}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("agency.notifications.eventSupportHint", {
                      defaultValue: "Müşteri WhatsApp üzerinden talep/şikayet ilettiğinde bildirim alın.",
                    })}
                  </p>
                </div>
                <Switch
                  id="notif-support"
                  checked={notifySupport}
                  onCheckedChange={setNotifySupport}
                  disabled={togglesDisabled}
                />
              </div>
            </div>
          </div>

          {!enabled && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t("agency.notifications.disabledBanner", {
                  defaultValue: "Bildirimler kapalı. Açana kadar herhangi bir bildirim gönderilmez.",
                })}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !phoneOk || !agencyId}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {t("common.save", { defaultValue: "Kaydet" })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Bildirim Geçmişi ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-5 w-5 text-primary" />
            {t("agency.notifications.historyTitle", { defaultValue: "Bildirim Geçmişi" })}
          </CardTitle>
          <CardDescription>
            {t("agency.notifications.historyDescription", {
              defaultValue: "Size gönderilen son bildirimler. En fazla son 50 kayıt gösterilir.",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {t("agency.notifications.historyEmpty", {
                defaultValue: "Henüz bildirim gönderilmedi.",
              })}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("agency.notifications.col.sentAt", { defaultValue: "Zaman" })}
                    </TableHead>
                    <TableHead>
                      {t("agency.notifications.col.event", { defaultValue: "Olay" })}
                    </TableHead>
                    <TableHead>
                      {t("agency.notifications.col.phone", { defaultValue: "Numara" })}
                    </TableHead>
                    <TableHead>
                      {t("agency.notifications.col.status", { defaultValue: "Durum" })}
                    </TableHead>
                    <TableHead>
                      {t("agency.notifications.col.error", { defaultValue: "Hata" })}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.sent_at)}</TableCell>
                      <TableCell className="text-xs">{eventLabel(r.template_type, t)}</TableCell>
                      <TableCell className="text-xs">
                        <code className="text-[11px]">{r.recipient_phone}</code>
                      </TableCell>
                      <TableCell>
                        {r.success ? (
                          <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                            <Check className="h-3 w-3" />
                            {t("agency.notifications.statusSuccess", { defaultValue: "Başarılı" })}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <X className="h-3 w-3" />
                            {t("agency.notifications.statusFail", { defaultValue: "Başarısız" })}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-xs text-destructive max-w-[280px] truncate"
                        title={r.error_message || ""}
                      >
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
    </div>
  );
}
