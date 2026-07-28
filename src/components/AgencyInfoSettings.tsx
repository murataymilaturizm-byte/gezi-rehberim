import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, MapPin, Phone, Globe, Clock, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

interface WorkingHoursData {
  [key: string]: DaySchedule;
}

// DAYS is now computed inside component using t()

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return [`${h}:00`, `${h}:30`];
}).flat();

const DEFAULT_HOURS: WorkingHoursData = {
  monday: { enabled: true, open: "09:00", close: "18:00" },
  tuesday: { enabled: true, open: "09:00", close: "18:00" },
  wednesday: { enabled: true, open: "09:00", close: "18:00" },
  thursday: { enabled: true, open: "09:00", close: "18:00" },
  friday: { enabled: true, open: "09:00", close: "18:00" },
  saturday: { enabled: true, open: "09:00", close: "14:00" },
  sunday: { enabled: false, open: "09:00", close: "18:00" },
};

function parseWorkingHours(raw: string): WorkingHoursData {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.monday) return parsed;
  } catch {}
  return { ...DEFAULT_HOURS };
}

function formatWorkingHoursForDisplay(data: WorkingHoursData): string {
  return JSON.stringify(data);
}

interface AgencyInfo {
  address?: string;
  phone_public?: string;
  website_url?: string;
  working_hours?: string;
  maps_url?: string;
  cancellation_policy?: string;
  description?: string;
}

export function AgencyInfoSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const DAYS = [
    { key: "monday", label: t("agencyInfo.days.monday") },
    { key: "tuesday", label: t("agencyInfo.days.tuesday") },
    { key: "wednesday", label: t("agencyInfo.days.wednesday") },
    { key: "thursday", label: t("agencyInfo.days.thursday") },
    { key: "friday", label: t("agencyInfo.days.friday") },
    { key: "saturday", label: t("agencyInfo.days.saturday") },
    { key: "sunday", label: t("agencyInfo.days.sunday") },
  ];
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyInfo, setAgencyInfo] = useState<AgencyInfo>({
    address: "",
    phone_public: "",
    website_url: "",
    working_hours: "",
    maps_url: "",
    cancellation_policy: "",
    description: ""
  });
  const [workingHours, setWorkingHours] = useState<WorkingHoursData>(DEFAULT_HOURS);

  useEffect(() => {
    fetchAgencyInfo();
  }, []);

  const fetchAgencyInfo = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: agency, error } = await supabase
        .from('agencies')
        .select('id, address, phone_public, website_url, working_hours, maps_url, cancellation_policy, description')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (agency) {
        setAgencyId(agency.id);
        const parsed = parseWorkingHours(agency.working_hours || "");
        setWorkingHours(parsed);
        setAgencyInfo({
          address: agency.address || "",
          phone_public: agency.phone_public || "",
          website_url: agency.website_url || "",
          working_hours: agency.working_hours || "",
          maps_url: agency.maps_url || "",
          cancellation_policy: agency.cancellation_policy || "",
          description: (agency as any).description || ""
        });
      }
    } catch (error) {
      console.error('Error fetching agency info:', error);
      toast({
        title: t("common.error"),
        description: t("agencyInfo.loadError"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agencyId) return;

    // Validation (silent failure önleme): bot bunları müşteriye gösterir.
    const _phone = (agencyInfo.phone_public || "").trim();
    if (_phone) {
      const _cleaned = _phone.replace(/[\s\-()]/g, "");
      // E.164 + yerel format toleransı (10-15 hane, başında + opsiyonel)
      if (!/^\+?\d{10,15}$/.test(_cleaned)) {
        toast({
          title: t("agencyInfo.invalidPhone", {
            defaultValue: "Telefon formatı geçersiz. Örnek: +90 555 123 45 67"
          }),
          variant: "destructive",
        });
        return;
      }
    }

    const _website = (agencyInfo.website_url || "").trim();
    if (_website) {
      try {
        const _u = new URL(_website);
        if (!["http:", "https:"].includes(_u.protocol)) throw new Error("invalid_protocol");
      } catch {
        toast({
          title: t("agencyInfo.invalidUrl", {
            defaultValue: "Web sitesi adresi geçersiz. Örnek: https://acente.com"
          }),
          variant: "destructive",
        });
        return;
      }
    }

    const _maps = (agencyInfo.maps_url || "").trim();
    if (_maps) {
      try {
        const _u = new URL(_maps);
        if (!["http:", "https:"].includes(_u.protocol)) throw new Error("invalid_protocol");
      } catch {
        toast({
          title: t("agencyInfo.invalidMapsUrl", {
            defaultValue: "Harita bağlantısı geçersiz. Örnek: https://maps.google.com/..."
          }),
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const serialized = formatWorkingHoursForDisplay(workingHours);
      const { error } = await supabase
        .from('agencies')
        .update({ ...agencyInfo, working_hours: serialized })
        .eq('id', agencyId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("agencyInfo.saveSuccess")
      });
    } catch (error) {
      console.error('Error saving agency info:', error);
      toast({
        title: t("common.error"),
        description: t("agencyInfo.saveError"),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (day: string, field: keyof DaySchedule, value: any) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t("agencyInfo.title")}
          </CardTitle>
          <CardDescription>
            {t("agencyInfo.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("agencyInfo.address")}
            </Label>
            <Textarea
              id="address"
              placeholder={t("agencyInfo.addressPlaceholder")}
              value={agencyInfo.address}
              onChange={(e) => setAgencyInfo({ ...agencyInfo, address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_public" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {t("agencyInfo.phonePublic")}
            </Label>
            <Input
              id="phone_public"
              type="tel"
              placeholder={t("agencyInfo.phonePublicPlaceholder")}
              value={agencyInfo.phone_public}
              onChange={(e) => setAgencyInfo({ ...agencyInfo, phone_public: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website_url" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("agencyInfo.website")}
            </Label>
            <Input
              id="website_url"
              type="url"
              placeholder={t("agencyInfo.websitePlaceholder")}
              value={agencyInfo.website_url}
              onChange={(e) => setAgencyInfo({ ...agencyInfo, website_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maps_url" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("agencyInfo.mapsUrl")}
            </Label>
            <Input
              id="maps_url"
              type="url"
              placeholder={t("agencyInfo.mapsUrlPlaceholder")}
              value={agencyInfo.maps_url}
              onChange={(e) => setAgencyInfo({ ...agencyInfo, maps_url: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("agencyInfo.workingHours")}
          </CardTitle>
          <CardDescription>
            {t("agencyInfo.workingHoursDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DAYS.map(day => (
              <div key={day.key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Switch
                  checked={workingHours[day.key]?.enabled ?? false}
                  onCheckedChange={(checked) => updateDay(day.key, "enabled", checked)}
                />
                <span className="w-24 text-sm font-medium">{day.label}</span>
                {workingHours[day.key]?.enabled ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={workingHours[day.key]?.open || "09:00"}
                      onValueChange={(v) => updateDay(day.key, "open", v)}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground text-sm">-</span>
                    <Select
                      value={workingHours[day.key]?.close || "18:00"}
                      onValueChange={(v) => updateDay(day.key, "close", v)}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{t("agencyInfo.closedLabel")}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            {t("agencyInfo.cancellationPolicy")}
          </CardTitle>
          <CardDescription>
            {t("agencyInfo.cancellationPolicyPlaceholder")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="cancellation_policy"
            placeholder={t("agencyInfo.cancellationPolicyPlaceholder")}
            value={agencyInfo.cancellation_policy}
            onChange={(e) => setAgencyInfo({ ...agencyInfo, cancellation_policy: e.target.value })}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* F-D1 (2026-07-28): "Acente hakkında" — bot promptuna ~300 karakterle girer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("agencyInfo.aboutTitle")}</CardTitle>
          <CardDescription>{t("agencyInfo.aboutHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="agency_description"
            placeholder={t("agencyInfo.aboutPlaceholder")}
            value={agencyInfo.description || ""}
            onChange={(e) => setAgencyInfo({ ...agencyInfo, description: e.target.value })}
            maxLength={300}
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}