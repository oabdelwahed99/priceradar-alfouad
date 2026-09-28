import { ArrowDownRight, ArrowUpRight, FilePenLine, PackageX, TrendingUpDown, type LucideIcon } from "lucide-react";
import type { AlertType } from "@/types";

export const ALERT_TYPE_META: Record<AlertType, { label: string; icon: LucideIcon; className: string }> = {
  PRICE_CHANGE: { label: "Price change", icon: TrendingUpDown, className: "bg-violet-500/10 text-violet-600" },
  OVERPRICED: { label: "Overpriced", icon: ArrowUpRight, className: "bg-rose-500/10 text-rose-600" },
  UNDERPRICED: { label: "Underpriced", icon: ArrowDownRight, className: "bg-sky-500/10 text-sky-600" },
  OUT_OF_STOCK: { label: "Out of stock", icon: PackageX, className: "bg-amber-500/10 text-amber-600" },
  CONTENT_CHANGE: { label: "Content change", icon: FilePenLine, className: "bg-emerald-500/10 text-emerald-600" },
};
