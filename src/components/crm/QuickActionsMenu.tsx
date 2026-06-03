// QuickActionsMenu — CRM detay üst başlığa eklenir, seçili müşteri için
// 5 GERÇEK çalışan aksiyon. Yarım/hayali aksiyon yok — her menü öğesi
// ya DB'ye yazar, ya gerçek bir URL açar, ya da panele yönlendirir.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Pause,
  Play,
  Phone,
  MessageCircle,
  Copy,
  FileText,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  profileId: string;
  phone: string;
  agencyId: string;
  isBotPaused: boolean;
  fullName: string | null;
  onBotPauseChange: (next: { paused: boolean; until: string | null }) => void;
}

// Bot pause süresi — WhatsAppConversations.tsx ile aynı pattern (24 saat)
const BOT_PAUSE_DURATION_MS = 24 * 60 * 60 * 1000;

const normalizePhoneForWA = (phone: string): string => {
  return phone.replace(/[^\d]/g, "");
};

export const QuickActionsMenu = ({
  profileId,
  phone,
  agencyId,
  isBotPaused,
  fullName,
  onBotPauseChange,
}: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [botToggleLoading, setBotToggleLoading] = useState(false);

  const handleBotToggle = async () => {
    setBotToggleLoading(true);
    try {
      const newPaused = !isBotPaused;
      const until = newPaused
        ? new Date(Date.now() + BOT_PAUSE_DURATION_MS).toISOString()
        : null;

      const { error } = await supabase
        .from("whatsapp_user_profiles")
        .update({ bot_paused: newPaused, bot_paused_until: until })
        .eq("id", profileId)
        .eq("agency_id", agencyId);

      if (error) throw error;

      onBotPauseChange({ paused: newPaused, until });
      toast({
        title: newPaused
          ? t("admin.whatsapp.userProfiles.actions.botPausedToast")
          : t("admin.whatsapp.userProfiles.actions.botResumedToast"),
        description: newPaused
          ? t("admin.whatsapp.userProfiles.actions.botPausedDesc", { defaultValue: "Bot 24 saat boyunca bu müşteriye yanıt vermeyecek." })
          : undefined,
      });
    } catch (err) {
      console.error("[crm bot-toggle]", err);
      toast({
        title: t("common.error"),
        description: t("common.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setBotToggleLoading(false);
    }
  };

  const handleCallPhone = () => {
    const tel = `tel:${phone.replace(/[^\d+]/g, "")}`;
    window.location.href = tel;
  };

  const handleOpenWhatsApp = () => {
    const waNumber = normalizePhoneForWA(phone);
    if (!waNumber) {
      toast({
        title: t("common.error"),
        description: t("admin.whatsapp.userProfiles.actions.invalidPhone", {
          defaultValue: "Geçersiz telefon numarası.",
        }),
        variant: "destructive",
      });
      return;
    }
    window.open(`https://wa.me/${waNumber}`, "_blank", "noopener,noreferrer");
  };

  const handleCopyContact = async () => {
    const text = fullName
      ? `${fullName} — ${phone}`
      : phone;
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: t("admin.whatsapp.userProfiles.actions.copied", { defaultValue: "Kopyalandı" }),
        description: text,
      });
    } catch {
      toast({
        title: t("common.error"),
        description: t("admin.whatsapp.userProfiles.actions.copyFailed", { defaultValue: "Kopyalanamadı." }),
        variant: "destructive",
      });
    }
  };

  const handleOpenTemplates = () => {
    // Mevcut admin paneline yönlendir, Mesaj Şablonları sekmesini aç
    window.location.href = "/admin?tab=templates";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label={t("admin.whatsapp.userProfiles.actions.menuLabel", { defaultValue: "Hızlı aksiyonlar" })}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleBotToggle} disabled={botToggleLoading}>
          {botToggleLoading ? (
            <Loader2 className="w-4 h-4 me-2 animate-spin" />
          ) : isBotPaused ? (
            <Play className="w-4 h-4 me-2 text-emerald-600" />
          ) : (
            <Pause className="w-4 h-4 me-2 text-orange-600" />
          )}
          {isBotPaused
            ? t("admin.whatsapp.userProfiles.actions.resumeBot")
            : t("admin.whatsapp.userProfiles.actions.pauseBot")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleOpenWhatsApp}>
          <MessageCircle className="w-4 h-4 me-2 text-emerald-600" />
          {t("admin.whatsapp.userProfiles.actions.openWhatsApp")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCallPhone}>
          <Phone className="w-4 h-4 me-2 text-primary" />
          {t("admin.whatsapp.userProfiles.actions.callPhone")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyContact}>
          <Copy className="w-4 h-4 me-2" />
          {t("admin.whatsapp.userProfiles.actions.copyContact")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleOpenTemplates}>
          <FileText className="w-4 h-4 me-2 text-blue-600" />
          {t("admin.whatsapp.userProfiles.actions.openTemplates")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
