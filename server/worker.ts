import { decryptSecret, fetchProviderIdentity, type Provider } from "./connectors";
import { claimNextBackgroundJob, finishBackgroundJob, getEnvironmentSecret, getServiceConnectionById, markBackgroundJobWaiting, updateServiceConnectionIdentity } from "./db";
import { callbackUrl, signN8nPayload } from "./n8n";

async function dispatchN8nWebhook(job: Awaited<ReturnType<typeof claimNextBackgroundJob>>) {
  if (!job) throw new Error("Background job is missing");
  const webhookRecord = await getEnvironmentSecret("N8N_WEBHOOK_URL", job.userId);
  if (!webhookRecord) throw new Error("N8N_WEBHOOK_URL is not configured in the API Vault");
  const webhookUrl = decryptSecret(webhookRecord.encryptedValue);
  const payload = JSON.parse(job.payload) as { workflowPayload: Record<string, unknown> };
  const body = JSON.stringify({
    idempotencyKey: job.idempotencyKey,
    callbackUrl: callbackUrl(),
    payload: payload.workflowPayload,
  });
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-JARVIS-Signature": signN8nPayload(body) },
    body,
  });
  if (!response.ok) throw new Error(`n8n webhook returned HTTP ${response.status}`);
  await markBackgroundJobWaiting(job.id);
}

export async function processNextBackgroundJob() {
  const job = await claimNextBackgroundJob();
  if (!job) return { status: "idle" as const };

  try {
    const payload = JSON.parse(job.payload) as { connectionId?: number; provider?: Provider };
    if (job.kind === "sync_connection" && payload.connectionId && payload.provider) {
      const connection = await getServiceConnectionById(payload.connectionId, job.userId);
      if (!connection?.encryptedAccessToken) throw new Error("Connection token is missing");
      const identity = await fetchProviderIdentity(payload.provider, decryptSecret(connection.encryptedAccessToken));
      await updateServiceConnectionIdentity(connection.id, job.userId, identity);
    } else if (job.kind === "n8n_webhook") {
      await dispatchN8nWebhook(job);
      return { status: "waiting_callback" as const, jobId: job.id, kind: job.kind };
    } else if (job.kind !== "health_check") {
      throw new Error(`Unsupported background job: ${job.kind}`);
    }
    await finishBackgroundJob(job.id, "succeeded");
    return { status: "succeeded" as const, jobId: job.id, kind: job.kind };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background job failed";
    await finishBackgroundJob(job.id, "failed", message);
    return { status: "failed" as const, jobId: job.id, error: message };
  }
}
