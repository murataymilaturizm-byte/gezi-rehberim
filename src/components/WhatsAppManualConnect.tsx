// WhatsApp Manuel Bağlantı (2026-07-10).
//
// NEDEN: Embedded-signup bazı numaralarda KULLANILAMAZ (numara Turzz
// tech-provider portföyünde → Meta seçtirmiyor, bu Meta kuralı). Bu numaralar
// için acente Meta System User token'ı + phone_number_id girer; waba_id Graph'tan
// OTOMATİK keşfedilir (elle girmek opsiyonel). "Doğrula" → GET /{pnid} → numara +
// WABA döner → kaydedilir + webhook subscribe. Token PII: maskeli, loglanmaz.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, KeyRound, ChevronDown, Link2 } from "lucide-react";

interface Props {
  agencyId: string;
  onConnected?: () => void;
}

export const WhatsAppManualConnect = ({ agencyId, onConnected }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ phone: string; waba: string; discovered: boolean; subscribed: boolean } | null>(null);

  const handleVerify = async () => {
    // 2026-07-10: token OPSİYONEL — boşsa backend kayıtlı/merkezi token'a düşer
    // (numara Turzz portföyündeyse acentenin kendi token'ı zaten erişemez).
    if (!phoneNumberId.trim()) {
      toast({ title: t("common.error"), description: "Phone Number ID zorunludur.", variant: "destructive" });
      return;
    }
    setVerifying(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("meta-embedded-signup", {
        body: {
          action: "manual-connect",
          agencyId,
          accessToken: token.trim(),
          phoneNumberId: phoneNumberId.trim(),
          wabaId: wabaId.trim() || undefined,
        },
      });
      // invoke non-2xx'te gerçek mesaj body'de — context'ten oku
      if (error) {
        let realMsg = error.message;
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) realMsg = body.error;
        } catch { /* generic */ }
        toast({ title: t("common.error"), description: realMsg || "Bağlantı doğrulanamadı.", variant: "destructive" });
        return;
      }
      if (!data?.success) {
        toast({ title: t("common.error"), description: data?.error || "Bağlantı doğrulanamadı.", variant: "destructive" });
        return;
      }
      setResult({
        phone: data.displayPhoneNumber || "—",
        waba: data.wabaId,
        discovered: !!data.wabaDiscovered,
        subscribed: !!data.webhookSubscribed,
      });
      setToken(""); // token'ı bellekte tutma (PII)
      toast({
        title: t("common.success"),
        description: `Bağlantı doğrulandı: ${data.displayPhoneNumber || data.wabaId}`,
      });
      onConnected?.();
    } catch (e: any) {
      toast({ title: t("common.error"), description: e?.message || "Beklenmeyen hata.", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card className="border-dashed">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" />
              Manuel Bağlantı (gelişmiş)
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
            </CardTitle>
            <CardDescription>
              Embedded Signup numaranızı seçtirmiyorsa (numara tedarikçi portföyünde),
              Meta System User token'ınızla manuel bağlanın.
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {result ? (
              <Alert className="border-green-500/40 bg-green-500/5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm space-y-1">
                  <p className="font-semibold text-green-700 dark:text-green-400">Bağlantı doğrulandı ✅</p>
                  <p>📱 Numara: <span className="font-medium">{result.phone}</span></p>
                  <p>🏢 WABA: <span className="font-mono text-xs">{result.waba}</span> {result.discovered && <span className="text-muted-foreground">(otomatik keşfedildi)</span>}</p>
                  <p>🔔 Webhook: {result.subscribed ? "abone ✓" : "abone olunamadı — 'Bağlantıyı Onar' ile tekrar deneyin"}</p>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Meta Erişim Token'ı (System User) — opsiyonel</Label>
                  <Input type="password" value={token} onChange={(e) => setToken(e.target.value)}
                    placeholder="Boş bırakın — mevcut/merkezi bağlantı kullanılır" autoComplete="off" />
                  <p className="text-xs text-muted-foreground">Numaranız Turzz üzerinden bağlıysa boş bırakın. Kendi Meta hesabınızdaki numara için: Business Settings → System Users → token (whatsapp_business_management + whatsapp_business_messaging izinleriyle).</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number ID *</Label>
                  <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="1099..." inputMode="numeric" />
                  <p className="text-xs text-muted-foreground">WhatsApp Manager → API Setup → "Phone number ID" (telefon numarasının kendisi DEĞİL).</p>
                </div>
                <div className="space-y-1.5">
                  <Label>WABA ID (opsiyonel)</Label>
                  <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)}
                    placeholder="Boş bırakın — otomatik keşfedilir" inputMode="numeric" />
                  <p className="text-xs text-muted-foreground">Token'da yeterli izin varsa boş bırakın; keşfedilemezse WhatsApp Manager → Business Settings → WhatsApp Accounts'tan kopyalayın.</p>
                </div>
                <Button onClick={handleVerify} disabled={verifying} className="w-full">
                  {verifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Doğrulanıyor…</> : <>Bağlantıyı Doğrula</>}
                </Button>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
