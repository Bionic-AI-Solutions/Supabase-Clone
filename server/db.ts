import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditLogs,
  billingEvents,
  edgeFunctionLogs,
  edgeFunctions,
  InsertAuditLog,
  InsertBillingEvent,
  InsertEdgeFunction,
  InsertEdgeFunctionLog,
  InsertOrganization,
  InsertOrganizationMember,
  InsertPlanLimit,
  InsertProject,
  InsertProjectCredential,
  InsertRealtimeChannel,
  InsertSubscription,
  InsertUsageMetric,
  InsertUser,
  organizationMembers,
  organizations,
  planLimits,
  projectCredentials,
  projects,
  realtimeChannels,
  subscriptions,
  usageMetrics,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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

// ============================================================================
// USERS
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
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
      values.role = "admin";
      updateSet.role = "admin";
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
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUser(id: number, updates: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set(updates).where(eq(users.id, id));
}

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export async function createOrganization(org: InsertOrganization) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(organizations).values(org);
  return result[0].insertId;
}

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrganizationBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserOrganizations(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      ownerUserId: organizations.ownerUserId,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      role: organizationMembers.role,
    })
    .from(organizations)
    .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(desc(organizations.createdAt));
}

export async function updateOrganization(id: number, data: Partial<InsertOrganization>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(organizations).set(data).where(eq(organizations.id, id));
}

export async function deleteOrganization(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(organizations).where(eq(organizations.id, id));
}

export async function getAllOrganizations() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(organizations).orderBy(desc(organizations.createdAt));
}

// ============================================================================
// ORGANIZATION MEMBERS
// ============================================================================

export async function addOrganizationMember(member: InsertOrganizationMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(organizationMembers).values(member);
}

export async function getOrganizationMembers(organizationId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(desc(organizationMembers.joinedAt));
}

export async function updateOrganizationMemberRole(memberId: number, role: "owner" | "admin" | "member") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(organizationMembers).set({ role }).where(eq(organizationMembers.id, memberId));
}

export async function removeOrganizationMember(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
}

export async function getUserOrganizationRole(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId))
    )
    .limit(1);

  return result.length > 0 ? result[0].role : undefined;
}

// ============================================================================
// PROJECTS
// ============================================================================

export async function createProject(project: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projects).values(project);
  return result[0].insertId;
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProjectBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrganizationProjects(organizationId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .orderBy(desc(projects.createdAt));
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(projects).set({ status: "deleted", deletedAt: new Date() }).where(eq(projects.id, id));
}

export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(projects).orderBy(desc(projects.createdAt));
}

// ============================================================================
// PROJECT CREDENTIALS
// ============================================================================

export async function createProjectCredentials(credentials: InsertProjectCredential) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(projectCredentials).values(credentials);
}

export async function getProjectCredentials(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(projectCredentials)
    .where(eq(projectCredentials.projectId, projectId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateProjectCredentials(projectId: number, data: Partial<InsertProjectCredential>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(projectCredentials).set(data).where(eq(projectCredentials.projectId, projectId));
}

// ============================================================================
// EDGE FUNCTIONS
// ============================================================================

export async function createEdgeFunction(func: InsertEdgeFunction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(edgeFunctions).values(func);
  return result[0].insertId;
}

export async function getProjectEdgeFunctions(projectId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(edgeFunctions)
    .where(eq(edgeFunctions.projectId, projectId))
    .orderBy(desc(edgeFunctions.createdAt));
}

export async function getEdgeFunctionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(edgeFunctions).where(eq(edgeFunctions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateEdgeFunction(id: number, data: Partial<InsertEdgeFunction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(edgeFunctions).set(data).where(eq(edgeFunctions.id, id));
}

export async function deleteEdgeFunction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(edgeFunctions).where(eq(edgeFunctions.id, id));
}

export async function createEdgeFunctionLog(log: InsertEdgeFunctionLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(edgeFunctionLogs).values(log);
}

export async function getEdgeFunctionLogs(functionId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(edgeFunctionLogs)
    .where(eq(edgeFunctionLogs.functionId, functionId))
    .orderBy(desc(edgeFunctionLogs.timestamp))
    .limit(limit);
}

// ============================================================================
// REALTIME CHANNELS
// ============================================================================

export async function createRealtimeChannel(channel: InsertRealtimeChannel) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(realtimeChannels).values(channel);
  return result[0].insertId;
}

export async function getProjectRealtimeChannels(projectId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(realtimeChannels)
    .where(eq(realtimeChannels.projectId, projectId))
    .orderBy(desc(realtimeChannels.createdAt));
}

export async function getRealtimeChannelById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(realtimeChannels).where(eq(realtimeChannels.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateRealtimeChannel(id: number, data: Partial<InsertRealtimeChannel>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(realtimeChannels).set(data).where(eq(realtimeChannels.id, id));
}

export async function deleteRealtimeChannel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(realtimeChannels).where(eq(realtimeChannels.id, id));
}

// ============================================================================
// USAGE METRICS
// ============================================================================

export async function createUsageMetric(metric: InsertUsageMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(usageMetrics).values(metric);
}

export async function getProjectUsageMetrics(
  projectId: number,
  metricType?: string,
  startDate?: Date,
  endDate?: Date
) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(usageMetrics).where(eq(usageMetrics.projectId, projectId));

  const conditions = [eq(usageMetrics.projectId, projectId)];

  if (metricType) {
    conditions.push(eq(usageMetrics.metricType, metricType as any));
  }

  if (startDate) {
    conditions.push(gte(usageMetrics.periodStart, startDate));
  }

  if (endDate) {
    conditions.push(lte(usageMetrics.periodEnd, endDate));
  }

  return await db
    .select()
    .from(usageMetrics)
    .where(and(...conditions))
    .orderBy(desc(usageMetrics.periodStart));
}

export async function getProjectCurrentUsage(projectId: number) {
  const db = await getDb();
  if (!db) return {};

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const metrics = await db
    .select()
    .from(usageMetrics)
    .where(
      and(eq(usageMetrics.projectId, projectId), gte(usageMetrics.periodStart, startOfMonth))
    );

  const usage: Record<string, number> = {};

  metrics.forEach((metric) => {
    if (!usage[metric.metricType]) {
      usage[metric.metricType] = 0;
    }
    usage[metric.metricType] += metric.value;
  });

  return usage;
}

// ============================================================================
// SUBSCRIPTIONS & BILLING
// ============================================================================

export async function createSubscription(subscription: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(subscriptions).values(subscription);
}

export async function getOrganizationSubscription(organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateSubscription(organizationId: number, data: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(subscriptions).set(data).where(eq(subscriptions.organizationId, organizationId));
}

export async function getPlanLimits(planType: "free" | "pro" | "enterprise") {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(planLimits).where(eq(planLimits.planType, planType)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPlanLimit(limit: InsertPlanLimit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(planLimits).values(limit);
}

export async function createBillingEvent(event: InsertBillingEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(billingEvents).values(event);
}

export async function getOrganizationBillingEvents(organizationId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(billingEvents.organizationId, organizationId)];

  if (startDate) {
    conditions.push(gte(billingEvents.timestamp, startDate));
  }

  if (endDate) {
    conditions.push(lte(billingEvents.timestamp, endDate));
  }

  return await db
    .select()
    .from(billingEvents)
    .where(and(...conditions))
    .orderBy(desc(billingEvents.timestamp));
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export async function createAuditLog(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(auditLogs).values(log);
}

export async function getOrganizationAuditLogs(organizationId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit);
}

export async function getProjectAuditLogs(projectId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.projectId, projectId))
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit);
}

export async function getAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit);
}
