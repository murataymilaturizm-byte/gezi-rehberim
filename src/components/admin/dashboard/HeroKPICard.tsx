import { type ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";

interface SparkPoint { date: string; value: number }

interface HeroKPICardProps {
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  previousValue: number;
  currentValue: number;
  comparisonLabel?: string;
  /**
   * K1: İkincil metrik (Tahsilat vs Rezervasyon Hacmi ayrımı için).
   * Tahsilat kartında "Rezerve: X₺", Bugün kartında "Hacim: Y₺" vb.
   * Spakline'ın altında küçük puntoda gösterilir; opsiyoneldir.
   */
  secondaryLabel?: string;
  sparkline?: SparkPoint[];
  colorClass?: string;       // tailwind text color class e.g. "text-primary"
  strokeColor?: string;      // CSS color for chart line
  gradientId?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export function HeroKPICard({
  title,
  value,
  prefix = "",
  suffix = "",
  previousValue,
  currentValue,
  comparisonLabel,
  secondaryLabel,
  sparkline = [],
  colorClass = "text-primary",
  strokeColor = "hsl(16 95% 55%)",
  gradientId = "kpi-grad",
  icon,
  onClick,
}: HeroKPICardProps) {
  const change =
    previousValue === 0
      ? currentValue > 0 ? 100 : 0
      : ((currentValue - previousValue) / previousValue) * 100;

  const isFlat = Math.abs(change) < 0.5;
  const isPositive = change > 0.5;

  const TrendIcon = isFlat ? Minus : isPositive ? TrendingUp : TrendingDown;
  const trendColor = isFlat
    ? "text-muted-foreground"
    : isPositive
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  // Visual polish: tüm KPI kartlarda yumuşak hover lift (tıklanabilir/olmayan fark etmez,
  // ama tıklanabilirler daha belirgin). motion-safe ile reduced-motion'a saygı.
  return (
    <Card
      className={cn(
        "overflow-hidden motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:shadow-lg",
        onClick && "cursor-pointer motion-safe:hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
          {icon && (
            <div className="rounded-lg p-1.5 bg-muted/40">{icon}</div>
          )}
        </div>

        <p className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
          {/* AnimatedCounter sayısal değerlerde 0'dan animasyonla sayar; string ise olduğu gibi render */}
          {typeof value === "number" ? (
            <AnimatedCounter to={value} prefix={prefix} suffix={suffix} duration={1.2} />
          ) : (
            <>{prefix}{value}{suffix}</>
          )}
        </p>

        <div className="flex items-center gap-1.5">
          <div className={cn("flex items-center gap-0.5 text-xs font-semibold", trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {isFlat ? "—" : `${isPositive ? "+" : ""}${change.toFixed(1)}%`}
          </div>
          {comparisonLabel && (
            <span className="text-xs text-muted-foreground">{comparisonLabel}</span>
          )}
        </div>

        {/* K1: ikincil metrik — Tahsilat vs Rezervasyon Hacmi ayrımı */}
        {secondaryLabel && (
          <p className="text-[11px] text-muted-foreground mt-1 truncate" title={secondaryLabel}>
            {secondaryLabel}
          </p>
        )}

        {sparkline.length > 0 && (
          <div className="h-10 -mx-1 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  dot={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded border bg-popover px-2 py-1 text-xs shadow">
                        <p className="text-muted-foreground">{payload[0].payload.date}</p>
                        <p className="font-semibold">{payload[0].value}</p>
                      </div>
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
