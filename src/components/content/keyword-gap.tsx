import { Check, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ProductContentAnalysisDTO } from "@/types/dto";

function TermChips({ terms, className }: { terms: string[]; className?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {terms.map((term) => (
        <span key={term} dir="auto" className={cn("rounded-md bg-muted px-2 py-0.5 text-xs", className)}>
          {term}
        </span>
      ))}
    </div>
  );
}

export function KeywordGap({ analysis }: { analysis: ProductContentAnalysisDTO }) {
  const { keywords, ownPageCaptured } = analysis;
  const pages = keywords.competitorPagesAnalyzed;

  if (pages === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ownPageCaptured ? "Keyword gap" : "Terms competitors use"}</CardTitle>
        <CardDescription>
          Words and phrases found on at least {keywords.minCompetitors} of {pages} competitor page{pages === 1 ? "" : "s"}
          {ownPageCaptured ? " that your page never mentions. Work the relevant ones into your own copy." : "."} Arabic
          spelling variants are counted together.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {keywords.missing.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ownPageCaptured ? "Missing term" : "Term"}</TableHead>
                <TableHead className="text-right">Competitor pages</TableHead>
                <TableHead className="text-right">Total mentions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.missing.map((t) => (
                <TableRow key={t.term}>
                  <TableCell dir="auto" className="font-medium">
                    {t.term}
                    {t.isPhrase ? <span className="ml-2 text-xs font-normal text-muted-foreground">phrase</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.competitorCount} / {pages}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.competitorOccurrences}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Your page already uses every term that competitors commonly use.</p>
        )}

        {keywords.shared.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Market terms you already use</p>
            <TermChips terms={keywords.shared.map((t) => t.term)} className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" />
          </div>
        ) : null}

        {keywords.uniqueToYou.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Terms only you use</p>
            <p className="text-xs text-muted-foreground">
              Possible differentiators, or words shoppers don&apos;t search for. Check them against Google Search Console.
            </p>
            <TermChips terms={keywords.uniqueToYou.map((t) => t.term)} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AttributeCoverage({ analysis }: { analysis: ProductContentAnalysisDTO }) {
  const pages = analysis.competitorPagesCaptured;
  const rows = analysis.attributes
    .filter((a) => a.own || a.competitorsWith.length > 0)
    .sort(
      (a, b) =>
        Number(a.own !== false) - Number(b.own !== false) ||
        b.competitorsWith.length - a.competitorsWith.length ||
        a.label.localeCompare(b.label),
    );

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product facts coverage</CardTitle>
        <CardDescription>
          Claims and details shoppers look for on cosmetics pages, such as ingredients, hair or skin type and &quot;sulfate-free&quot;.
          Only mention claims that are true for your product.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fact</TableHead>
              <TableHead className="text-center">Your page</TableHead>
              <TableHead className="text-right">Competitors</TableHead>
              <TableHead>Mentioned by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id} className={cn(a.own === false && a.competitorsWith.length > 0 && "bg-amber-500/5")}>
                <TableCell className="font-medium">{a.label}</TableCell>
                <TableCell className="text-center">
                  {a.own === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : a.own ? (
                    <Check className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" aria-label="Mentioned" />
                  ) : (
                    <Minus className="mx-auto size-4 text-amber-600 dark:text-amber-400" aria-label="Not mentioned" />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.competitorsWith.length} / {pages}
                </TableCell>
                <TableCell className="max-w-80 truncate text-sm text-muted-foreground" title={a.competitorsWith.join(", ")}>
                  {a.competitorsWith.join(", ") || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
