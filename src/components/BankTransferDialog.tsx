// P5-2a (2026-07-28): Havale/EFT ile paket ödeme — manuel akış.
// platform_payment_settings (Turzz IBAN'ı — acente payment_instructions ile AYRI kavram)
// + benzersiz açıklama-kodu TRZ-{agency8}-{plan} + "Ödemeyi yaptım" → payment_requests(pending).
// PayTR-hazırlık: kart-ödeme butonu BİLİNÇLİ YOK (çalışmayan buton koyma) — PayTR
// bağlanınca bu dialoga "kart ile öde" sekmesi eklenecek.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Landmark, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agencyId: string | null;
  plan: string;
  period: "monthly" | "yearly";
  amount?: number | null;
  onSubmitted?: () => void;
}

export const BankTransferDialog = ({ open, onOpenChange, agencyId, plan, period, amount, onSubmitted }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [bank, setBank] = useState<{ iban: string | null; account_holder: string | null; bank_name: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (supabase as any).from("platform_payment_settings").select("iban, account_holder, bank_name").eq("id", 1).maybeSingle()
      .then(({ data }: any) => setBank(data || null));
  }, [open]);

  const refCode = `TRZ-${(agencyId || "").slice(0, 8)}-${plan}`.toUpperCase();

  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); toast({ title: t("bankTransfer.copied") }); } catch { /* noop */ }
  };

  const submit = async () => {
    if (!agencyId) return;
    setSaving(true);
    const { error } = await (supabase as any).from("payment_requests").insert({
      agency_id: agencyId, plan, period, amount: amount ?? null, reference_code: refCode, status: "pending",
    });
    setSaving(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("bankTransfer.submittedTitle"), description: t("bankTransfer.submittedDesc") });
    onOpenChange(false);
    onSubmitted?.();
  };

  const row = (label: string, value: string | null | undefined) => (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{value || "—"}</p>
      </div>
      {value && (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => copy(value)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />{t("bankTransfer.title")}</DialogTitle>
          <DialogDescription>{t("bankTransfer.desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {bank?.iban
            ? (
              <>
                {row("IBAN", bank.iban)}
                {row(t("bankTransfer.accountHolder"), bank.account_holder)}
                {row(t("bankTransfer.bankName"), bank.bank_name)}
              </>
            )
            : <p className="text-sm text-muted-foreground">{t("bankTransfer.noIban")}</p>}
          {amount ? row(t("bankTransfer.amount"), `${amount.toLocaleString("tr-TR")}₺`) : null}
          {row(t("bankTransfer.reference"), refCode)}
          <p className="text-[11px] text-muted-foreground">{t("bankTransfer.referenceHint")}</p>
        </div>
        <Button className="w-full" onClick={submit} disabled={saving || !agencyId}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t("bankTransfer.iPaid")}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
