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
import { Loader2, CreditCard, Building2, Percent, Bot } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentInstructions {
  payment_type?: "deposit" | "full";
  deposit_percentage?: number;
  payment_methods?: string[];
  phone_number?: string;
  [language: string]: any;
}

export const PaymentSettings = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyAddress, setAgencyAddress] = useState<string>("");
  const [agencyWorkingHours, setAgencyWorkingHours] = useState<string>("");
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions>({
    payment_type: "deposit",
    deposit_percentage: 30,
    payment_methods: ["bank_transfer"],
    phone_number: "",
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
        .select("id, payment_instructions, address, working_hours")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (agency) {
        setAgencyId(agency.id);
        if (agency.payment_instructions) {
          setPaymentInstructions(agency.payment_instructions as PaymentInstructions);
        }
        setAgencyAddress((agency as any).address || "");
        // working_hours is stored as JSON object; flatten to readable string for display
        const wh = (agency as any).working_hours;
        if (typeof wh === "string") {
          setAgencyWorkingHours(wh);
        } else if (wh && typeof wh === "object") {
          setAgencyWorkingHours(t("admin.paymentSettings.additionalInfo.workingHoursFromAgency"));
        }
      }
    } catch (error) {
      console.error("Error fetching payment instructions:", error);
      toast({
        title: t("admin.paymentSettings.messages.loadError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agencyId) {
      toast({
        title: t("admin.paymentSettings.messages.agencyNotFound"),
        variant: "destructive",
      });
      return;
    }

    // K5: deposit_percentage 0-100 dışındaysa kaydetme (Select bypass guard'ı)
    const _depPct = paymentInstructions.deposit_percentage;
    if (
      paymentInstructions.payment_type === "deposit" &&
      _depPct != null &&
      (!Number.isFinite(_depPct) || _depPct < 0 || _depPct > 100)
    ) {
      toast({
        title: t("admin.paymentSettings.messages.invalidDepositPct"),
        variant: "destructive",
      });
      return;
    }

    // IBAN format validation (varsa) — ^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$
    const _ibanRe = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
    for (const lang of ["tr", "en"]) {
      const _iban = (paymentInstructions[lang]?.iban || "").replace(/\s+/g, "").toUpperCase();
      if (_iban && !_ibanRe.test(_iban)) {
        toast({
          title: t("admin.paymentSettings.messages.invalidIban", {
            defaultValue: "IBAN formatı geçersiz (örnek: TR00 0000 0000 0000 0000 0000 00)"
          }),
          variant: "destructive",
        });
        return;
      }
    }

    // Cross-form: cash_office seçildiyse acente adresi zorunlu — bot adres göstermek için
    const _methods: string[] = paymentInstructions.payment_methods || [];
    if (_methods.includes("cash_office") && !agencyAddress.trim()) {
      toast({
        title: t("admin.paymentSettings.messages.cashOfficeNeedsAddress", {
          defaultValue: "Ofiste ödeme seçildi, ancak Acente Bilgileri'nde adres boş. Lütfen önce adres girin."
        }),
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
        title: t("admin.paymentSettings.messages.saveSuccess"),
      });
    } catch (error) {
      console.error("Error saving payment instructions:", error);
      toast({
        title: t("admin.paymentSettings.messages.saveError"),
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
    // K5: 0-100 dışındaysa clamp + makul varsayılan (Select bypass durumunda da güvenli)
    const parsed = parseInt(value);
    const clamped = !Number.isFinite(parsed) ? 30 : Math.max(0, Math.min(100, parsed));
    setPaymentInstructions((prev) => ({
      ...prev,
      deposit_percentage: clamped,
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
          {t("admin.paymentSettings.bankInfo.bankName")}
        </Label>
        <Input
          id={`${language}-bank-name`}
          value={paymentInstructions[language]?.bank_name || ""}
          onChange={(e) =>
            handleInputChange(language, "bank_name", e.target.value)
          }
          placeholder={t("admin.paymentSettings.bankInfo.bankNamePlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${language}-account-holder`}>
          {t("admin.paymentSettings.bankInfo.accountHolder")}
        </Label>
        <Input
          id={`${language}-account-holder`}
          value={paymentInstructions[language]?.account_holder || ""}
          onChange={(e) =>
            handleInputChange(language, "account_holder", e.target.value)
          }
          placeholder={t("admin.paymentSettings.bankInfo.accountHolderPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${language}-iban`}>
          <CreditCard className="h-4 w-4 inline mr-2" />
          {t("admin.paymentSettings.bankInfo.iban")}
        </Label>
        <Input
          id={`${language}-iban`}
          value={paymentInstructions[language]?.iban || ""}
          onChange={(e) =>
            handleInputChange(language, "iban", e.target.value)
          }
          placeholder={t("admin.paymentSettings.bankInfo.ibanPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${language}-additional-info`}>
          {t("admin.paymentSettings.bankInfo.additionalInfo")}
        </Label>
        <Textarea
          id={`${language}-additional-info`}
          value={paymentInstructions[language]?.additional_info || ""}
          onChange={(e) =>
            handleInputChange(language, "additional_info", e.target.value)
          }
          placeholder={t("admin.paymentSettings.bankInfo.additionalInfoPlaceholder")}
          rows={4}
        />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.paymentSettings.title")}</CardTitle>
        <CardDescription>
          {t("admin.paymentSettings.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Bot uyarısı: ödeme bilgilerinin müşteriye yansıyacağını vurgula */}
          <Alert className="border-primary/40 bg-primary/5">
            <Bot className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              {t("admin.paymentSettings.botUsageWarning", {
                defaultValue: "🤖 Bot, rezervasyon sonrası müşteriye bu ödeme bilgilerini gönderir. Boş bırakırsanız müşteri detaylı ödeme talimatı alamaz."
              })}
            </AlertDescription>
          </Alert>

          {/* Payment Type Section */}
          <div className="space-y-4 pb-6 border-b">
            <div>
              <Label className="text-base font-semibold">
                {t("admin.paymentSettings.paymentType.label")}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t("admin.paymentSettings.paymentType.description")}
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
                  {t("admin.paymentSettings.paymentType.deposit")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="font-normal cursor-pointer">
                  {t("admin.paymentSettings.paymentType.full")}
                </Label>
              </div>
            </RadioGroup>

            {paymentInstructions.payment_type === "deposit" && (
              <div className="space-y-2 ml-6">
                <Label htmlFor="deposit-percentage">
                  <Percent className="h-4 w-4 inline mr-2" />
                  {t("admin.paymentSettings.depositPercentage")}
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
              <Label className="text-base font-semibold">
                {t("admin.paymentSettings.paymentMethods.label")}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t("admin.paymentSettings.paymentMethods.description")}
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
                  {t("admin.paymentSettings.paymentMethods.bankTransfer")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cash_office"
                  checked={paymentInstructions.payment_methods?.includes("cash_office")}
                  onCheckedChange={(checked) =>
                    handlePaymentMethodsChange("cash_office", checked as boolean)
                  }
                />
                <Label htmlFor="cash_office" className="font-normal cursor-pointer">
                  {t("admin.paymentSettings.paymentMethods.cashOffice")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cash_on_tour"
                  checked={paymentInstructions.payment_methods?.includes("cash_on_tour")}
                  onCheckedChange={(checked) =>
                    handlePaymentMethodsChange("cash_on_tour", checked as boolean)
                  }
                />
                <Label htmlFor="cash_on_tour" className="font-normal cursor-pointer">
                  {t("admin.paymentSettings.paymentMethods.cashOnTour")}
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
                  {t("admin.paymentSettings.paymentMethods.creditCard")}
                </Label>
              </div>
            </div>

            {/* Cash Office — show address/hours from AgencyInfo (single source of truth) */}
            {paymentInstructions.payment_methods?.includes("cash_office") && (
              <div className="ml-6 mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("admin.paymentSettings.additionalInfo.cashOfficeNote")}
                </p>
                {agencyAddress && (
                  <div className="text-sm">
                    <span className="font-medium">{t("admin.paymentSettings.additionalInfo.officeAddress")}: </span>
                    <span>{agencyAddress}</span>
                  </div>
                )}
                {agencyWorkingHours && (
                  <div className="text-sm">
                    <span className="font-medium">{t("admin.paymentSettings.additionalInfo.workingHours")}: </span>
                    <span>{agencyWorkingHours}</span>
                  </div>
                )}
                {!agencyAddress && !agencyWorkingHours && (
                  <p className="text-sm text-amber-600">{t("admin.paymentSettings.additionalInfo.cashOfficeEmpty")}</p>
                )}
              </div>
            )}

            {/* Additional Info for Credit Card */}
            {paymentInstructions.payment_methods?.includes("credit_card") && (
              <div className="ml-6 space-y-4 mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="phone-number">
                    {t("admin.paymentSettings.additionalInfo.phoneNumber")}
                  </Label>
                  <Input
                    id="phone-number"
                    value={paymentInstructions.phone_number || ""}
                    onChange={(e) =>
                      setPaymentInstructions((prev) => ({
                        ...prev,
                        phone_number: e.target.value,
                      }))
                    }
                    placeholder={t("admin.paymentSettings.additionalInfo.phoneNumberPlaceholder")}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bank Information Section */}
          <div>
            <div className="mb-4">
              <Label className="text-base font-semibold">
                {t("admin.paymentSettings.bankInfo.label")}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t("admin.paymentSettings.bankInfo.description")}
              </p>
            </div>

            {renderLanguageForm("tr", "Türkçe")}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving 
              ? t("admin.paymentSettings.actions.saving") 
              : t("admin.paymentSettings.actions.save")}
          </Button>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">
            {t("admin.paymentSettings.tip.title")}
          </h4>
          <p className="text-sm text-muted-foreground">
            {t("admin.paymentSettings.tip.description")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
