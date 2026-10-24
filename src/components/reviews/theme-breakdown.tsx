import { StoreLogo } from "@/components/matrix/store-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ReviewThemeStatsDTO, StoreReviewSummaryDTO } from "@/types/dto";

export function ThemeBreakdown({
  themes,
  stores,
}: {
  themes: ReviewThemeStatsDTO[];
  stores: StoreReviewSummaryDTO[];
}) {
  if (themes.length === 0) {
    return <p className="text-sm text-muted-foreground">No themes detected yet. Capture product pages that show customer reviews.</p>;
  }

  const topStores = stores.slice(0, 6);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Theme</TableHead>
          <TableHead className="text-right">Mentions</TableHead>
          <TableHead className="text-right">+</TableHead>
          <TableHead className="text-right">−</TableHead>
          <TableHead className="text-right">Net</TableHead>
          {topStores.map((s) => (
            <TableHead key={s.retailerId} className="text-center">
              <span className="flex flex-col items-center gap-1" title={s.retailerName}>
                <StoreLogo name={s.retailerName} domain={s.domain} size="sm" />
                <span className="line-clamp-1 max-w-20">{s.isOwnStore ? "You" : s.retailerName}</span>
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {themes.map((theme) => (
          <TableRow key={theme.themeId}>
            <TableCell className="font-medium">{theme.label}</TableCell>
            <TableCell className="text-right tabular-nums">{theme.mentions}</TableCell>
            <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-300">
              {theme.positive}
            </TableCell>
            <TableCell className="text-right tabular-nums text-rose-700 dark:text-rose-300">
              {theme.negative}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums",
                theme.netSentiment > 0.1 && "text-emerald-700 dark:text-emerald-300",
                theme.netSentiment < -0.1 && "text-rose-700 dark:text-rose-300",
              )}
            >
              {theme.netSentiment > 0 ? "+" : ""}
              {theme.netSentiment.toFixed(2)}
            </TableCell>
            {topStores.map((store) => {
              const local = store.themes.find((t) => t.themeId === theme.themeId);
              return (
                <TableCell key={store.retailerId} className="text-center tabular-nums text-muted-foreground">
                  {local ? local.mentions : "—"}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
