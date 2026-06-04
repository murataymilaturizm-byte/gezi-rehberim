// NewCustomerDialog — acente CRM'e sıfırdan müşteri ekler.
//   • Telefon ZORUNLU — normalizePhoneForMeta() ile webhook formatına çevrilir
//     (çift kayıt garantisi: aynı kişi bota yazınca aynı profile düşer)
//   • DB phone GLOBAL UNIQUE — pre-check + INSERT catch
//   • Dup uyarısı GENERIC ("zaten kayıtlı") — hangi acente söylenmez (gizlilik)
//   • source='manual' yazılır; bot otomatik mesaj göndermez
//   • UI'da bilgi notu: ilk mesajı acente WhatsApp'tan başlatmalı
import { useState } from "react";
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
import { Loader2, UserPlus, Info, Phone, User, Mail, StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { normalizePhoneForMeta, formatPhoneDisplay } from "@/lib/phoneNormalize";

const EmailSchema = z.string().email().max(255).optional().or(z.literal(""));

interface CreatedProfile {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  notes: string | null;
  source: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  onCreated: (created: CreatedProfile) => void;
}

export const NewCustomerDialog = ({ open, onOpenChange, agencyId, onCreated }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [phoneRaw, setPhoneRaw] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const normalized = normalizePhoneForMeta(phoneRaw);
  const displayPreview = normalized ? formatPhoneDisplay(normalized) : "";

  const resetForm = () => {
    setPhoneRaw("");
    setFullName("");
    setEmail("");
    setNotes("");
  };

  const handleClose = (open: boolean) => {
    if (!open && !saving) resetForm();
    onOpenChange(open);
  };

  const handleCreate = async () => {
    // Telefon validation
    if (!normalized) {
      toast({
        title: t("admin.whatsapp.userProfiles.newCustomer.invalidPhone"),
        variant: "destructive",
      });
      return;
    }
    // Email validation (opsiyonel)
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
      // Pre-check: aynı telefon DB'de var mı (kendi acente görebildiği kadarıyla
      // — RLS başka acentenin kaydını gizler, ama UNIQUE constraint global olduğu
      // için INSERT yine de fail olur. Catch tarafı bu durumu yakalar.)
      const { data: existing, error: checkErr } = await supabase
        .from("whatsapp_user_profiles")
        .select("id")
        .eq("phone", normalized)
        .maybeSingle();

      if (checkErr) {
        // Beklenmeyen hata — devam etmiyoruz
        throw checkErr;
      }

      if (existing) {
        toast({
          title: t("admin.whatsapp.userProfiles.newCustomer.duplicate"),
          description: t("admin.whatsapp.userProfiles.newCustomer.duplicateDesc"),
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // INSERT
      const insertRow = {
        phone: normalized,
        agency_id: agencyId,
        full_name: fullName.trim().length > 0 ? fullName.trim().slice(0, 200) : null,
        email: trimmedEmail.length > 0 ? trimmedEmail : null,
        notes: notes.trim().length > 0 ? notes.trim().slice(0, 2000) : null,
        source: "manual",
        first_interaction_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString(),
        total_messages: 0,
      };

      const { data, error } = await supabase
        .from("whatsapp_user_profiles")
        // notes/source kolonları types.ts'te olmayabilir (yeni ALTER) — cast
        .insert(insertRow as never)
        .select("id, phone, full_name, email, notes, source")
        .single();

      if (error) {
        // UNIQUE violation (23505) — başka acentede aynı numara
        if ((error as { code?: string }).code === "23505") {
          toast({
            title: t("admin.whatsapp.userProfiles.newCustomer.duplicate"),
            description: t("admin.whatsapp.userProfiles.newCustomer.duplicateDesc"),
            variant: "destructive",
          });
        } else {
          throw error;
        }
        setSaving(false);
        return;
      }

      onCreated(data as unknown as CreatedProfile);
      toast({
        title: t("admin.whatsapp.userProfiles.newCustomer.createdToast"),
        description: displayPreview,
      });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error("[crm new-customer]", err);
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {t("admin.whatsapp.userProfiles.newCustomer.title")}
          </DialogTitle>
          <DialogDescription>
            {t("admin.whatsapp.userProfiles.newCustomer.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Telefon — zorunlu */}
          <div className="space-y-2">
            <Label htmlFor="new-phone" className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              {t("admin.whatsapp.userProfiles.newCustomer.phoneLabel")}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-phone"
              value={phoneRaw}
              onChange={(e) => setPhoneRaw(e.target.value)}
              placeholder="+90 532 123 45 67"
              autoFocus
            />
            {phoneRaw && !normalized && (
              <p className="text-[11px] text-destructive">
                {t("admin.whatsapp.userProfiles.newCustomer.invalidPhoneHint")}
              </p>
            )}
            {normalized && (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {t("admin.whatsapp.userProfiles.newCustomer.previewLabel")}: <span className="font-mono">{displayPreview}</span>
              </p>
            )}
          </div>

          {/* Ad — opsiyonel */}
          <div className="space-y-2">
            <Label htmlFor="new-fullname" className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              {t("admin.whatsapp.userProfiles.newCustomer.fullNameLabel")}
            </Label>
            <Input
              id="new-fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={200}
              placeholder={t("admin.whatsapp.userProfiles.newCustomer.fullNamePlaceholder", { defaultValue: "Opsiyonel" })}
            />
          </div>

          {/* Email — opsiyonel */}
          <div className="space-y-2">
            <Label htmlFor="new-email" className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              {t("admin.whatsapp.userProfiles.newCustomer.emailLabel")}
            </Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="ornek@email.com"
            />
          </div>

          {/* Not — opsiyonel */}
          <div className="space-y-2">
            <Label htmlFor="new-notes" className="flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
              {t("admin.whatsapp.userProfiles.newCustomer.notesLabel")}
            </Label>
            <textarea
              id="new-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={t("admin.whatsapp.userProfiles.newCustomer.notesPlaceholder", { defaultValue: "Opsiyonel" })}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>

          {/* Bilgi notu — Meta opt-in kuralı */}
          <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-200">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              {t("admin.whatsapp.userProfiles.newCustomer.botOptInNote", {
                defaultValue:
                  "Bot bu müşteriye otomatik mesaj göndermez. İlk mesajı WhatsApp'tan kendiniz başlatın; müşteri cevap verince bot devralır.",
              })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !normalized}
            className="bg-gradient-ocean hover:opacity-90"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4 me-1.5" />
            )}
            {t("admin.whatsapp.userProfiles.newCustomer.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
