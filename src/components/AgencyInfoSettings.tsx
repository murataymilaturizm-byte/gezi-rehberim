import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, MapPin, Phone, Globe, Clock, CreditCard, XCircle } from "lucide-react";

interface AgencyInfo {
  address?: string;
  phone_public?: string;
  website_url?: string;
  working_hours?: string;
  maps_url?: string;
  payment_methods_text?: string;
  cancellation_policy?: string;
}

export function AgencyInfoSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyInfo, setAgencyInfo] = useState<AgencyInfo>({
    address: "",
    phone_public: "",
    website_url: "",
    working_hours: "",
    maps_url: "",
    payment_methods_text: "",
    cancellation_policy: ""
  });

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
        .select('id, address, phone_public, website_url, working_hours, maps_url, payment_methods_text, cancellation_policy')
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;

      if (agency) {
        setAgencyId(agency.id);
        setAgencyInfo({
          address: agency.address || "",
          phone_public: agency.phone_public || "",
          website_url: agency.website_url || "",
          working_hours: agency.working_hours || "",
          maps_url: agency.maps_url || "",
          payment_methods_text: agency.payment_methods_text || "",
          cancellation_policy: agency.cancellation_policy || ""
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

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agencies')
        .update(agencyInfo)
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
            {t("agencyInfo.workingHoursPlaceholder")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="working_hours"
            placeholder={t("agencyInfo.workingHoursPlaceholder")}
            value={agencyInfo.working_hours}
            onChange={(e) => setAgencyInfo({ ...agencyInfo, working_hours: e.target.value })}
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("agencyInfo.paymentMethods")}
          </CardTitle>
          <CardDescription>
            {t("agencyInfo.paymentMethodsPlaceholder")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="payment_methods_text"
            placeholder={t("agencyInfo.paymentMethodsPlaceholder")}
            value={agencyInfo.payment_methods_text}
            onChange={(e) => setAgencyInfo({ ...agencyInfo, payment_methods_text: e.target.value })}
            rows={3}
          />
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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}