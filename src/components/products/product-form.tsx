"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GitCompareArrows, Loader2, Plus, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { MAX_COMPETITORS, MIN_COMPETITORS } from "@/lib/validation/common";
import { productFormSchema, type ProductFormValues } from "@/lib/validation/product.schema";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

type SubmitStage = "idle" | "saving" | "comparing";

export function ProductForm() {
  const router = useRouter();
  const [stage, setStage] = useState<SubmitStage>("idle");

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      brand: "",
      size: "",
      ownStoreUrl: "",
      competitors: [{ url: "" }, { url: "" }, { url: "" }],
    },
    mode: "onTouched",
  });
  const { register, control, handleSubmit, formState, setError } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "competitors" });
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setStage("saving");
    try {
      const { id } = await apiFetch<{ id: string }>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          brand: values.brand,
          size: values.size,
          ownStoreUrl: values.ownStoreUrl,
          competitorUrls: values.competitors.map((c) => c.url),
        }),
      });
      setStage("comparing");
      try {
        await apiFetch(`/api/products/${id}/compare`, { method: "POST" });
      } catch (error) {
        const message = error instanceof ApiClientError ? error.message : "Comparison failed";
        toast.warning(`Product saved, but comparison did not complete: ${message}`);
      }
      router.push(`/products/${id}`);
      router.refresh();
    } catch (error) {
      setStage("idle");
      if (error instanceof ApiClientError) {
        const fieldErrors = error.body.details?.fieldErrors ?? {};
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (!messages?.length) continue;
          const target = field === "competitorUrls" ? "competitors" : field;
          setError(target as keyof ProductFormValues, { message: messages[0] });
        }
        toast.error(error.message);
      } else {
        toast.error("Could not save the product.");
      }
    }
  });

  const busy = stage !== "idle";
  const competitorsRootError = errors.competitors?.root?.message ?? errors.competitors?.message;

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3" noValidate>
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Product</CardTitle>
            <CardDescription>Name the product you want to compare across stores.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Product Name</Label>
              <Input id="name" placeholder="e.g. Demo Foaming Cleanser 236ml" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand">Brand (optional)</Label>
              <Input id="brand" placeholder="e.g. Demo Brand" {...register("brand")} />
              <FieldError message={errors.brand?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="size">Size (optional)</Label>
              <Input id="size" placeholder="e.g. 236ml" {...register("size")} />
              <FieldError message={errors.size?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="size-4" /> Own Store URL
            </CardTitle>
            <CardDescription>The product page on your own store.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Input
              id="ownStoreUrl"
              type="url"
              inputMode="url"
              placeholder="https://mystore.com/product/item"
              aria-invalid={!!errors.ownStoreUrl}
              {...register("ownStoreUrl")}
            />
            <FieldError message={errors.ownStoreUrl?.message} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Competitor URLs</CardTitle>
            <CardDescription>
              The same product on competitor stores ({MIN_COMPETITORS}–{MAX_COMPETITORS} URLs).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={`competitor-${index}`} className="text-muted-foreground">
                  Competitor {index + 1}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`competitor-${index}`}
                    type="url"
                    inputMode="url"
                    placeholder={`https://store-${String.fromCharCode(97 + (index % 26))}.com/product/item`}
                    aria-invalid={!!errors.competitors?.[index]?.url}
                    {...register(`competitors.${index}.url` as const)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove competitor ${index + 1}`}
                    disabled={fields.length <= MIN_COMPETITORS || busy}
                    onClick={() => remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <FieldError message={errors.competitors?.[index]?.url?.message} />
              </div>
            ))}
            <FieldError message={competitorsRootError} />
            <Button
              type="button"
              variant="outline"
              disabled={fields.length >= MAX_COMPETITORS || busy}
              onClick={() => append({ url: "" })}
            >
              <Plus /> Add competitor
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Compare</CardTitle>
            <CardDescription>
              We open each URL, extract the current price and compare your price with the market.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <GitCompareArrows />}
              {stage === "saving" && "Saving product…"}
              {stage === "comparing" && `Scraping ${fields.length + 1} stores…`}
              {stage === "idle" && "Compare Prices"}
            </Button>
            {stage === "comparing" ? (
              <p className="text-xs text-muted-foreground">
                This can take up to a minute. Stores are scraped a few at a time with polite delays.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <p className="px-1 text-xs text-muted-foreground">
          Only publicly accessible product pages are supported. Pages disallowed by robots.txt or protected by bot
          checks are skipped and reported.
        </p>
      </div>
    </form>
  );
}
