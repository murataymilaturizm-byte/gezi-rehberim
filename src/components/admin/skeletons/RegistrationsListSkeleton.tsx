import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function RegistrationsListSkeleton() {
  return (
    <Card>
      <div className="p-4 border-b">
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-20 hidden sm:block" />
            <Skeleton className="h-7 w-24 hidden md:block" />
          </div>
        ))}
      </div>
    </Card>
  );
}
