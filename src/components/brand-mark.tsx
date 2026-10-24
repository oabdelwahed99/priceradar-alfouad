import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={32}
      height={32}
      className={cn("size-7 shrink-0 rounded-md", className)}
    />
  );
}
