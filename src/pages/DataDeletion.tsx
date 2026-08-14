import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Trash2 } from "lucide-react";

const DataDeletion = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() && !phone.trim()) {
      toast({ title: t("legal.error"), description: t("legal.dataDeletion.fillOne"), variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("data_deletion_requests" as any)
      .insert({ email: email.trim() || null, phone: phone.trim() || null } as any);

    setLoading(false);

    if (error) {
      toast({ title: t("legal.error"), description: t("legal.dataDeletion.error"), variant: "destructive" });
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <SiteHeader />
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">{t("legal.dataDeletion.successTitle")}</h2>
            <p className="text-muted-foreground">{t("legal.dataDeletion.successDesc")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <Trash2 className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle>{t("legal.dataDeletion.title")}</CardTitle>
          <CardDescription>{t("legal.dataDeletion.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("legal.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("legal.phone")}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+90 5XX XXX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("legal.dataDeletion.notice")}</p>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("legal.sending") : t("legal.dataDeletion.button")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataDeletion;
