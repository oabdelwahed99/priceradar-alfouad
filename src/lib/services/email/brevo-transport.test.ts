import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { assertVerifiedBrevoSender, BrevoTransport } from "./brevo-transport";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.BREVO_API_KEY;
  delete process.env.EMAIL_FROM_ADDRESS;
  delete process.env.EMAIL_FROM_NAME;
});

describe("BrevoTransport", () => {
  it("fails clearly when Brevo is not configured", async () => {
    const transport = new BrevoTransport();
    const result = await transport.send({
      to: { email: "ceo@example.com", name: "CEO" },
      subject: "Report",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/not configured/i);
  });

  it("posts the Brevo transactional payload and returns the message id", async () => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.EMAIL_FROM_ADDRESS = "reports@example.com";
    process.env.EMAIL_FROM_NAME = "Price Radar";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "msg-123" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const transport = new BrevoTransport();
    const result = await transport.send({
      to: { email: "ceo@example.com", name: "CEO" },
      subject: "Weekly report",
      html: "<p>Body</p>",
      text: "Body",
    });

    expect(result).toEqual({
      email: "ceo@example.com",
      status: "sent",
      providerMessageId: "msg-123",
      error: null,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect(init.headers["api-key"]).toBe("test-key");
    expect(JSON.parse(init.body)).toMatchObject({
      sender: { email: "reports@example.com", name: "Price Radar" },
      to: [{ email: "ceo@example.com", name: "CEO" }],
      subject: "Weekly report",
      htmlContent: "<p>Body</p>",
      textContent: "Body",
    });
  });

  it("maps provider errors to failed results", async () => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.EMAIL_FROM_ADDRESS = "reports@example.com";
    process.env.EMAIL_FROM_NAME = "Price Radar";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Key not valid" }),
    }) as unknown as typeof fetch;

    const transport = new BrevoTransport();
    const result = await transport.send({
      to: { email: "ceo@example.com" },
      subject: "Weekly report",
      html: "<p>Body</p>",
      text: "Body",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Key not valid");
  });
});

describe("assertVerifiedBrevoSender", () => {
  it("rejects an unverified from address before send", async () => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.EMAIL_FROM_ADDRESS = "info@price-radar.com";
    process.env.EMAIL_FROM_NAME = "Price Radar";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        senders: [{ email: "oabdelwahed99@gmail.com", active: true }],
      }),
    }) as unknown as typeof fetch;

    await expect(assertVerifiedBrevoSender()).rejects.toBeInstanceOf(AppError);
    await expect(assertVerifiedBrevoSender()).rejects.toThrow(/not a verified Brevo sender/i);
  });
});
