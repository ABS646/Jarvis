import { z } from "zod";
import { decryptSecret } from "./connectors";

export const environmentSecretNames = ["OPENAI_API_KEY", "APIFY_API_TOKEN", "N8N_WEBHOOK_URL"] as const;
export type EnvironmentSecretName = (typeof environmentSecretNames)[number];

export const environmentUpdateSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1).max(4096).optional(),
  APIFY_API_TOKEN: z.string().trim().min(1).max(4096).optional(),
  N8N_WEBHOOK_URL: z.string().trim().url().max(2048).optional(),
}).strict().refine(input => input.OPENAI_API_KEY !== undefined || input.APIFY_API_TOKEN !== undefined || input.N8N_WEBHOOK_URL !== undefined, "At least one supported environment value is required");

export const environmentUpdateMessage = "[SYSTEM] API Vault values updated.";

export function maskEnvironmentSecret(encryptedValue: string) {
  const value = decryptSecret(encryptedValue);
  return value.length > 4 ? `${value.slice(0, 4)}…********` : "********";
}

export function environmentSecretBelongsToUser(record: { userId: number }, userId: number) {
  return record.userId === userId;
}
