// Analiz sayfası loading skeleton — gerçek karta benzeyen.
// 4 KPI kartı + 1 büyük grafik + liste yerleşimi.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsSkeletonProps {
  /** KPI kart sayısı — varsayılan 4 */
  kpiCount?: number;
  /** Ana grafik altında liste de var mı? */
  showList?: boolean;
}

export function AnalyticsSkeleton({ kpiCount = 4, showList = true }: AnalyticsSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* KPI kartları */}
      <div className={`grid gap-4 md:grid-cols-2 ${kpiCount === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {Array.from({ length: kpiCount }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grafik */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded" />
        </CardContent>
      </Card>

      {/* Detay listesi */}
      {showList && (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-accent/30">
                  <div className="flex items-center gap-4 flex-1">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
