import { decryptSecret, fetchProviderIdentity, type Provider } from "./connectors";
import { claimNextBackgroundJob, finishBackgroundJob, getServiceConnectionById, updateServiceConnectionIdentity } from "./db";

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
