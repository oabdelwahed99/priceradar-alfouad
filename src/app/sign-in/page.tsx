import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCOUNT_ID, ACCOUNT_NAME } from "@/lib/auth/constants";

export const metadata: Metadata = { title: "Sign in · Price Radar" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="relative flex flex-1 flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--muted),transparent_58%)]"
      />
      <div className="relative flex flex-1 flex-col">
        <SiteHeader signedIn={false} showAction={false} />
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                {ACCOUNT_NAME} workspace. Use account ID <span className="font-mono text-foreground">{ACCOUNT_ID}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignInForm nextPath={nextPath} />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
