import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Loader2, CreditCard, Building2 } from "lucide-react";

interface PaymentInstructions {
  [language: string]: {
    bank_name: string;
    account_holder: string;
    iban: string;
    additional_info: string;
  };
}

export const PaymentSettings = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions>({
    tr: {
      bank_name: "",
      account_holder: "",
      iban: "",
      additional_info: ""
    },
    en: {
      bank_name: "",
      account_holder: "",
      iban: "",
      additional_info: ""
    }
  });

  useEffect(() => {
    fetchPaymentInstructions();
  }, []);

  const fetchPaymentInstructions = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency, error } = await supabase
        .from("agencies")
        .select("id, payment_instructions")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (agency) {
        setAgencyId(agency.id);
        if (agency.payment_instructions) {
          setPaymentInstructions(agency.payment_instructions as PaymentInstructions);
        }
      }
    } catch (error) {
      console.error("Error fetching payment instructions:", error);
      toast({
        title: "Hata",
        description: "Ödeme bilgileri yüklenirken bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agencyId) {
      toast({
        title: "Hata",
        description: "Acente bilgisi bulunamadı",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ payment_instructions: paymentInstructions })
        .eq("id", agencyId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Ödeme bilgileri başarıyla güncellendi",
      });
    } catch (error) {
      console.error("Error saving payment instructions:", error);
      toast({
        title: "Hata",
        description: "Ödeme bilgileri kaydedilirken bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (
    language: string,
    field: string,
    value: string
  ) => {
    setPaymentInstructions((prev) => ({
      ...prev,
      [language]: {
        ...prev[language],
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const renderLanguageForm = (language: string, title: string) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${language}-bank-name`}>
          <Building2 className="h-4 w-4 inline mr-2" />
          Banka Adı
        </Label>
        <Input
          id={`${language}-bank-name`}
          value={paymentInstructions[language]?.bank_name || ""}
          onChange={(e) =>
            handleInputChange(language, "bank_name", e.target.value)
          }
          placeholder="Örn: Garanti BBVA"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${language}-account-holder`}>Hesap Sahibi</Label>
        <Input
          id={`${language}-account-holder`}
          value={paymentInstructions[language]?.account_holder || ""}
          onChange={(e) =>
            handleInputChange(language, "account_holder", e.target.value)
          }
          placeholder="Örn: ABC Turizm Ltd. Şti."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${language}-iban`}>
          <CreditCard className="h-4 w-4 inline mr-2" />
          IBAN
        </Label>
        <Input
          id={`${language}-iban`}
          value={paymentInstructions[language]?.iban || ""}
          onChange={(e) =>
            handleInputChange(language, "iban", e.target.value)
          }
          placeholder="TR00 0000 0000 0000 0000 0000 00"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${language}-additional-info`}>
          Ek Bilgiler (Opsiyonel)
        </Label>
        <Textarea
          id={`${language}-additional-info`}
          value={paymentInstructions[language]?.additional_info || ""}
          onChange={(e) =>
            handleInputChange(language, "additional_info", e.target.value)
          }
          placeholder="Ödeme sırasında belirtilmesi gereken özel notlar veya talimatlar..."
          rows={4}
        />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ödeme Bilgileri Ayarları</CardTitle>
        <CardDescription>
          Müşterilerinize gösterilecek ödeme bilgilerini buradan yönetin.
          Rezervasyon tamamlandığında bu bilgiler otomatik olarak paylaşılacaktır.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tr" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tr">🇹🇷 Türkçe</TabsTrigger>
            <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
          </TabsList>

          <TabsContent value="tr" className="space-y-4 mt-4">
            {renderLanguageForm("tr", "Türkçe")}
          </TabsContent>

          <TabsContent value="en" className="space-y-4 mt-4">
            {renderLanguageForm("en", "English")}
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kaydet
          </Button>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">💡 İpucu</h4>
          <p className="text-sm text-muted-foreground">
            Bu bilgiler, müşterileriniz rezervasyon yaptıktan sonra WhatsApp ve demo
            chat üzerinden otomatik olarak paylaşılacaktır. IBAN ve banka bilgilerinizin
            doğru olduğundan emin olun.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
