import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("database management", () => {
  it("should execute a simple SELECT query", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create an organization and project
    const org = await caller.organizations.create({
      name: `Test Org DB ${Date.now()}`,
      slug: `test-org-db-${Date.now()}`,
    });

    const project = await caller.projects.create({
      organizationId: org.id,
      name: `Test Project DB ${Date.now()}`,
      region: "us-east-1",
    });

    // Execute a query against the users table (which should exist)
    const result = await caller.database.executeQuery({
      projectId: project.id,
      query: "SELECT * FROM users LIMIT 5",
    });

    expect(result).toBeDefined();
    expect(result.columns).toBeDefined();
    expect(Array.isArray(result.columns)).toBe(true);
    expect(result.rows).toBeDefined();
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);
  });

  it("should get list of tables", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create org and project
    const org = await caller.organizations.create({
      name: `Test Org Tables ${Date.now()}`,
      slug: `test-org-tables-${Date.now()}`,
    });

    const project = await caller.projects.create({
      organizationId: org.id,
      name: `Test Project Tables ${Date.now()}`,
      region: "us-east-1",
    });

    // Get tables
    const tables = await caller.database.getTables({
      projectId: project.id,
    });

    expect(tables).toBeDefined();
    expect(Array.isArray(tables)).toBe(true);
    // Should have at least the users table
    expect(tables.length).toBeGreaterThan(0);
    
    const usersTable = tables.find(t => t.tableName === "users");
    expect(usersTable).toBeDefined();
    expect(usersTable?.columnCount).toBeGreaterThan(0);
  });

  it("should get table columns", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create org and project
    const org = await caller.organizations.create({
      name: `Test Org Columns ${Date.now()}`,
      slug: `test-org-columns-${Date.now()}`,
    });

    const project = await caller.projects.create({
      organizationId: org.id,
      name: `Test Project Columns ${Date.now()}`,
      region: "us-east-1",
    });

    // Get columns for users table
    const columns = await caller.database.getTableColumns({
      projectId: project.id,
      tableName: "users",
    });

    expect(columns).toBeDefined();
    expect(Array.isArray(columns)).toBe(true);
    expect(columns.length).toBeGreaterThan(0);

    // Check for expected columns
    const idColumn = columns.find(c => c.columnName === "id");
    expect(idColumn).toBeDefined();
    expect(idColumn?.isPrimaryKey).toBe(true);

    const openIdColumn = columns.find(c => c.columnName === "openId");
    expect(openIdColumn).toBeDefined();
  });

  it("should get schema info with relationships", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create org and project
    const org = await caller.organizations.create({
      name: `Test Org Schema ${Date.now()}`,
      slug: `test-org-schema-${Date.now()}`,
    });

    const project = await caller.projects.create({
      organizationId: org.id,
      name: `Test Project Schema ${Date.now()}`,
      region: "us-east-1",
    });

    // Get schema info
    const schema = await caller.database.getSchemaInfo({
      projectId: project.id,
    });

    expect(schema).toBeDefined();
    expect(schema.tables).toBeDefined();
    expect(Array.isArray(schema.tables)).toBe(true);
    expect(schema.tables.length).toBeGreaterThan(0);

    expect(schema.relationships).toBeDefined();
    expect(Array.isArray(schema.relationships)).toBe(true);
  });

  it("should get table data with pagination", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create org and project
    const org = await caller.organizations.create({
      name: `Test Org Data ${Date.now()}`,
      slug: `test-org-data-${Date.now()}`,
    });

    const project = await caller.projects.create({
      organizationId: org.id,
      name: `Test Project Data ${Date.now()}`,
      region: "us-east-1",
    });

    // Get table data
    const tableData = await caller.database.getTableData({
      projectId: project.id,
      tableName: "users",
      page: 1,
      pageSize: 10,
    });

    expect(tableData).toBeDefined();
    expect(tableData.data).toBeDefined();
    expect(Array.isArray(tableData.data)).toBe(true);
    expect(tableData.total).toBeGreaterThanOrEqual(0);
    expect(tableData.page).toBe(1);
    expect(tableData.pageSize).toBe(10);
  });

  it("should enforce access control for database operations", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create org and project as user 1
    const org = await caller.organizations.create({
      name: `Test Org Access ${Date.now()}`,
      slug: `test-org-access-${Date.now()}`,
    });

    const project = await caller.projects.create({
      organizationId: org.id,
      name: `Test Project Access ${Date.now()}`,
      region: "us-east-1",
    });

    // Create a different user context
    const otherUser: AuthenticatedUser = {
      id: 999,
      openId: "other-user",
      email: "other@example.com",
      name: "Other User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const otherCtx: TrpcContext = {
      user: otherUser,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };

    const otherCaller = appRouter.createCaller(otherCtx);

    // Try to access the project's database - should fail
    await expect(
      otherCaller.database.getTables({
        projectId: project.id,
      })
    ).rejects.toThrow();
  });
});
