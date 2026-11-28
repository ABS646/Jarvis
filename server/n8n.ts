import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

export type N8nCallbackBody = {
  idempotencyKey: string;
  status: "succeeded" | "failed";
  result?: unknown;
  error?: string;
};

export function signN8nPayload(payload: string, secret = ENV.n8nWebhookSecret) {
  if (!secret) throw new Error("N8N_WEBHOOK_SECRET is not configured");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyN8nSignature(payload: string, signature: string | undefined, secret = ENV.n8nWebhookSecret) {
  if (!signature || !secret) return false;
  const expected = signN8nPayload(payload, secret);
  const provided = Buffer.from(signature.trim(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
}

export function callbackUrl() {
  const origin = ENV.publicAppUrl.replace(/\/$/, "");
  if (!origin) throw new Error("PUBLIC_APP_URL is required for n8n callbacks");
  return `${origin}/api/webhooks/n8n`;
}
