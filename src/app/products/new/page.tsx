import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/products/product-form";
import { buttonVariants } from "@/components/ui/button";

export default function NewProductPage() {
  return (
    <>
      <PageHeader
        title="Add Product"
        description="Enter your store URL and competitor URLs for the same product."
        actions={
          <Link href="/products" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft /> Back to products
          </Link>
        }
      />
      <ProductForm />
    </>
  );
}
