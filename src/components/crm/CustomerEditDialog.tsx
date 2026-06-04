// CustomerEditDialog — acente full_name + email düzenler.
// RLS "FOR ALL" policy yeterli (agency_id match). Bot-ezme koruması
// profile.ts'te "sadece boşsa yaz" mantığı ile yapıldı; burada
// acente serbestçe override eder.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Save, User, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const EmailSchema = z.string().email().max(255).optional().or(z.literal(""));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  agencyId: string;
  initialFullName: string | null;
  initialEmail: string | null;
  onSaved: (updates: { full_name: string | null; email: string | null }) => void;
}

export const CustomerEditDialog = ({
  open,
  onOpenChange,
  profileId,
  agencyId,
  initialFullName,
  initialEmail,
  onSaved,
}: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(initialFullName || "");
  const [email, setEmail] = useState(initialEmail || "");
  const [saving, setSaving] = useState(false);

  // Dialog açıldıkça/profil değişince state'i tazele
  useEffect(() => {
    if (open) {
      setFullName(initialFullName || "");
      setEmail(initialEmail || "");
    }
  }, [open, initialFullName, initialEmail, profileId]);

  const handleSave = async () => {
    // Validation
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedEmail.length > 0) {
      const parsed = EmailSchema.safeParse(trimmedEmail);
      if (!parsed.success) {
        toast({
          title: t("admin.whatsapp.userProfiles.edit.invalidEmail"),
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const updates = {
        full_name: trimmedName.length > 0 ? trimmedName.slice(0, 200) : null,
        email: trimmedEmail.length > 0 ? trimmedEmail : null,
      };
      const { error } = await supabase
        .from("whatsapp_user_profiles")
        .update(updates)
        .eq("id", profileId)
        .eq("agency_id", agencyId);
      if (error) throw error;

      onSaved(updates);
      toast({ title: t("admin.whatsapp.userProfiles.edit.savedToast") });
      onOpenChange(false);
    } catch (err) {
      console.error("[crm customer-edit]", err);
      toast({
        title: t("common.error"),
        description: t("common.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>{t("admin.whatsapp.userProfiles.edit.title")}</DialogTitle>
          <DialogDescription>{t("admin.whatsapp.userProfiles.edit.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-fullname" className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              {t("admin.whatsapp.userProfiles.edit.fullNameLabel")}
            </Label>
            <Input
              id="edit-fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={200}
              placeholder={t("admin.whatsapp.userProfiles.edit.fullNamePlaceholder", {
                defaultValue: "Müşterinin tam adı",
              })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email" className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              {t("admin.whatsapp.userProfiles.edit.emailLabel")}
            </Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="ornek@email.com"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("admin.whatsapp.userProfiles.edit.emailHint", {
                defaultValue: "Boş bırakırsanız kaldırılır.",
              })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-ocean hover:opacity-90">
            {saving ? (
              <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 me-1.5" />
            )}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
