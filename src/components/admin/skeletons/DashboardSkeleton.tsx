import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[0, 1].map((i) => (
          <Card key={i} className="shadow-card">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="shadow-card">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-6 w-6 rounded-lg" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-7 w-12 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + recent */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardContent className="p-4 sm:p-6">
            <Skeleton className="h-5 w-36 mb-4" />
            <Skeleton className="h-48 w-full rounded" />
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4 sm:p-6">
            <Skeleton className="h-5 w-36 mb-4" />
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
