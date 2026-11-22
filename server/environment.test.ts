import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "./connectors";
import { environmentSecretBelongsToUser, environmentUpdateMessage, environmentUpdateSchema, maskEnvironmentSecret } from "./environment";

afterEach(() => vi.unstubAllEnvs());

describe("API Vault security contracts", () => {
  it("masks decrypted values without returning the plaintext", () => {
    vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", "vault-test-key");
    const plaintext = "apify_secret_token";
    const masked = maskEnvironmentSecret(encryptSecret(plaintext));
    expect(masked).toBe("apif…********");
    expect(masked).not.toContain(plaintext);
  });

  it("accepts only the supported Apify and n8n fields", () => {
    expect(environmentUpdateSchema.safeParse({ OPENAI_API_KEY: "should-be-rejected" }).success).toBe(false);
    expect(environmentUpdateSchema.safeParse({ APIFY_API_TOKEN: "token" }).success).toBe(true);
    expect(environmentUpdateSchema.safeParse({ N8N_WEBHOOK_URL: "https://n8n.example.test/hook" }).success).toBe(true);
  });

  it("keeps environment records scoped to the authenticated user", () => {
    expect(environmentSecretBelongsToUser({ userId: 7 }, 7)).toBe(true);
    expect(environmentSecretBelongsToUser({ userId: 7 }, 8)).toBe(false);
  });

  it("fails closed when connector encryption is not configured", () => {
    vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", "");
    expect(() => encryptSecret("token")).toThrow("CONNECTOR_ENCRYPTION_KEY is not configured");
  });

  it("preserves the exact successful-update activity message", () => {
    expect(environmentUpdateMessage).toBe("[SYSTEM] Environment variables updated successfully. Core systems online.");
  });
});
