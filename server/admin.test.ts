import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 1, role: "admin" | "user" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Admin Panel Functionality", () => {
  let adminUserId: number;
  let regularUserId: number;
  let testOrgId: number;
  let testProjectId: number;

  beforeAll(async () => {
    const timestamp = Date.now();
    
    // Create admin user
    await db.upsertUser({
      openId: `admin-user-${timestamp}`,
      name: "Admin User",
      email: `admin-${timestamp}@test.com`,
      role: "admin",
    });

    const adminUser = await db.getUserByOpenId(`admin-user-${timestamp}`);
    if (!adminUser) throw new Error("Failed to create admin user");
    adminUserId = adminUser.id;

    // Create regular user
    await db.upsertUser({
      openId: `regular-user-${timestamp}`,
      name: "Regular User",
      email: `regular-${timestamp}@test.com`,
      role: "user",
    });

    const regularUser = await db.getUserByOpenId(`regular-user-${timestamp}`);
    if (!regularUser) throw new Error("Failed to create regular user");
    regularUserId = regularUser.id;

    // Create test organization
    testOrgId = await db.createOrganization({
      name: `Admin Test Org ${timestamp}`,
      slug: `admin-test-org-${timestamp}`,
      ownerUserId: adminUserId,
      orgDatabase: `supabase_org_admin_test_${timestamp}`,
    });

    // Add admin as organization member
    await db.addOrganizationMember({
      organizationId: testOrgId,
      userId: adminUserId,
      role: "owner",
    });

    // Create test project
    testProjectId = await db.createProject({
      organizationId: testOrgId,
      name: `Admin Test Project ${timestamp}`,
      slug: `admin-test-project-${timestamp}`,
      databaseName: `supabase_org_admin_test_${timestamp}`,
      databaseSchema: `admin_test_schema_${timestamp}`,
      region: "us-east-1",
      status: "active",
    });
  });

  describe("Admin Statistics", () => {
    it("should return platform statistics for admin users", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const stats = await caller.admin.stats();

      expect(stats).toHaveProperty("totalUsers");
      expect(stats).toHaveProperty("totalOrganizations");
      expect(stats).toHaveProperty("totalProjects");
      expect(stats).toHaveProperty("activeProjects");
      expect(stats.totalUsers).toBeGreaterThanOrEqual(2);
      expect(stats.totalOrganizations).toBeGreaterThanOrEqual(1);
      expect(stats.totalProjects).toBeGreaterThanOrEqual(1);
    });

    it("should prevent non-admin users from accessing statistics", async () => {
      const caller = appRouter.createCaller(createTestContext(regularUserId, "user"));

      await expect(caller.admin.stats()).rejects.toThrow();
    });
  });

  describe("User Management", () => {
    it("should list all users for admin", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const users = await caller.admin.users();

      expect(users).toBeInstanceOf(Array);
      expect(users.length).toBeGreaterThanOrEqual(2);
      expect(users[0]).toHaveProperty("id");
      expect(users[0]).toHaveProperty("name");
      expect(users[0]).toHaveProperty("email");
      expect(users[0]).toHaveProperty("role");
    });

    it("should prevent non-admin from listing users", async () => {
      const caller = appRouter.createCaller(createTestContext(regularUserId, "user"));

      await expect(caller.admin.users()).rejects.toThrow();
    });

    it("should allow admin to update user role", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const result = await caller.users.update({
        id: regularUserId,
        role: "admin",
      });

      expect(result).toHaveProperty("success", true);

      // Verify the update
      const updatedUser = await db.getUserById(regularUserId);
      expect(updatedUser?.role).toBe("admin");

      // Revert back to user role
      await caller.users.update({
        id: regularUserId,
        role: "user",
      });
    });

    it("should prevent non-admin from updating user roles", async () => {
      const caller = appRouter.createCaller(createTestContext(regularUserId, "user"));

      await expect(
        caller.users.update({
          id: adminUserId,
          role: "user",
        })
      ).rejects.toThrow();
    });
  });

  describe("Organization Management", () => {
    it("should list all organizations for admin", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const organizations = await caller.admin.organizations();

      expect(organizations).toBeInstanceOf(Array);
      expect(organizations.length).toBeGreaterThanOrEqual(1);
      expect(organizations[0]).toHaveProperty("id");
      expect(organizations[0]).toHaveProperty("name");
      expect(organizations[0]).toHaveProperty("slug");
      expect(organizations[0]).toHaveProperty("orgDatabase");
    });

    it("should prevent non-admin from listing all organizations", async () => {
      const caller = appRouter.createCaller(createTestContext(regularUserId, "user"));

      await expect(caller.admin.organizations()).rejects.toThrow();
    });
  });

  describe("Project Management", () => {
    it("should list all projects for admin", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const projects = await caller.admin.projects();

      expect(projects).toBeInstanceOf(Array);
      expect(projects.length).toBeGreaterThanOrEqual(1);
      expect(projects[0]).toHaveProperty("id");
      expect(projects[0]).toHaveProperty("name");
      expect(projects[0]).toHaveProperty("slug");
      expect(projects[0]).toHaveProperty("status");
    });

    it("should prevent non-admin from listing all projects", async () => {
      const caller = appRouter.createCaller(createTestContext(regularUserId, "user"));

      await expect(caller.admin.projects()).rejects.toThrow();
    });
  });

  describe("Audit Logs", () => {
    it("should list audit logs for admin", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const logs = await caller.auditLogs.list({ limit: 50 });

      expect(logs).toBeInstanceOf(Array);
      // Logs might be empty if no actions have been logged yet
      if (logs.length > 0) {
        expect(logs[0]).toHaveProperty("id");
        expect(logs[0]).toHaveProperty("action");
        expect(logs[0]).toHaveProperty("resourceType");
        expect(logs[0]).toHaveProperty("userId");
        expect(logs[0]).toHaveProperty("timestamp");
      }
    });

    it("should prevent non-admin from viewing audit logs", async () => {
      const caller = appRouter.createCaller(createTestContext(regularUserId, "user"));

      await expect(
        caller.auditLogs.list({ limit: 50 })
      ).rejects.toThrow();
    });

    it("should respect limit parameter", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const logs = await caller.auditLogs.list({ limit: 10 });

      expect(logs).toBeInstanceOf(Array);
      expect(logs.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Access Control", () => {
    it("should enforce admin role for all admin endpoints", async () => {
      const caller = appRouter.createCaller(createTestContext(regularUserId, "user"));

      await expect(caller.admin.stats()).rejects.toThrow();
      await expect(caller.admin.users()).rejects.toThrow();
      await expect(caller.admin.organizations()).rejects.toThrow();
      await expect(caller.admin.projects()).rejects.toThrow();
      await expect(caller.auditLogs.list({ limit: 10 })).rejects.toThrow();
    });

    it("should allow admin access to all admin endpoints", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const stats = await caller.admin.stats();
      const users = await caller.admin.users();
      const organizations = await caller.admin.organizations();
      const projects = await caller.admin.projects();
      const logs = await caller.auditLogs.list({ limit: 10 });

      expect(stats).toBeDefined();
      expect(users).toBeInstanceOf(Array);
      expect(organizations).toBeInstanceOf(Array);
      expect(projects).toBeInstanceOf(Array);
      expect(logs).toBeInstanceOf(Array);
    });
  });

  describe("Data Integrity", () => {
    it("should return consistent data across endpoints", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const stats = await caller.admin.stats();
      const users = await caller.admin.users();
      const organizations = await caller.admin.organizations();
      const projects = await caller.admin.projects();

      expect(stats.totalUsers).toBe(users.length);
      expect(stats.totalOrganizations).toBe(organizations.length);
      expect(stats.totalProjects).toBe(projects.length);
    });

    it("should correctly count active projects", async () => {
      const caller = appRouter.createCaller(createTestContext(adminUserId, "admin"));

      const stats = await caller.admin.stats();
      const projects = await caller.admin.projects();

      const activeProjectsCount = projects.filter(p => p.status === "active").length;
      expect(stats.activeProjects).toBe(activeProjectsCount);
    });
  });
});
