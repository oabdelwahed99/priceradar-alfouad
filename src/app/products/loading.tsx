import { HeaderSkeleton, TableSkeleton } from "@/components/layout/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-full sm:w-72" />
        <Skeleton className="hidden h-8 w-52 sm:block" />
      </div>
      <TableSkeleton rows={8} columns={8} />
    </>
  );
}
