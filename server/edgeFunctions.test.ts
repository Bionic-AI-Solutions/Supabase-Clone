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

describe("Edge Functions Management", () => {
  let testUserId: number;
  let testOrgId: number;
  let testProjectId: number;
  let testFunctionId: number;

  beforeAll(async () => {
    const timestamp = Date.now();
    
    // Use upsertUser to ensure test user exists
    await db.upsertUser({
      openId: `test-edge-functions-user-${timestamp}`,
      name: "Edge Functions Test User",
      email: `edgefunctions-${timestamp}@test.com`,
      role: "user",
    });

    const user = await db.getUserByOpenId(`test-edge-functions-user-${timestamp}`);
    if (!user) throw new Error("Failed to create test user");
    testUserId = user.id;

    // Create test organization
    testOrgId = await db.createOrganization({
      name: `Edge Functions Test Org ${timestamp}`,
      slug: `edge-functions-test-org-${timestamp}`,
      ownerUserId: testUserId,
      orgDatabase: `supabase_org_ef_test_${timestamp}`,
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
      name: `Edge Functions Test Project ${timestamp}`,
      slug: `edge-functions-test-project-${timestamp}`,
      databaseName: `supabase_org_ef_test_${timestamp}`,
      databaseSchema: `edge_functions_test_schema_${timestamp}`,
      region: "us-east-1",
      status: "active",
    });
  });

  describe("Edge Function CRUD Operations", () => {
    it("should create a new edge function", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.edgeFunctions.create({
        projectId: testProjectId,
        name: "hello-world",
        code: "export default async function handler(req: Request) {\n  return new Response('Hello World');\n}",
        envVars: { API_KEY: "test-key" },
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("slug");
      expect(result.slug).toBe("hello-world");

      testFunctionId = result.id;
    });

    it("should list edge functions for a project", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const functions = await caller.edgeFunctions.list({ projectId: testProjectId });

      expect(functions).toBeInstanceOf(Array);
      expect(functions.length).toBeGreaterThan(0);
      expect(functions[0]).toHaveProperty("name");
      expect(functions[0]).toHaveProperty("status");
      expect(functions[0]).toHaveProperty("version");
    });

    it("should get edge function by id", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const func = await caller.edgeFunctions.getById({ id: testFunctionId });

      expect(func).toHaveProperty("id", testFunctionId);
      expect(func).toHaveProperty("name", "hello-world");
      expect(func).toHaveProperty("code");
      expect(func.code).toContain("Hello World");
      expect(func).toHaveProperty("envVars");
    });

    it("should update edge function code", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const updatedCode = "export default async function handler(req: Request) {\n  return new Response('Updated!');\n}";

      const result = await caller.edgeFunctions.update({
        id: testFunctionId,
        code: updatedCode,
      });

      expect(result).toHaveProperty("success", true);

      // Verify the update
      const func = await caller.edgeFunctions.getById({ id: testFunctionId });
      expect(func.code).toContain("Updated!");
    });

    it("should update edge function environment variables", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.edgeFunctions.update({
        id: testFunctionId,
        envVars: { API_KEY: "updated-key", NEW_VAR: "new-value" },
      });

      expect(result).toHaveProperty("success", true);

      // Verify the update
      const func = await caller.edgeFunctions.getById({ id: testFunctionId });
      expect(func.envVars).toHaveProperty("API_KEY", "updated-key");
      expect(func.envVars).toHaveProperty("NEW_VAR", "new-value");
    });
  });

  describe("Edge Function Deployment", () => {
    it("should deploy an edge function", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.edgeFunctions.deploy({ id: testFunctionId });

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("version");
      expect(result.version).toBeGreaterThan(1);

      // Verify function status changed to active
      const func = await caller.edgeFunctions.getById({ id: testFunctionId });
      expect(func.status).toBe("active");
      expect(func.version).toBe(result.version);
    });

    it("should increment version on each deployment", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const func1 = await caller.edgeFunctions.getById({ id: testFunctionId });
      const currentVersion = func1.version;

      const result = await caller.edgeFunctions.deploy({ id: testFunctionId });

      expect(result.version).toBe(currentVersion + 1);
    });
  });

  describe("Edge Function Invocation", () => {
    it("should invoke an edge function with payload", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const payload = { message: "test invocation" };
      const result = await caller.edgeFunctions.invoke({
        id: testFunctionId,
        payload,
      });

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("result");
      expect(result.result).toHaveProperty("message");
      expect(result.result).toHaveProperty("payload", payload);
      expect(result.result).toHaveProperty("timestamp");
    });

    it("should invoke an edge function without payload", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.edgeFunctions.invoke({
        id: testFunctionId,
      });

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("result");
    });
  });

  describe("Edge Function Access Control", () => {
    it("should prevent unauthorized users from accessing functions", async () => {
      await db.upsertUser({
        openId: "unauthorized-user",
        name: "Unauthorized User",
        email: "unauthorized@test.com",
        role: "user",
      });

      const unauthorizedUser = await db.getUserByOpenId("unauthorized-user");
      if (!unauthorizedUser) throw new Error("Failed to create unauthorized user");

      const caller = appRouter.createCaller(createTestContext(unauthorizedUser.id));

      await expect(
        caller.edgeFunctions.getById({ id: testFunctionId })
      ).rejects.toThrow();
    });

    it("should prevent non-admin users from creating functions", async () => {
      // Create a member user
      await db.upsertUser({
        openId: "member-user",
        name: "Member User",
        email: "member@test.com",
        role: "user",
      });

      const memberUser = await db.getUserByOpenId("member-user");
      if (!memberUser) throw new Error("Failed to create member user");

      await db.addOrganizationMember({
        organizationId: testOrgId,
        userId: memberUser.id,
        role: "member",
      });

      const caller = appRouter.createCaller(createTestContext(memberUser.id));

      await expect(
        caller.edgeFunctions.create({
          projectId: testProjectId,
          name: "unauthorized-function",
          code: "export default async function handler(req: Request) { return new Response('test'); }",
        })
      ).rejects.toThrow();
    });
  });

  describe("Edge Function Deletion", () => {
    it("should delete an edge function", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.edgeFunctions.delete({ id: testFunctionId });

      expect(result).toHaveProperty("success", true);

      // Verify function is deleted
      await expect(
        caller.edgeFunctions.getById({ id: testFunctionId })
      ).rejects.toThrow();
    });
  });

  describe("Edge Function Code Storage", () => {
    it("should create function with default code if not provided", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const result = await caller.edgeFunctions.create({
        projectId: testProjectId,
        name: "default-code-function",
      });

      const func = await caller.edgeFunctions.getById({ id: result.id });

      expect(func.code).toBeTruthy();
      expect(func.code).toContain("export default async function handler");
      expect(func.code).toContain("default-code-function");

      // Cleanup
      await caller.edgeFunctions.delete({ id: result.id });
    });

    it("should preserve code formatting and whitespace", async () => {
      const caller = appRouter.createCaller(createTestContext(testUserId));

      const codeWithFormatting = `export default async function handler(req: Request) {
  const data = {
    message: "Hello",
    nested: {
      value: 123
    }
  };
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}`;

      const result = await caller.edgeFunctions.create({
        projectId: testProjectId,
        name: "formatted-function",
        code: codeWithFormatting,
      });

      const func = await caller.edgeFunctions.getById({ id: result.id });

      expect(func.code).toBe(codeWithFormatting);

      // Cleanup
      await caller.edgeFunctions.delete({ id: result.id });
    });
  });
});
