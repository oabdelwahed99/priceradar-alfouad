import { HeaderSkeleton, TableSkeleton } from "@/components/layout/page-skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <TableSkeleton rows={5} />
    </>
  );
}
