import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Download, CheckCircle, FileJson } from "lucide-react";

const DataExport = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() && !phone.trim()) {
      toast({ title: t("legal.error"), description: t("legal.dataExport.fillOne"), variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("data-export", {
        body: {
          email: email.trim() || null,
          phone: phone.trim() || null,
        },
      });

      if (error) throw error;

      // JSON dosyası olarak indir
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `turzz-ai-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported(true);
      toast({ title: t("legal.dataExport.success") });
    } catch (err) {
      console.error("[data-export]", err);
      toast({ title: t("legal.error"), description: t("legal.dataExport.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (exported) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <SiteHeader />
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">{t("legal.dataExport.successTitle")}</h2>
            <p className="text-muted-foreground">{t("legal.dataExport.successDesc")}</p>
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
            <FileJson className="h-10 w-10 text-primary" />
          </div>
          <CardTitle>{t("legal.dataExport.title")}</CardTitle>
          <CardDescription>{t("legal.dataExport.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleExport} className="space-y-4">
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
            <p className="text-xs text-muted-foreground">{t("legal.dataExport.notice")}</p>
            <Button type="submit" className="w-full" disabled={loading || (!email && !phone)}>
              <Download className="h-4 w-4 me-2" />
              {loading ? t("legal.sending") : t("legal.dataExport.button")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataExport;
