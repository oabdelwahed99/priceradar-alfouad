import type { Metadata } from "next";
import { connection } from "next/server";
import { Plus, Store } from "lucide-react";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { RetailerFormDialog } from "@/components/retailers/retailer-form-dialog";
import { RetailersTable } from "@/components/retailers/retailers-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadPageData } from "@/lib/db/page-data";
import { listRetailersWithStats } from "@/lib/services/retailers/retailer.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Retailers · Price Radar" };

export default async function RetailersPage() {
  await connection();
  const result = await loadPageData(() => listRetailersWithStats(getCurrentWorkspaceId()));

  return (
    <>
      <PageHeader
        title="Retailers"
        description="Stores you monitor. New retailers are added automatically from product URLs."
        actions={
          result.ok ? (
            <RetailerFormDialog
              trigger={
                <Button>
                  <Plus /> Add Retailer
                </Button>
              }
            />
          ) : null
        }
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No retailers yet"
          description="Add a product and its retailers will appear here, or add a retailer manually."
        />
      ) : (
        <Card>
          <CardContent>
            <RetailersTable retailers={result.data} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
