import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const serviceConnections = mysqlTable("service_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("ready"),
  accountId: varchar("accountId", { length: 191 }),
  accountLabel: text("accountLabel"),
  scopes: text("scopes"),
  encryptedAccessToken: text("encryptedAccessToken"),
  encryptedRefreshToken: text("encryptedRefreshToken"),
  expiresAt: timestamp("expiresAt"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
});

export type ServiceConnection = typeof serviceConnections.$inferSelect;
export type InsertServiceConnection = typeof serviceConnections.$inferInsert;

export const backgroundJobs = mysqlTable("background_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  kind: varchar("kind", { length: 64 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("queued"),
  payload: text("payload").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 191 }).notNull().unique(),
  runAfter: timestamp("runAfter").defaultNow().notNull(),
  attempts: int("attempts").notNull().default(0),
  lockedAt: timestamp("lockedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type InsertBackgroundJob = typeof backgroundJobs.$inferInsert;

export const activityEvents = mysqlTable("activity_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  kind: varchar("kind", { length: 24 }).notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type InsertActivityEvent = typeof activityEvents.$inferInsert;

export const workflowTasks = mysqlTable("workflow_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  progress: int("progress").notNull().default(0),
  approvalRequired: int("approvalRequired").notNull().default(1),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type InsertWorkflowTask = typeof workflowTasks.$inferInsert;

export const approvalRequests = mysqlTable("approval_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  tag: varchar("tag", { length: 32 }).notNull(),
  risk: varchar("risk", { length: 24 }).notNull().default("review"),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  executionStatus: varchar("executionStatus", { length: 24 }).notNull().default("not_started"),
  idempotencyKey: varchar("idempotencyKey", { length: 191 }).notNull().unique(),
  executionError: text("executionError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  decidedAt: timestamp("decidedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type InsertApprovalRequest = typeof approvalRequests.$inferInsert;

export const environmentSecrets = mysqlTable("environment_secrets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  encryptedValue: text("encryptedValue").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  userNameUnique: uniqueIndex("environment_secrets_user_name_unique").on(table.userId, table.name),
}));

export type EnvironmentSecret = typeof environmentSecrets.$inferSelect;
export type InsertEnvironmentSecret = typeof environmentSecrets.$inferInsert;
