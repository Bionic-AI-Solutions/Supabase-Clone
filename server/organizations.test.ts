import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 1, role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
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

describe("Organizations", () => {
  it("should create a new organization", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.organizations.create({
      name: `Test Organization ${Date.now()}`,
    });

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("slug");
    expect(result.slug).toContain("test-organization");
  });

  it("should list user organizations", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create an organization first
    await caller.organizations.create({ name: `My Org ${Date.now()}` });

    const organizations = await caller.organizations.list();

    expect(Array.isArray(organizations)).toBe(true);
    expect(organizations.length).toBeGreaterThan(0);
  });

  it("should get organization by id", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const created = await caller.organizations.create({ name: `Get Test Org ${Date.now()}` });
    const org = await caller.organizations.get({ id: created.id });

    expect(org).toBeDefined();
    expect(org?.name).toContain("Get Test Org");
  });

  it("should update organization name", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const created = await caller.organizations.create({ name: `Original Name ${Date.now()}` });
    
    const result = await caller.organizations.update({
      id: created.id,
      name: "Updated Name",
    });

    expect(result.success).toBe(true);

    const updated = await caller.organizations.get({ id: created.id });
    expect(updated?.name).toBe("Updated Name");
  });

  it("should prevent deleting organization with projects", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const org = await caller.organizations.create({ name: `Org With Projects ${Date.now()}` });
    
    // Create a project
    await caller.projects.create({
      organizationId: org.id,
      name: `Test Project ${Date.now()}`,
    });

    // Attempt to delete should fail
    await expect(
      caller.organizations.delete({ id: org.id })
    ).rejects.toThrow();
  });
});

describe("Organization Members", () => {
  it("should list organization members", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const org = await caller.organizations.create({ name: `Member Test Org ${Date.now()}` });
    
    const members = await caller.organizations.members.list({
      organizationId: org.id,
    });

    expect(Array.isArray(members)).toBe(true);
    // Creator should be automatically added as owner
    expect(members.length).toBeGreaterThan(0);
  });
});
