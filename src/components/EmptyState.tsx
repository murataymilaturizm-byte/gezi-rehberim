import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; variant?: "default" | "outline" };
  secondaryAction?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <Card className="p-10 text-center border-dashed">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {action && (
            <Button size="sm" variant={action.variant ?? "default"} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button size="sm" variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
