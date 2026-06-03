// NotesEditor — acente, müşteri hakkında serbest not yazar/günceller.
// Gerçek CRM'in temel özelliği (HubSpot/Pipedrive eşdeğeri). DB: notes (TEXT)
// kolonu — TUR 2'de tek küçük backend olarak eklendi.
//
// "Kirli" state takibi: kullanıcı yazdı ama henüz kaydetmedi → Kaydet butonu
// öne çıkar. Boş bırakırsa null yazar (RLS güvenli — agency_id eşleşmesi).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StickyNote, Save, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  profileId: string;
  agencyId: string;
  initialNotes: string | null;
  onSaved: (notes: string | null) => void;
}

const MAX_LENGTH = 2000;

export const NotesEditor = ({ profileId, agencyId, initialNotes, onSaved }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [value, setValue] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Profil değişince textarea'yı senkronize et
  useEffect(() => {
    setValue(initialNotes || "");
    setSavedAt(null);
  }, [profileId, initialNotes]);

  const isDirty = value !== (initialNotes || "");

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      const toWrite = value.trim() === "" ? null : value.trim().slice(0, MAX_LENGTH);
      const { error } = await supabase
        .from("whatsapp_user_profiles")
        // notes kolonu ALTER TABLE ile eklendiği için types.ts'i yenilemeden
        // çalışır; geniş tip cast'i mantıklı kullanım.
        .update({ notes: toWrite } as never)
        .eq("id", profileId)
        .eq("agency_id", agencyId);

      if (error) throw error;
      onSaved(toWrite);
      setSavedAt(Date.now());
      toast({ title: t("admin.whatsapp.userProfiles.notes.savedToast") });
    } catch (err) {
      console.error("[crm notes-save]", err);
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          {t("admin.whatsapp.userProfiles.notes.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {t("admin.whatsapp.userProfiles.notes.hint", {
            defaultValue: "Yalnızca acentenize görünür — müşteri görmez.",
          })}
        </p>
      </CardHeader>
      <CardContent>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MAX_LENGTH}
          rows={5}
          placeholder={t("admin.whatsapp.userProfiles.notes.placeholder", {
            defaultValue: "Bu müşteri hakkında özel not… (örn. tercih, geçmiş anlaşma, dikkat edilecek konu)",
          })}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y transition-shadow"
        />
        <div className="flex items-center justify-between gap-3 mt-2">
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {value.length} / {MAX_LENGTH}
          </p>
          <div className="flex items-center gap-2">
            {savedAt !== null && !isDirty && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                {t("admin.whatsapp.userProfiles.notes.saved", { defaultValue: "Kaydedildi" })}
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={!isDirty || saving}
              size="sm"
              className={isDirty ? "bg-gradient-ocean hover:opacity-90" : ""}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 me-1.5" />
              )}
              {t("admin.whatsapp.userProfiles.notes.save")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
