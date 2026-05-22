import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet, Sparkles, MessageSquare, Zap } from "lucide-react";

interface QuickActionsProps {
  onNewTour: () => void;
  onBulkImport: () => void;
  onManualReg: () => void;
  onNavigateWhatsApp: () => void;
}

export function QuickActions({ onNewTour, onBulkImport, onManualReg, onNavigateWhatsApp }: QuickActionsProps) {
  const { t } = useTranslation();

  // Visual polish: birinci aksiyon (Yeni Tur) primary CTA — gradient ocean + glow.
  // Diğerleri outline kalır (ikincil aksiyon, görsel hiyerarşi).
  const actions = [
    {
      icon: Plus,
      label: t("tours.addFirstTour", { defaultValue: "Yeni Tur" }),
      onClick: onNewTour,
      primary: true,
    },
    {
      icon: FileSpreadsheet,
      label: t("tours.bulkImport", { defaultValue: "Excel İçe Aktar" }),
      onClick: onBulkImport,
      className: "hover:border-green-500/60 hover:bg-green-500/5",
    },
    {
      icon: Sparkles,
      label: t("commandPalette.manualRegistration", { defaultValue: "Manuel Rezervasyon" }),
      onClick: onManualReg,
      className: "hover:border-orange-500/60 hover:bg-orange-500/5",
    },
    {
      icon: MessageSquare,
      label: "WhatsApp",
      onClick: onNavigateWhatsApp,
      className: "hover:border-blue-500/60 hover:bg-blue-500/5",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          {t("dashboard.quickActions.title", { defaultValue: "Hızlı Aksiyonlar" })}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) =>
            action.primary ? (
              <Button
                key={action.label}
                className="h-auto py-3 flex-col gap-1.5 text-xs motion-safe:transition-all motion-safe:duration-200 bg-gradient-ocean text-primary-foreground hover:opacity-90 motion-safe:hover:scale-[1.02] shadow-sm"
                onClick={action.onClick}
              >
                <action.icon className="h-4 w-4" />
                <span className="leading-tight text-center font-semibold">{action.label}</span>
              </Button>
            ) : (
              <Button
                key={action.label}
                variant="outline"
                className={`h-auto py-3 flex-col gap-1.5 text-xs motion-safe:transition-all motion-safe:duration-150 ${action.className}`}
                onClick={action.onClick}
              >
                <action.icon className="h-4 w-4" />
                <span className="leading-tight text-center">{action.label}</span>
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
