import { HeaderSkeleton, KpiGridSkeleton, TableSkeleton } from "@/components/layout/page-skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <KpiGridSkeleton />
      <TableSkeleton rows={5} />
    </>
  );
}
