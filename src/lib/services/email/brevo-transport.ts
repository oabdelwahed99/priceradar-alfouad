import { AppError } from "@/lib/errors";
import { getBrevoEnv, type BrevoEnv } from "./brevo-env";
import type { EmailTransport, SendEmailMessage, SendEmailResult } from "./types";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_SENDERS_URL = "https://api.brevo.com/v3/senders";

export class BrevoTransport implements EmailTransport {
  async send(message: SendEmailMessage): Promise<SendEmailResult> {
    const env = getBrevoEnv();
    if (!env) {
      return {
        email: message.to.email,
        status: "failed",
        providerMessageId: null,
        error: "Email is not configured. Set BREVO_API_KEY, EMAIL_FROM_ADDRESS, and EMAIL_FROM_NAME.",
      };
    }

    try {
      const response = await fetch(BREVO_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { email: env.EMAIL_FROM_ADDRESS, name: env.EMAIL_FROM_NAME },
          to: [{ email: message.to.email, name: message.to.name }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { messageId?: string; message?: string; code?: string }
        | null;

      if (!response.ok) {
        const error =
          body?.message ||
          (typeof body?.code === "string" ? body.code : null) ||
          `Brevo request failed (${response.status})`;
        return {
          email: message.to.email,
          status: "failed",
          providerMessageId: null,
          error,
        };
      }

      return {
        email: message.to.email,
        status: "sent",
        providerMessageId: body?.messageId ?? null,
        error: null,
      };
    } catch (error) {
      return {
        email: message.to.email,
        status: "failed",
        providerMessageId: null,
        error: error instanceof Error ? error.message : "Failed to reach Brevo",
      };
    }
  }
}

/** Brevo can return HTTP 201 and still reject delivery if the sender is not verified. */
export async function assertVerifiedBrevoSender(env: BrevoEnv = getRequiredBrevoEnv()): Promise<void> {
  let response: Response;
  try {
    response = await fetch(BREVO_SENDERS_URL, {
      headers: { accept: "application/json", "api-key": env.BREVO_API_KEY },
    });
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "Failed to reach Brevo while checking senders.",
      503,
      "EMAIL_PROVIDER_UNAVAILABLE",
    );
  }

  const body = (await response.json().catch(() => null)) as
    | { senders?: Array<{ email?: string; active?: boolean }>; message?: string }
    | null;

  if (!response.ok) {
    throw new AppError(
      body?.message || `Brevo sender check failed (${response.status}).`,
      502,
      "EMAIL_PROVIDER_ERROR",
    );
  }

  const from = env.EMAIL_FROM_ADDRESS.toLowerCase();
  const match = (body?.senders ?? []).find((sender) => sender.email?.toLowerCase() === from && sender.active);
  if (!match) {
    const available = (body?.senders ?? [])
      .filter((sender) => sender.active && sender.email)
      .map((sender) => sender.email)
      .join(", ");
    throw new AppError(
      available
        ? `EMAIL_FROM_ADDRESS (${env.EMAIL_FROM_ADDRESS}) is not a verified Brevo sender. Use one of: ${available}`
        : `EMAIL_FROM_ADDRESS (${env.EMAIL_FROM_ADDRESS}) is not a verified Brevo sender. Verify a sender in Brevo first.`,
      400,
      "EMAIL_SENDER_NOT_VERIFIED",
    );
  }
}

function getRequiredBrevoEnv(): BrevoEnv {
  const env = getBrevoEnv();
  if (!env) {
    throw new AppError(
      "Email is not configured. Set BREVO_API_KEY, EMAIL_FROM_ADDRESS, and EMAIL_FROM_NAME.",
      503,
      "EMAIL_NOT_CONFIGURED",
    );
  }
  return env;
}

let cachedTransport: EmailTransport | null = null;

export function getEmailTransport(): EmailTransport {
  if (!cachedTransport) cachedTransport = new BrevoTransport();
  return cachedTransport;
}

/** Used by tests to inject a mock transport. */
export function setEmailTransportForTests(transport: EmailTransport | null): void {
  cachedTransport = transport;
}

export function assertEmailConfigured(): void {
  getRequiredBrevoEnv();
}
