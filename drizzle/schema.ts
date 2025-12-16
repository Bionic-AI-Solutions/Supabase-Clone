import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, boolean, decimal, json } from "drizzle-orm/mysql-core";

/**
 * Multi-Tenant Supabase Platform Database Schema
 * 
 * This schema supports:
 * - Organizations with team members
 * - Projects with full isolation
 * - Usage tracking and billing
 * - Edge Functions and Realtime per project
 */

// ============================================================================
// USERS & AUTHENTICATION
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
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

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  ownerUserId: int("ownerUserId").notNull(),
  // Organization-level database name for multi-tenant isolation
  orgDatabase: varchar("orgDatabase", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

export const organizationMembers = mysqlTable("organizationMembers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "member"]).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;

// ============================================================================
// PROJECTS
// ============================================================================

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  organizationId: int("organizationId").notNull(),
  
  // Database configuration (schema-based isolation within org database)
  databaseName: varchar("databaseName", { length: 255 }).notNull(), // Organization database name
  databaseSchema: varchar("databaseSchema", { length: 255 }).notNull().unique(), // Project-specific schema
  databaseHost: varchar("databaseHost", { length: 255 }),
  databasePort: int("databasePort").default(5432),
  
  // Region and status
  region: varchar("region", { length: 50 }).default("us-west-1"),
  status: mysqlEnum("status", ["active", "paused", "provisioning", "deleting", "deleted"]).default("provisioning").notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  pausedAt: timestamp("pausedAt"),
  deletedAt: timestamp("deletedAt"),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ============================================================================
// PROJECT CREDENTIALS
// ============================================================================

export const projectCredentials = mysqlTable("projectCredentials", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().unique(),
  
  // JWT and API Keys
  jwtSecret: varchar("jwtSecret", { length: 255 }).notNull(),
  anonKey: text("anonKey").notNull(),
  serviceKey: text("serviceKey").notNull(),
  
  // Database credentials
  dbUsername: varchar("dbUsername", { length: 255 }).notNull(),
  dbPassword: varchar("dbPassword", { length: 255 }).notNull(),
  
  // Storage configuration
  storageBucket: varchar("storageBucket", { length: 255 }).notNull(),
  
  // Connection strings
  postgresConnectionString: text("postgresConnectionString"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectCredential = typeof projectCredentials.$inferSelect;
export type InsertProjectCredential = typeof projectCredentials.$inferInsert;

// ============================================================================
// EDGE FUNCTIONS
// ============================================================================

export const edgeFunctions = mysqlTable("edgeFunctions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  
  // Function configuration
  status: mysqlEnum("status", ["active", "inactive", "deploying", "failed"]).default("inactive").notNull(),
  version: int("version").default(1).notNull(),
  
  // Runtime configuration
  importMapUrl: text("importMapUrl"),
  entrypoint: varchar("entrypoint", { length: 500 }).default("index.ts").notNull(),
  verifyJwt: boolean("verifyJwt").default(true).notNull(),
  
  // Environment variables (JSON object)
  envVars: json("envVars"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deployedAt: timestamp("deployedAt"),
});

export type EdgeFunction = typeof edgeFunctions.$inferSelect;
export type InsertEdgeFunction = typeof edgeFunctions.$inferInsert;

export const edgeFunctionLogs = mysqlTable("edgeFunctionLogs", {
  id: int("id").autoincrement().primaryKey(),
  functionId: int("functionId").notNull(),
  projectId: int("projectId").notNull(),
  
  level: mysqlEnum("level", ["info", "warn", "error", "debug"]).notNull(),
  message: text("message").notNull(),
  metadata: json("metadata"),
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type EdgeFunctionLog = typeof edgeFunctionLogs.$inferSelect;
export type InsertEdgeFunctionLog = typeof edgeFunctionLogs.$inferInsert;

// ============================================================================
// REALTIME CONFIGURATION
// ============================================================================

export const realtimeChannels = mysqlTable("realtimeChannels", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  
  // Channel configuration
  type: mysqlEnum("type", ["broadcast", "presence", "postgres_changes"]).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  
  // Postgres CDC configuration (for postgres_changes type)
  schema: varchar("schema", { length: 255 }),
  table: varchar("table", { length: 255 }),
  filter: text("filter"),
  
  // Configuration JSON
  config: json("config"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RealtimeChannel = typeof realtimeChannels.$inferSelect;
export type InsertRealtimeChannel = typeof realtimeChannels.$inferInsert;

// ============================================================================
// USAGE TRACKING
// ============================================================================

export const usageMetrics = mysqlTable("usageMetrics", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  
  // Metric type and value
  metricType: mysqlEnum("metricType", [
    "database_size_mb",
    "api_calls",
    "storage_bytes",
    "bandwidth_bytes",
    "edge_function_invocations",
    "realtime_connections"
  ]).notNull(),
  
  value: bigint("value", { mode: "number" }).notNull(),
  
  // Time period
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  granularity: mysqlEnum("granularity", ["hourly", "daily", "weekly", "monthly"]).notNull(),
  
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type UsageMetric = typeof usageMetrics.$inferSelect;
export type InsertUsageMetric = typeof usageMetrics.$inferInsert;

// ============================================================================
// BILLING & SUBSCRIPTIONS
// ============================================================================

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().unique(),
  
  // Plan details
  planType: mysqlEnum("planType", ["free", "pro", "enterprise"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "expired", "past_due"]).default("active").notNull(),
  
  // Billing cycle
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).default("monthly").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
  
  // Stripe integration (for future)
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  cancelledAt: timestamp("cancelledAt"),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

export const planLimits = mysqlTable("planLimits", {
  id: int("id").autoincrement().primaryKey(),
  planType: mysqlEnum("planType", ["free", "pro", "enterprise"]).notNull().unique(),
  
  // Resource limits
  maxProjects: int("maxProjects").notNull(),
  maxDatabaseSizeMb: int("maxDatabaseSizeMb").notNull(),
  maxStorageGb: int("maxStorageGb").notNull(),
  maxBandwidthGb: int("maxBandwidthGb").notNull(),
  maxApiCallsPerMonth: bigint("maxApiCallsPerMonth", { mode: "number" }).notNull(),
  maxEdgeFunctions: int("maxEdgeFunctions").notNull(),
  maxRealtimeConnections: int("maxRealtimeConnections").notNull(),
  
  // Features
  customDomain: boolean("customDomain").default(false).notNull(),
  prioritySupport: boolean("prioritySupport").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlanLimit = typeof planLimits.$inferSelect;
export type InsertPlanLimit = typeof planLimits.$inferInsert;

export const billingEvents = mysqlTable("billingEvents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  organizationId: int("organizationId").notNull(),
  
  // Event details
  eventType: mysqlEnum("eventType", [
    "api_call",
    "storage_write",
    "storage_read",
    "bandwidth_out",
    "edge_function_invocation",
    "realtime_connection"
  ]).notNull(),
  
  quantity: bigint("quantity", { mode: "number" }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 4 }),
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type BillingEvent = typeof billingEvents.$inferSelect;
export type InsertBillingEvent = typeof billingEvents.$inferInsert;

// ============================================================================
// AUDIT LOGS
// ============================================================================

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  
  action: varchar("action", { length: 255 }).notNull(),
  resourceType: varchar("resourceType", { length: 100 }).notNull(),
  resourceId: int("resourceId"),
  
  metadata: json("metadata"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
