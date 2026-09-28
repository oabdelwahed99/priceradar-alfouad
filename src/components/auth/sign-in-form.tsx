"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { ACCOUNT_ID } from "@/lib/auth/constants";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm({ nextPath }: { nextPath?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="accountId">Account ID</Label>
        <Input
          id="accountId"
          name="accountId"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={ACCOUNT_ID}
          required
          className="h-10 font-mono"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10"
        />
      </div>
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
