import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Page not found"
      description="The page or product you are looking for does not exist or was deleted."
      action={
        <Link href="/products" className={buttonVariants({ variant: "outline" })}>
          Back to products
        </Link>
      }
    />
  );
}
