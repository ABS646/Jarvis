import { and, asc, desc, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { activityEvents, approvalRequests, backgroundJobs, environmentSecrets, InsertActivityEvent, InsertApprovalRequest, InsertBackgroundJob, InsertEnvironmentSecret, InsertServiceConnection, InsertUser, InsertWorkflowTask, serviceConnections, users, workflowTasks } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(openId: string, name: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  await db.update(users).set({ name }).where(eq(users.openId, openId));
  return getUserByOpenId(openId);
}

export async function listServiceConnections(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({ id: serviceConnections.id, provider: serviceConnections.provider, status: serviceConnections.status, accountId: serviceConnections.accountId, accountLabel: serviceConnections.accountLabel, scopes: serviceConnections.scopes, expiresAt: serviceConnections.expiresAt, lastUsedAt: serviceConnections.lastUsedAt }).from(serviceConnections).where(eq(serviceConnections.userId, userId));
}

export async function upsertServiceConnection(values: InsertServiceConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(serviceConnections).where(and(eq(serviceConnections.userId, values.userId), eq(serviceConnections.provider, values.provider))).limit(1);
  if (existing[0]) {
    await db.update(serviceConnections).set(values).where(eq(serviceConnections.id, existing[0].id));
    return { ...existing[0], ...values };
  }
  await db.insert(serviceConnections).values(values);
  const inserted = await db.select().from(serviceConnections).where(and(eq(serviceConnections.userId, values.userId), eq(serviceConnections.provider, values.provider))).limit(1);
  return inserted[0];
}

export async function getServiceConnectionById(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(serviceConnections).where(and(eq(serviceConnections.id, id), eq(serviceConnections.userId, userId))).limit(1);
  return rows[0];
}

export async function updateServiceConnectionIdentity(id: number, userId: number, identity: { accountId: string; accountLabel: string; metadata: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(serviceConnections).set({ accountId: identity.accountId, accountLabel: identity.accountLabel, metadata: identity.metadata, status: "connected", lastUsedAt: new Date() }).where(and(eq(serviceConnections.id, id), eq(serviceConnections.userId, userId)));
}

export async function revokeServiceConnection(provider: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(serviceConnections).set({ status: "revoked", encryptedAccessToken: null, encryptedRefreshToken: null, expiresAt: null }).where(and(eq(serviceConnections.provider, provider), eq(serviceConnections.userId, userId)));
}

export async function queueBackgroundJob(values: InsertBackgroundJob) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  try {
    await db.insert(backgroundJobs).values(values);
  } catch (error) {
    const existing = await db.select().from(backgroundJobs).where(eq(backgroundJobs.idempotencyKey, values.idempotencyKey)).limit(1);
    if (!existing[0]) throw error;
    return existing[0];
  }
  const inserted = await db.select().from(backgroundJobs).where(eq(backgroundJobs.idempotencyKey, values.idempotencyKey)).limit(1);
  return inserted[0];
}

export async function claimNextBackgroundJob() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const now = new Date();
  const candidates = await db.select().from(backgroundJobs).where(and(eq(backgroundJobs.status, "queued"), lte(backgroundJobs.runAfter, now))).orderBy(asc(backgroundJobs.runAfter)).limit(10);
  for (const candidate of candidates) {
    const update = await db.update(backgroundJobs).set({ status: "running", lockedAt: now, attempts: candidate.attempts + 1 }).where(and(eq(backgroundJobs.id, candidate.id), eq(backgroundJobs.status, "queued")));
    if (update[0].affectedRows > 0) return { ...candidate, status: "running", lockedAt: now, attempts: candidate.attempts + 1 };
  }
  return undefined;
}

export async function finishBackgroundJob(id: number, status: "succeeded" | "failed", lastError?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(backgroundJobs).set({ status, lastError: lastError ?? null }).where(eq(backgroundJobs.id, id));
}

export async function listActivityEvents(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(activityEvents).where(eq(activityEvents.userId, userId)).orderBy(desc(activityEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 200));
}

export async function createActivityEvent(values: InsertActivityEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(activityEvents).values(values);
  return (await db.select().from(activityEvents).where(eq(activityEvents.userId, values.userId)).orderBy(desc(activityEvents.createdAt)).limit(1))[0];
}

export async function listWorkflowTasks(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(workflowTasks).where(eq(workflowTasks.userId, userId)).orderBy(desc(workflowTasks.updatedAt)).limit(100);
}

export async function createWorkflowTask(values: InsertWorkflowTask) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(workflowTasks).values(values);
  return (await db.select().from(workflowTasks).where(eq(workflowTasks.userId, values.userId)).orderBy(desc(workflowTasks.createdAt)).limit(1))[0];
}

export async function updateWorkflowTask(id: number, userId: number, values: Partial<Pick<InsertWorkflowTask, "title" | "detail" | "status" | "progress" | "approvalRequired" | "error">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(workflowTasks).where(and(eq(workflowTasks.id, id), eq(workflowTasks.userId, userId))).limit(1);
  if (!existing[0]) throw new Error("Task not found");
  await db.update(workflowTasks).set(values).where(and(eq(workflowTasks.id, id), eq(workflowTasks.userId, userId)));
  return (await db.select().from(workflowTasks).where(and(eq(workflowTasks.id, id), eq(workflowTasks.userId, userId))).limit(1))[0];
}

export async function deleteWorkflowTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select({ id: workflowTasks.id }).from(workflowTasks).where(and(eq(workflowTasks.id, id), eq(workflowTasks.userId, userId))).limit(1);
  if (!existing[0]) throw new Error("Task not found");
  await db.delete(workflowTasks).where(and(eq(workflowTasks.id, id), eq(workflowTasks.userId, userId)));
  return { success: true as const, id };
}

export async function listApprovalRequests(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(approvalRequests).where(eq(approvalRequests.userId, userId)).orderBy(desc(approvalRequests.updatedAt)).limit(100);
}

export async function createApprovalRequest(values: InsertApprovalRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  try {
    await db.insert(approvalRequests).values(values);
  } catch (error) {
    const existing = await db.select().from(approvalRequests).where(eq(approvalRequests.idempotencyKey, values.idempotencyKey)).limit(1);
    if (!existing[0]) throw error;
    return existing[0];
  }
  return (await db.select().from(approvalRequests).where(eq(approvalRequests.idempotencyKey, values.idempotencyKey)).limit(1))[0];
}

export async function decideApprovalRequest(id: number, userId: number, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, id), eq(approvalRequests.userId, userId))).limit(1);
  if (!existing[0]) throw new Error("Approval request not found");
  if (existing[0].status !== "pending") return existing[0];
  await db.update(approvalRequests).set({ status, decidedAt: new Date(), executionStatus: "not_started" }).where(and(eq(approvalRequests.id, id), eq(approvalRequests.userId, userId), eq(approvalRequests.status, "pending")));
  return (await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, id), eq(approvalRequests.userId, userId))).limit(1))[0];
}

export async function listEnvironmentSecrets(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(environmentSecrets).where(eq(environmentSecrets.userId, userId)).orderBy(asc(environmentSecrets.name));
}

export async function deleteEnvironmentSecret(name: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select({ id: environmentSecrets.id }).from(environmentSecrets).where(and(eq(environmentSecrets.userId, userId), eq(environmentSecrets.name, name))).limit(1);
  if (!existing[0]) return { success: true as const, deleted: false as const };
  await db.delete(environmentSecrets).where(and(eq(environmentSecrets.id, existing[0].id), eq(environmentSecrets.userId, userId)));
  return { success: true as const, deleted: true as const };
}

export async function upsertEnvironmentSecret(values: InsertEnvironmentSecret) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(environmentSecrets).where(and(eq(environmentSecrets.userId, values.userId), eq(environmentSecrets.name, values.name))).limit(1);
  if (existing[0]) {
    await db.update(environmentSecrets).set({ encryptedValue: values.encryptedValue }).where(and(eq(environmentSecrets.id, existing[0].id), eq(environmentSecrets.userId, values.userId)));
    return (await db.select().from(environmentSecrets).where(eq(environmentSecrets.id, existing[0].id)).limit(1))[0];
  }
  await db.insert(environmentSecrets).values(values);
  return (await db.select().from(environmentSecrets).where(and(eq(environmentSecrets.userId, values.userId), eq(environmentSecrets.name, values.name))).limit(1))[0];
}
