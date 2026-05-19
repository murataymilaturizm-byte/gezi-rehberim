import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";

export interface TrendPoint {
  date: string;
  current: number;
  previous: number;
}

interface SalesTrendChartProps {
  weekData: TrendPoint[];
  monthData: TrendPoint[];
  currency?: string;
}

export function SalesTrendChart({ weekData, monthData, currency = "₺" }: SalesTrendChartProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<"week" | "month">("week");

  const data = period === "week" ? weekData : monthData;
  const hasData = data.some((d) => d.current > 0 || d.previous > 0);

  const formatTick = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return v.toString();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t("dashboard.salesTrend.title", { defaultValue: "Satış Trendi" })}
          </CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as "week" | "month")}>
            <TabsList className="h-7">
              <TabsTrigger value="week" className="text-xs h-6 px-2">
                {t("common.weekly", { defaultValue: "Haftalık" })}
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs h-6 px-2">
                {t("common.monthly", { defaultValue: "Aylık" })}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasData ? (
          <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
            {t("dashboard.salesTrend.noData", { defaultValue: "Henüz yeterli veri yok" })}
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(16 95% 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(16 95% 55%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(215 20% 65%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(215 20% 65%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  tickFormatter={formatTick}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  formatter={(val: number) => `${val.toLocaleString("tr-TR")} ${currency}`}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="previous"
                  name={t("dashboard.salesTrend.previousPeriod", { defaultValue: "Önceki dönem" })}
                  stroke="hsl(215 20% 65%)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  fill="url(#prevGrad)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  name={t("dashboard.salesTrend.currentPeriod", { defaultValue: "Bu dönem" })}
                  stroke="hsl(16 95% 55%)"
                  strokeWidth={2}
                  fill="url(#currentGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
