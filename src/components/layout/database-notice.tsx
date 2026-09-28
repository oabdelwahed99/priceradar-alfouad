import { DatabaseZap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DatabaseNotice({ message }: { message?: string }) {
  return (
    <Alert>
      <DatabaseZap />
      <AlertTitle>Database unavailable</AlertTitle>
      <AlertDescription>
        {message ??
          "Set MONGODB_URI in .env.local (see .env.example) and restart the server to load data."}
      </AlertDescription>
    </Alert>
  );
}
