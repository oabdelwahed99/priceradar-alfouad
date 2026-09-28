import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { MarkAllReadButton } from "@/components/alerts/alert-actions";
import { AlertItem } from "@/components/alerts/alert-item";
import { AlertsFilters } from "@/components/alerts/alerts-filters";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationNav } from "@/components/layout/pagination-nav";
import { Card, CardContent } from "@/components/ui/card";
import { loadPageData } from "@/lib/db/page-data";
import { countNewAlerts, listAlerts } from "@/lib/services/alerts/alert.service";
import { listAlertsQuerySchema, type ListAlertsQuery } from "@/lib/validation/alert.schema";
import { parseSearchParamsLenient, toQueryString } from "@/lib/validation/search-params";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Alerts · Price Radar" };

function alertsHref(query: ListAlertsQuery, overrides: Partial<ListAlertsQuery>): string {
  const next = { ...query, ...overrides };
  return `/alerts${toQueryString({
    status: next.status === "active" ? null : next.status,
    type: next.type,
    page: next.page > 1 ? next.page : null,
  })}`;
}

export default async function AlertsPage(props: PageProps<"/alerts">) {
  const query = parseSearchParamsLenient(listAlertsQuerySchema, await props.searchParams);
  const workspaceId = getCurrentWorkspaceId();
  const result = await loadPageData(() => Promise.all([listAlerts(workspaceId, query), countNewAlerts(workspaceId)]));

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Competitor price changes, stock-outs, and when your price moves more than 10% away from the market median."
        actions={result.ok ? <MarkAllReadButton disabled={result.data[1] === 0} /> : null}
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : (
        <>
          <AlertsFilters
            status={query.status}
            type={query.type}
            hrefFor={(next) => alertsHref(query, { ...next, page: 1 })}
          />
          {result.data[0].items.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="No alerts here"
              description="Alerts are created automatically when a price check detects a change worth your attention."
            />
          ) : (
            <Card size="sm">
              <CardContent>
                <ul className="divide-y">
                  {result.data[0].items.map((alert) => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <PaginationNav
            page={result.data[0].page}
            totalPages={result.data[0].totalPages}
            total={result.data[0].total}
            pageSize={result.data[0].pageSize}
            hrefForPage={(page) => alertsHref(query, { page })}
            itemLabel="alerts"
          />
        </>
      )}
    </>
  );
}
