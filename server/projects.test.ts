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

describe("Projects", () => {
  it("should create a new project with provisioning", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create organization first
    const org = await caller.organizations.create({ name: `Project Test Org ${Date.now()}` });

    // Create project
    const project = await caller.projects.create({
      organizationId: org.id,
      name: `My First Project ${Date.now()}`,
      region: "us-west-1",
    });

    expect(project).toHaveProperty("id");
    expect(project).toHaveProperty("slug");
    expect(project.slug).toContain("my-first-project");
  });

  it("should list organization projects", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const org = await caller.organizations.create({ name: `List Projects Org ${Date.now()}` });
    
    await caller.projects.create({
      organizationId: org.id,
      name: `Project 1 ${Date.now()}`,
    });

    const projects = await caller.projects.list({ organizationId: org.id });

    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
  });

  it("should get project by id", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const org = await caller.organizations.create({ name: `Get Project Org ${Date.now()}` });
    const created = await caller.projects.create({
      organizationId: org.id,
      name: `Get Test Project ${Date.now()}`,
    });

    const project = await caller.projects.get({ id: created.id });

    expect(project).toBeDefined();
    expect(project.name).toContain("Get Test Project");
  });

  it("should get project credentials", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const org = await caller.organizations.create({ name: `Credentials Org ${Date.now()}` });
    const project = await caller.projects.create({
      organizationId: org.id,
      name: `Credentials Project ${Date.now()}`,
    });

    const credentials = await caller.projects.credentials.get({
      projectId: project.id,
    });

    expect(credentials).toBeDefined();
    expect(credentials).toHaveProperty("jwtSecret");
    expect(credentials).toHaveProperty("anonKey");
    expect(credentials).toHaveProperty("serviceKey");
    expect(credentials).toHaveProperty("postgresConnectionString");
  });

  it("should regenerate API keys", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const org = await caller.organizations.create({ name: `Regen Keys Org ${Date.now()}` });
    const project = await caller.projects.create({
      organizationId: org.id,
      name: `Regen Keys Project ${Date.now()}`,
    });

    const originalCreds = await caller.projects.credentials.get({
      projectId: project.id,
    });

    const newKeys = await caller.projects.credentials.regenerateKeys({
      projectId: project.id,
    });

    // Get updated credentials from database
    const updatedCreds = await caller.projects.credentials.get({
      projectId: project.id,
    });

    expect(newKeys.anonKey).toBeDefined();
    expect(newKeys.serviceKey).toBeDefined();
    // Keys should be updated in the database
    expect(updatedCreds?.anonKey).toBe(newKeys.anonKey);
    expect(updatedCreds?.serviceKey).toBe(newKeys.serviceKey);
  });
});

describe("Project Lifecycle", () => {
  it("should pause and resume a project", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const org = await caller.organizations.create({ name: `Pause Test Org ${Date.now()}` });
    const project = await caller.projects.create({
      organizationId: org.id,
      name: `Pause Test Project ${Date.now()}`,
    });

    // Pause project
    const pauseResult = await caller.projects.pause({ id: project.id });
    expect(pauseResult.success).toBe(true);

    const pausedProject = await caller.projects.get({ id: project.id });
    expect(pausedProject.status).toBe("paused");

    // Resume project
    const resumeResult = await caller.projects.resume({ id: project.id });
    expect(resumeResult.success).toBe(true);

    const resumedProject = await caller.projects.get({ id: project.id });
    expect(resumedProject.status).toBe("active");
  });
});
