import { CardSkeleton, HeaderSkeleton, TableSkeleton } from "@/components/layout/page-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-5 w-24" />
      <HeaderSkeleton />
      <Card>
        <CardContent className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
      <TableSkeleton rows={5} />
      <CardSkeleton />
    </>
  );
}
