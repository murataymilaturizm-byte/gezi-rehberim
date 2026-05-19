import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  agencyId: string;
  onTabChange: (tab: string) => void;
}

export function NotificationCenter({ agencyId, onTabChange }: NotificationCenterProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("admin_notifications")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(data || []);
  }, [agencyId]);

  useEffect(() => {
    if (!agencyId) return;
    load();

    // Realtime: yeni kayıtlar gelince notification oluştur
    const regChannel = supabase
      .channel(`notif-reg-${agencyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "registrations", filter: `agency_id=eq.${agencyId}` },
        async (payload) => {
          const reg = payload.new as any;

          // DB'ye kaydet
          const { data: notif } = await (supabase as any)
            .from("admin_notifications")
            .insert({
              agency_id: agencyId,
              type: "new_reservation",
              title: `🎉 ${t("notifications.newReservation")}: ${reg.full_name || "—"}`,
              description: `${reg.pax} ${t("admin.tours.people", { defaultValue: "kişi" })} · ${reg.phone || ""}`,
              metadata: { registration_id: reg.id },
            })
            .select()
            .single();

          if (notif) {
            setNotifications((prev) => [notif, ...prev]);
          }

          // Browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            const bn = new Notification(`🎉 ${t("notifications.newReservation")}`, {
              body: `${reg.full_name || "Müşteri"} · ${reg.pax} kişi`,
              icon: "/favicon.ico",
              tag: "new-reservation",
            });
            bn.onclick = () => { window.focus(); onTabChange("registrations"); };
          }

          // Toast
          toast({
            title: `🎉 ${t("notifications.newReservation")}`,
            description: `${reg.full_name || "—"} · ${reg.pax} kişi`,
          });
        }
      )
      .subscribe();

    // Realtime: notifications tablosu güncellenince yenile
    const notifChannel = supabase
      .channel(`notif-table-${agencyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications", filter: `agency_id=eq.${agencyId}` },
        () => load()
      )
      .subscribe();

    // Browser permission isteği
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      regChannel.unsubscribe();
      notifChannel.unsubscribe();
    };
  }, [agencyId, load, t, toast, onTabChange]);

  const markAsRead = async (id: string) => {
    await (supabase as any)
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    await (supabase as any)
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("agency_id", agencyId)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.type === "new_reservation" || n.type === "cancellation") onTabChange("registrations");
    else if (n.type === "message") onTabChange("whatsapp");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          {unreadCount > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] leading-none"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">{t("notifications.title")}</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={markAllAsRead}>
              <CheckCheck className="h-3 w-3 mr-1" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-7 w-7 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-xs text-muted-foreground">{t("notifications.empty")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-2 p-3 cursor-pointer hover:bg-muted/40 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                >
                  {!n.is_read && (
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                  <div className={`flex-1 min-w-0 ${n.is_read ? "pl-4" : ""}`}>
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    {n.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {new Date(n.created_at).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
