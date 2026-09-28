import { ChevronRight, ExternalLink, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SIMILARITY_THRESHOLDS } from "@/lib/services/content/content-analysis";
import { cn } from "@/lib/utils";
import type { ContentPageDTO } from "@/types/dto";
import { formatDateTime, formatRelativeTime } from "@/utils/format";

const storeLabel = (p: ContentPageDTO) => (p.isOwnStore ? `My Store (${p.retailerName})` : p.retailerName);

function Similarity({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const tone =
    value >= SIMILARITY_THRESHOLDS.duplicate
      ? "text-rose-600 dark:text-rose-400"
      : value >= SIMILARITY_THRESHOLDS.similar
        ? "text-amber-600 dark:text-amber-400"
        : "";
  return <span className={cn("tabular-nums", tone)}>{value}%</span>;
}

function Rating({ rating }: { rating: ContentPageDTO["rating"] }) {
  if (!rating || (rating.value === null && rating.count === null)) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {rating.value !== null ? (
        <>
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
          {rating.value.toFixed(1)}
        </>
      ) : null}
      {rating.count !== null ? <span className="text-muted-foreground">({rating.count})</span> : null}
    </span>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  );
}

function TextList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-sm" dir="auto">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PageDetails({ page }: { page: ContentPageDTO }) {
  const headings = [...page.headings.h1.map((h) => `H1 · ${h}`), ...page.headings.h2.map((h) => `H2 · ${h}`), ...page.headings.h3.map((h) => `H3 · ${h}`)];
  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
        <span className="truncate">{storeLabel(page)}</span>
        {page.versionCount > 1 ? (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {page.versionCount} versions
          </span>
        ) : null}
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Open page"
          title={page.url}
        >
          <ExternalLink className="size-4" />
        </a>
      </summary>
      <div className="space-y-4 border-t px-4 py-4">
        <Section label="Page title">
          <p className="text-sm" dir="auto">{page.title ?? "—"}</p>
        </Section>
        <Section label="Meta description">
          <p className="text-sm" dir="auto">{page.metaDescription ?? "—"}</p>
        </Section>
        <Section label={`Description (${page.metrics?.descriptionWords ?? 0} words)`}>
          <p className="max-h-72 overflow-y-auto text-sm whitespace-pre-line text-muted-foreground" dir="auto">
            {page.description ?? "—"}
          </p>
        </Section>
        {headings.length > 0 ? (
          <Section label="Headings">
            <TextList items={headings} />
          </Section>
        ) : null}
        {page.bulletPoints.length > 0 ? (
          <Section label="Bullet points">
            <TextList items={page.bulletPoints} />
          </Section>
        ) : null}
        {page.faqQuestions.length > 0 ? (
          <Section label="FAQ questions">
            <TextList items={page.faqQuestions} />
          </Section>
        ) : null}
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
          Current version first seen {formatDateTime(page.contentSince)} · last checked {formatRelativeTime(page.lastSeenAt)}
          {page.language ? ` · language: ${page.language}` : ""}
        </p>
      </div>
    </details>
  );
}

export function ContentPages({ pages }: { pages: ContentPageDTO[] }) {
  const captured = pages.filter((p) => p.captured);
  const missing = pages.filter((p) => !p.captured);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Page-by-page comparison</CardTitle>
        <CardDescription>
          &quot;Overlap&quot; is the share of words in the shorter of two descriptions (yours or the competitor&apos;s) that also
          appear in the other. High overlap usually means both pages use the manufacturer&apos;s text.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead className="text-right">Words</TableHead>
              <TableHead className="text-right">H2</TableHead>
              <TableHead className="text-right">Bullets</TableHead>
              <TableHead className="text-right">FAQ</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="text-right">Overlap</TableHead>
              <TableHead>Last change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {captured.map((p) => (
              <TableRow key={p.sourceId} className={cn(p.isOwnStore && "bg-muted/40")}>
                <TableCell className="max-w-72">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{storeLabel(p)}</span>
                    <span className="truncate text-xs text-muted-foreground" dir="auto" title={p.title ?? undefined}>
                      {p.title ?? "No title"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.metrics?.descriptionWords ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{p.metrics?.h2Count ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{p.metrics?.bulletCount ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{p.metrics?.faqCount ?? 0}</TableCell>
                <TableCell>
                  <Rating rating={p.rating} />
                </TableCell>
                <TableCell className="text-right">
                  {p.isOwnStore ? <span className="text-muted-foreground">—</span> : <Similarity value={p.similarityToOwn} />}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground" suppressHydrationWarning title={formatDateTime(p.contentSince)}>
                  {p.versionCount > 1 ? formatRelativeTime(p.contentSince) : "No changes"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {missing.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Not captured yet: {missing.map(storeLabel).join(", ")}. Use Capture content to try again; pages that block automated
            access can&apos;t be read.
          </p>
        ) : null}

        <div className="space-y-2">
          {captured.map((p) => (
            <PageDetails key={p.sourceId} page={p} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
