export interface EmailAddress {
  email: string;
  name?: string;
}

export interface SendEmailMessage {
  to: EmailAddress;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  email: string;
  status: "sent" | "failed";
  providerMessageId: string | null;
  error: string | null;
}

export interface EmailTransport {
  send(message: SendEmailMessage): Promise<SendEmailResult>;
}
