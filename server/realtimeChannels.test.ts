import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
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

describe("Realtime Channels Management", () => {
  let testUserId: number;
  let testOrgId: number;
  let testProjectId: number;
  let testChannelId: number;

  beforeAll(async () => {
    const timestamp = Date.now();
    
    // Use upsertUser to ensure test user exists
    await db.upsertUser({
      openId: `test-realtime-user-${timestamp}`,
      name: "Realtime Test User",
      email: `realtime-${timestamp}@test.com`,
      role: "user",
    });

    const user = await db.getUserByOpenId(`test-realtime-user-${timestamp}`);
    if (!user) throw new Error("Failed to create test user");
    testUserId = user.id;

    // Create test organization
    testOrgId = await db.createOrganization({
      name: `Realtime Test Org ${timestamp}`,
      slug: `realtime-test-org-${timestamp}`,
      ownerUserId: testUserId,
      orgDatabase: `supabase_org_rt_test_${timestamp}`,
    });

    // Add owner as organization member
    await db.addOrganizationMember({
      organizationId: testOrgId,
      userId: testUserId,
      role: "owner",
    });

    // Create test project
    testProjectId = await db.createProject({
      organizationId: testOrgId,
      name: `Realtime Test Project ${timestamp}`,
      slug: `realtime-test-project-${timestamp}`,
      databaseName: `supabase_org_rt_test_${timestamp}`,
      databaseSchema: `realtime_test_schema_${timestamp}`,
      region: "us-east-1",
      status: "active",
    });
  });

  describe("Realtime Channel CRUD Operations", () => {
    it("should create a broadcast channel", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.realtime.channels.create({
        projectId: testProjectId,
        name: "public:broadcast",
        type: "broadcast",
      });

      expect(result).toHaveProperty("id");
      testChannelId = result.id;
    });

    it("should create a presence channel", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.realtime.channels.create({
        projectId: testProjectId,
        name: "public:presence",
        type: "presence",
      });

      expect(result).toHaveProperty("id");
    });

    it("should create a postgres_changes channel", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.realtime.channels.create({
        projectId: testProjectId,
        name: "public:messages",
        type: "postgres_changes",
        schema: "public",
        table: "messages",
        filter: "user_id=eq.123",
      });

      expect(result).toHaveProperty("id");
    });

    it("should list channels for a project", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const channels = await caller.realtime.channels.list({ projectId: testProjectId });

      expect(channels).toBeInstanceOf(Array);
      expect(channels.length).toBeGreaterThanOrEqual(3);
      expect(channels[0]).toHaveProperty("name");
      expect(channels[0]).toHaveProperty("type");
      expect(channels[0]).toHaveProperty("enabled");
    });

    it("should get channel by id", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const channel = await caller.realtime.channels.getById({ id: testChannelId });

      expect(channel).toHaveProperty("id", testChannelId);
      expect(channel).toHaveProperty("name", "public:broadcast");
      expect(channel).toHaveProperty("type", "broadcast");
      expect(channel).toHaveProperty("enabled", true);
    });

    it("should update channel enabled status", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.realtime.channels.update({
        id: testChannelId,
        enabled: false,
      });

      expect(result).toHaveProperty("success", true);

      // Verify the update
      const channel = await caller.realtime.channels.getById({ id: testChannelId });
      expect(channel.enabled).toBe(false);
    });

    it("should update channel configuration", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const config = { maxConnections: 100, timeout: 30 };

      const result = await caller.realtime.channels.update({
        id: testChannelId,
        config,
      });

      expect(result).toHaveProperty("success", true);

      // Verify the update
      const channel = await caller.realtime.channels.getById({ id: testChannelId });
      expect(channel.config).toEqual(config);
    });
  });

  describe("Channel Types", () => {
    it("should create broadcast channel with correct properties", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.realtime.channels.create({
        projectId: testProjectId,
        name: "broadcast:notifications",
        type: "broadcast",
      });

      const channel = await caller.realtime.channels.getById({ id: result.id });

      expect(channel.type).toBe("broadcast");
      expect(channel.schema).toBeNull();
      expect(channel.table).toBeNull();
      expect(channel.filter).toBeNull();

      // Cleanup
      await caller.realtime.channels.delete({ id: result.id });
    });

    it("should create presence channel with correct properties", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.realtime.channels.create({
        projectId: testProjectId,
        name: "presence:room-123",
        type: "presence",
      });

      const channel = await caller.realtime.channels.getById({ id: result.id });

      expect(channel.type).toBe("presence");
      expect(channel.schema).toBeNull();
      expect(channel.table).toBeNull();

      // Cleanup
      await caller.realtime.channels.delete({ id: result.id });
    });

    it("should create postgres_changes channel with database config", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.realtime.channels.create({
        projectId: testProjectId,
        name: "postgres:users",
        type: "postgres_changes",
        schema: "public",
        table: "users",
        filter: "status=eq.active",
      });

      const channel = await caller.realtime.channels.getById({ id: result.id });

      expect(channel.type).toBe("postgres_changes");
      expect(channel.schema).toBe("public");
      expect(channel.table).toBe("users");
      expect(channel.filter).toBe("status=eq.active");

      // Cleanup
      await caller.realtime.channels.delete({ id: result.id });
    });
  });

  describe("Channel Access Control", () => {
    it("should prevent unauthorized users from accessing channels", async () => {
      await db.upsertUser({
        openId: "unauthorized-realtime-user",
        name: "Unauthorized User",
        email: "unauthorized-realtime@test.com",
        role: "user",
      });

      const unauthorizedUser = await db.getUserByOpenId("unauthorized-realtime-user");
      if (!unauthorizedUser) throw new Error("Failed to create unauthorized user");

      const caller = appRouter.createCaller(createTestContext(unauthorizedUser.id));

      await expect(
        caller.realtime.channels.getById({ id: testChannelId })
      ).rejects.toThrow();
    });

    it("should prevent non-admin users from creating channels", async () => {
      // Create a member user
      await db.upsertUser({
        openId: "member-realtime-user",
        name: "Member User",
        email: "member-realtime@test.com",
        role: "user",
      });

      const memberUser = await db.getUserByOpenId("member-realtime-user");
      if (!memberUser) throw new Error("Failed to create member user");

      await db.addOrganizationMember({
        organizationId: testOrgId,
        userId: memberUser.id,
        role: "member",
      });

      const caller = appRouter.createCaller(createTestContext(memberUser.id));

      await expect(
        caller.realtime.channels.create({
          projectId: testProjectId,
          name: "unauthorized-channel",
          type: "broadcast",
        })
      ).rejects.toThrow();
    });

    it("should prevent non-admin users from updating channels", async () => {
      const memberUser = await db.getUserByOpenId("member-realtime-user");
      if (!memberUser) throw new Error("Member user not found");

      const caller = appRouter.createCaller(createTestContext(memberUser.id));

      await expect(
        caller.realtime.channels.update({
          id: testChannelId,
          enabled: true,
        })
      ).rejects.toThrow();
    });

    it("should prevent non-admin users from deleting channels", async () => {
      const memberUser = await db.getUserByOpenId("member-realtime-user");
      if (!memberUser) throw new Error("Member user not found");

      const caller = appRouter.createCaller(createTestContext(memberUser.id));

      await expect(
        caller.realtime.channels.delete({ id: testChannelId })
      ).rejects.toThrow();
    });
  });

  describe("Channel Deletion", () => {
    it("should delete a channel", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      // Create a channel to delete
      const createResult = await caller.realtime.channels.create({
        projectId: testProjectId,
        name: "temp:channel",
        type: "broadcast",
      });

      const result = await caller.realtime.channels.delete({ id: createResult.id });

      expect(result).toHaveProperty("success", true);

      // Verify channel is deleted
      await expect(
        caller.realtime.channels.getById({ id: createResult.id })
      ).rejects.toThrow();
    });
  });

  describe("Channel Configuration", () => {
    it("should handle empty configuration", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.realtime.channels.create({
        projectId: testProjectId,
        name: "no-config:channel",
        type: "broadcast",
      });

      const channel = await caller.realtime.channels.getById({ id: result.id });

      expect(channel.config).toBeNull();

      // Cleanup
      await caller.realtime.channels.delete({ id: result.id });
    });

    it("should handle complex configuration objects", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.realtime.channels.create({
        projectId: testProjectId,
        name: "complex-config:channel",
        type: "broadcast",
        config: {
          maxConnections: 1000,
          timeout: 60,
          retryAttempts: 3,
          features: {
            logging: true,
            metrics: true,
          },
        },
      });

      const channel = await caller.realtime.channels.getById({ id: result.id });

      expect(channel.config).toHaveProperty("maxConnections", 1000);
      expect(channel.config).toHaveProperty("timeout", 60);
      expect(channel.config).toHaveProperty("features");
      expect(channel.config.features).toHaveProperty("logging", true);

      // Cleanup
      await caller.realtime.channels.delete({ id: result.id });
    });
  });

  describe("Channel Validation", () => {
    it("should require channel name", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      await expect(
        caller.realtime.channels.create({
          projectId: testProjectId,
          name: "",
          type: "broadcast",
        })
      ).rejects.toThrow();
    });

    it("should validate channel type", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      await expect(
        caller.realtime.channels.create({
          projectId: testProjectId,
          name: "invalid:channel",
          type: "invalid_type" as any,
        })
      ).rejects.toThrow();
    });
  });
});
