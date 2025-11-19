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
import { Loader2, CreditCard, Building2, Percent } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PaymentInstructions {
  payment_type?: "deposit" | "full";
  deposit_percentage?: number;
  payment_methods?: string[];
  [language: string]: any;
}

export const PaymentSettings = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions>({
    payment_type: "deposit",
    deposit_percentage: 30,
    payment_methods: ["bank_transfer"],
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

  const handlePaymentTypeChange = (value: string) => {
    setPaymentInstructions((prev) => ({
      ...prev,
      payment_type: value as "deposit" | "full",
    }));
  };

  const handleDepositPercentageChange = (value: string) => {
    setPaymentInstructions((prev) => ({
      ...prev,
      deposit_percentage: parseInt(value) || 30,
    }));
  };

  const handlePaymentMethodsChange = (method: string, checked: boolean) => {
    setPaymentInstructions((prev) => {
      const currentMethods = prev.payment_methods || [];
      const newMethods = checked
        ? [...currentMethods, method]
        : currentMethods.filter((m) => m !== method);
      return {
        ...prev,
        payment_methods: newMethods,
      };
    });
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
        <div className="space-y-6">
          {/* Payment Type Section */}
          <div className="space-y-4 pb-6 border-b">
            <div>
              <Label className="text-base font-semibold">Ödeme Türü</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Müşterilerden ne tür ödeme almak istiyorsunuz?
              </p>
            </div>
            
            <RadioGroup
              value={paymentInstructions.payment_type}
              onValueChange={handlePaymentTypeChange}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="deposit" id="deposit" />
                <Label htmlFor="deposit" className="font-normal cursor-pointer">
                  Kapora (Ön Ödeme)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="font-normal cursor-pointer">
                  Tam Ödeme
                </Label>
              </div>
            </RadioGroup>

            {paymentInstructions.payment_type === "deposit" && (
              <div className="space-y-2 ml-6">
                <Label htmlFor="deposit-percentage">
                  <Percent className="h-4 w-4 inline mr-2" />
                  Kapora Yüzdesi
                </Label>
                <Select
                  value={paymentInstructions.deposit_percentage?.toString()}
                  onValueChange={handleDepositPercentageChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">%10</SelectItem>
                    <SelectItem value="20">%20</SelectItem>
                    <SelectItem value="30">%30</SelectItem>
                    <SelectItem value="40">%40</SelectItem>
                    <SelectItem value="50">%50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Payment Methods Section */}
          <div className="space-y-4 pb-6 border-b">
            <div>
              <Label className="text-base font-semibold">Ödeme Yöntemleri</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Hangi ödeme yöntemlerini kabul ediyorsunuz?
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bank_transfer"
                  checked={paymentInstructions.payment_methods?.includes("bank_transfer")}
                  onCheckedChange={(checked) =>
                    handlePaymentMethodsChange("bank_transfer", checked as boolean)
                  }
                />
                <Label htmlFor="bank_transfer" className="font-normal cursor-pointer">
                  Banka Transferi / EFT
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cash"
                  checked={paymentInstructions.payment_methods?.includes("cash")}
                  onCheckedChange={(checked) =>
                    handlePaymentMethodsChange("cash", checked as boolean)
                  }
                />
                <Label htmlFor="cash" className="font-normal cursor-pointer">
                  Nakit
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="credit_card"
                  checked={paymentInstructions.payment_methods?.includes("credit_card")}
                  onCheckedChange={(checked) =>
                    handlePaymentMethodsChange("credit_card", checked as boolean)
                  }
                />
                <Label htmlFor="credit_card" className="font-normal cursor-pointer">
                  Kredi Kartı
                </Label>
              </div>
            </div>
          </div>

          {/* Bank Information Section */}
          <div>
            <div className="mb-4">
              <Label className="text-base font-semibold">Banka Bilgileri</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Ödeme alacağınız banka hesap bilgilerini girin
              </p>
            </div>

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
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kaydet
          </Button>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">💡 İpucu</h4>
          <p className="text-sm text-muted-foreground">
            Bu ayarlar acente özelindedir ve tüm paketlerde aktiftir. Müşterileriniz 
            rezervasyon yaptıktan sonra WhatsApp ve demo chat üzerinden bu bilgiler 
            otomatik olarak paylaşılacaktır. IBAN ve banka bilgilerinizin doğru 
            olduğundan emin olun.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
