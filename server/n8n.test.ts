import { describe, expect, it } from "vitest";
import { signN8nPayload, verifyN8nSignature } from "./n8n";

describe("n8n webhook signatures", () => {
  it("accepts an exact payload signed with the configured secret", () => {
    const payload = JSON.stringify({ idempotencyKey: "job-12345678", status: "succeeded", result: { ok: true } });
    const signature = signN8nPayload(payload, "test-secret");
    expect(verifyN8nSignature(payload, signature, "test-secret")).toBe(true);
  });

  it("rejects a changed payload or wrong secret", () => {
    const payload = JSON.stringify({ idempotencyKey: "job-12345678", status: "succeeded" });
    const signature = signN8nPayload(payload, "test-secret");
    expect(verifyN8nSignature(`${payload} `, signature, "test-secret")).toBe(false);
    expect(verifyN8nSignature(payload, signature, "wrong-secret")).toBe(false);
  });
});
