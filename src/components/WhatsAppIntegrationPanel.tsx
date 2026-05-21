import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2 } from "lucide-react";
import { WhatsAppEmbeddedSignup } from "./WhatsAppEmbeddedSignup";

export const WhatsAppIntegrationPanel = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);

  useEffect(() => {
    loadAgency();
  }, []);

  const loadAgency = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency } = await supabase
        .from("agencies")
        .select("id, whatsapp_status, whatsapp_phone_number")
        .eq("user_id", user.id)
        .maybeSingle();

      if (agency) {
        setAgencyId(agency.id);
        setWhatsappStatus(agency.whatsapp_status);
        setWhatsappPhone(agency.whatsapp_phone_number);
      }
    } catch (error) {
      console.error("Error loading agency:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          {t("whatsappIntegration.loading")}
        </CardContent>
      </Card>
    );
  }

  if (!agencyId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t("whatsappIntegration.notFound")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <WhatsAppEmbeddedSignup
        agencyId={agencyId}
        currentStatus={whatsappStatus}
        currentPhone={whatsappPhone}
        onConnected={loadAgency}
      />

      {whatsappStatus === "active" && whatsappPhone && (
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription>
            {t("whatsappIntegration.active")}
            <span className="block mt-1 font-medium">Numara: {whatsappPhone}</span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
