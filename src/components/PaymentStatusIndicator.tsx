import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentStatus = "pending" | "processing" | "completed" | "failed";

interface PaymentStatusIndicatorProps {
  status: PaymentStatus;
  isOpen: boolean;
  onClose?: () => void;
}

export const PaymentStatusIndicator = ({ 
  status, 
  isOpen,
  onClose 
}: PaymentStatusIndicatorProps) => {
  const { t } = useTranslation();

  const statusConfig = {
    pending: {
      icon: Clock,
      title: t("admin.payment.status.pending"),
      message: t("admin.payment.messages.pending"),
      iconColor: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
      animation: "animate-pulse",
    },
    processing: {
      icon: Loader2,
      title: t("admin.payment.status.processing"),
      message: t("admin.payment.messages.processing"),
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      animation: "animate-spin",
    },
    completed: {
      icon: CheckCircle2,
      title: t("admin.payment.status.completed"),
      message: t("admin.payment.messages.completed"),
      iconColor: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      animation: "animate-scale-in",
    },
    failed: {
      icon: XCircle,
      title: t("admin.payment.status.failed"),
      message: t("admin.payment.messages.failed"),
      iconColor: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      animation: "animate-fade-in",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center justify-center space-y-6 py-8">
          {/* Animated Icon */}
          <div className={cn(
            "relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500",
            config.bgColor
          )}>
            {/* Pulsing background ring */}
            <div className={cn(
              "absolute inset-0 rounded-full",
              status === "processing" && "animate-ping opacity-20",
              config.bgColor
            )} />
            
            {/* Icon */}
            <Icon 
              className={cn(
                "w-12 h-12 relative z-10",
                config.iconColor,
                config.animation
              )} 
            />
          </div>

          {/* Status Text */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              {config.title}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {config.message}
            </p>
          </div>

          {/* Progress Indicator for processing/pending */}
          {(status === "pending" || status === "processing") && (
            <div className="w-full max-w-xs">
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    status === "pending" ? "bg-yellow-500 animate-pulse" : "bg-blue-500",
                    "w-full animate-[slide-in-right_2s_ease-in-out_infinite]"
                  )}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                {t("admin.payment.pleaseWait")}...
              </p>
            </div>
          )}

          {/* Loading dots for processing */}
          {status === "processing" && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
