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

  const actions = [
    {
      icon: Plus,
      label: t("tours.addFirstTour", { defaultValue: "Yeni Tur" }),
      onClick: onNewTour,
      className: "hover:border-primary hover:bg-primary/5",
    },
    {
      icon: FileSpreadsheet,
      label: t("tours.bulkImport", { defaultValue: "Excel İçe Aktar" }),
      onClick: onBulkImport,
      className: "hover:border-green-500 hover:bg-green-500/5",
    },
    {
      icon: Sparkles,
      label: t("commandPalette.manualRegistration", { defaultValue: "Manuel Rezervasyon" }),
      onClick: onManualReg,
      className: "hover:border-orange-500 hover:bg-orange-500/5",
    },
    {
      icon: MessageSquare,
      label: "WhatsApp",
      onClick: onNavigateWhatsApp,
      className: "hover:border-blue-500 hover:bg-blue-500/5",
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
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className={`h-auto py-3 flex-col gap-1.5 text-xs transition-all duration-150 ${action.className}`}
              onClick={action.onClick}
            >
              <action.icon className="h-4 w-4" />
              <span className="leading-tight text-center">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
