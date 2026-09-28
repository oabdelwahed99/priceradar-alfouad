import { HeaderSkeleton } from "@/components/layout/page-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <Card size="sm">
        <CardContent className="divide-y">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex gap-3 py-3">
              <Skeleton className="size-8 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
