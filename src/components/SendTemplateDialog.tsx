import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Send, AlertCircle, Loader2 } from "lucide-react";

interface MessageTemplate {
  id: string;
  template_key: string;
  language: string;
  subject: string;
  content: string;
  variables: any;
  is_active: boolean;
}

interface RecentRegistration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  tours?: { title: string };
  tour_dates?: { departure_date: string };
}

interface SendTemplateDialogProps {
  template: MessageTemplate | null;
  agencyId: string;
  open: boolean;
  onClose: () => void;
}

export function SendTemplateDialog({ template, agencyId, open, onClose }: SendTemplateDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [mode, setMode] = useState<"recent" | "manual">("recent");
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [selectedRegistrationId, setSelectedRegistrationId] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const variableList: string[] = template?.variables
    ? Array.isArray(template.variables)
      ? template.variables
      : String(template.variables).split(",").map((v) => v.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    if (open && agencyId) {
      loadRecentRegistrations();
    }
    setVariableValues({});
    setSelectedRegistrationId("");
    setManualPhone("");
    setManualName("");
  }, [open, agencyId]);

  useEffect(() => {
    if (!template) return;
    let body = template.content;
    Object.entries(variableValues).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      body = body.replace(regex, value || `{${key}}`);
    });
    setPreview(body);
  }, [template, variableValues]);

  const loadRecentRegistrations = async () => {
    try {
      const { data } = await supabase
        .from("registrations")
        .select("id, full_name, phone, pax, tours:tour_id(title), tour_dates:tour_date_id(departure_date)")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(50);
      setRecentRegistrations((data as any[]) || []);
    } catch (err) {
      console.error("Failed to load registrations:", err);
    }
  };

  const POSITIONAL_NAMED_ORDER = ["full_name", "tour_name", "date", "pax", "phone"] as const;

  const handleRegistrationSelect = (regId: string) => {
    setSelectedRegistrationId(regId);
    const reg = recentRegistrations.find((r) => r.id === regId);
    if (reg) {
      const namedValues: Record<string, string> = {
        full_name: reg.full_name || "",
        tour_name: (reg.tours as any)?.title || "",
        date: (reg.tour_dates as any)?.departure_date || "",
        pax: String(reg.pax || ""),
        phone: reg.phone || "",
      };
      // Positional variables (["1","2","3"]) → map to named values in order
      const isPositional = variableList.length > 0 && variableList.every((v) => /^\d+$/.test(v));
      if (isPositional) {
        const positionalValues: Record<string, string> = {};
        variableList.forEach((v, i) => {
          const key = POSITIONAL_NAMED_ORDER[i];
          positionalValues[v] = key ? (namedValues[key] ?? "") : "";
        });
        setVariableValues(positionalValues);
      } else {
        setVariableValues(namedValues);
      }
    }
  };

  const handleSend = async () => {
    if (!template) return;

    if (mode === "manual" && (!manualPhone || manualPhone.replace(/\D/g, "").length < 10)) {
      toast({ title: t("common.error"), description: t("admin.templates.send.errors.invalidPhone"), variant: "destructive" });
      return;
    }
    if (mode === "recent" && !selectedRegistrationId) {
      toast({ title: t("common.error"), description: t("admin.templates.send.errors.selectRegistration"), variant: "destructive" });
      return;
    }

    const missingVars = variableList.filter((v) => !variableValues[v]);
    if (missingVars.length > 0) {
      toast({
        title: t("common.error"),
        description: t("admin.templates.send.errors.missingVariables", { vars: missingVars.join(", ") }),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload =
        mode === "recent"
          ? { registrationId: selectedRegistrationId, templateKey: template.template_key, language: template.language }
          : { agencyId, phone: manualPhone, templateKey: template.template_key, language: template.language, variableValues, recipientName: manualName };

      const { data, error } = await supabase.functions.invoke("send-template-message", { body: payload });

      // Edge function 200 ile success:false döndürebilir (debug bilgisi için).
      // Hem HTTP error hem body içindeki error'u kontrol et — kullanıcıya gerçek hatayı göster.
      if (error) throw error;
      if (data && (data as any).success === false) {
        const _dbg = (data as any).debug || {};
        const _hint = (data as any).debug?.hint;
        // Kullanıcıya görünür kısa hata + console'a tam debug
        console.error("[send-template-message] failure:", { error: (data as any).error, debug: _dbg });
        const _detail = [
          (data as any).error,
          _hint ? `İpucu: ${_hint}` : null,
          _dbg.metaError ? `Meta hatası: ${_dbg.metaError}` : null,
        ].filter(Boolean).join(" — ");
        throw new Error(_detail || t("admin.templates.send.errors.generic"));
      }

      toast({ title: t("common.success"), description: t("admin.templates.send.success") });
      onClose();
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: err?.message || t("admin.templates.send.errors.generic"),
        variant: "destructive",
        duration: 10000,   // Hata mesajı daha uzun süre kalsın — debug bilgisi okunabilsin
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${isMobile ? "w-full max-w-none h-[95dvh]" : "max-w-2xl max-h-[90vh]"} overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t("admin.templates.send.title")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {template.template_key} · {template.language.toUpperCase()}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode selector */}
          <div className="flex gap-2">
            <Button variant={mode === "recent" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setMode("recent")}>
              {t("admin.templates.send.modeRecent")}
            </Button>
            <Button variant={mode === "manual" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setMode("manual")}>
              {t("admin.templates.send.modeManual")}
            </Button>
          </div>

          {/* Recent registrations */}
          {mode === "recent" && (
            <div className="space-y-2">
              <Label>{t("admin.templates.send.selectRegistration")}</Label>
              <Select value={selectedRegistrationId} onValueChange={handleRegistrationSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.templates.send.pickRegistration")} />
                </SelectTrigger>
                <SelectContent>
                  {recentRegistrations.map((reg) => (
                    <SelectItem key={reg.id} value={reg.id}>
                      {reg.full_name} — {reg.phone} {(reg.tours as any)?.title ? `(${(reg.tours as any).title})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Manual input */}
          {mode === "manual" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("admin.templates.send.recipientPhone")}</Label>
                <Input type="tel" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} placeholder="+90 555 123 45 67" />
              </div>
              <div className="space-y-1">
                <Label>{t("admin.templates.send.recipientName")}</Label>
                <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder={t("admin.templates.send.recipientNamePlaceholder")} />
              </div>
            </div>
          )}

          {/* Variables */}
          {variableList.length > 0 && (
            <Card className="p-4 space-y-3">
              <Label className="text-sm font-semibold">{t("admin.templates.send.variables")}</Label>
              {variableList.map((varName) => (
                <div key={varName} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{`{${varName}}`}</Label>
                  <Input
                    value={variableValues[varName] || ""}
                    onChange={(e) => setVariableValues({ ...variableValues, [varName]: e.target.value })}
                    placeholder={`${varName}...`}
                  />
                </div>
              ))}
            </Card>
          )}

          {/* Preview */}
          <Card className="p-4 bg-muted/30">
            <Label className="text-sm font-semibold mb-2 block">{t("admin.templates.send.preview")}</Label>
            <pre className="whitespace-pre-wrap text-sm bg-background p-3 rounded border leading-relaxed">
              {preview || template.content}
            </pre>
          </Card>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{t("admin.templates.send.metaWarning")}</AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSend} disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("admin.templates.send.sending")}</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />{t("admin.templates.send.sendNow")}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
