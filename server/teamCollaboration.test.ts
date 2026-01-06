import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { User } from "../drizzle/schema";

describe("Team Collaboration", () => {
  let testOwner: User;
  let testMember: User;
  let testOrgId: number;

  beforeAll(async () => {
    // Create test users
    const ownerOpenId = `test-owner-${Date.now()}`;
    const memberOpenId = `test-member-${Date.now()}`;

    await db.upsertUser({
      openId: ownerOpenId,
      name: "Test Owner",
      email: `owner-${Date.now()}@test.com`,
      loginMethod: "google",
      role: "user",
    });

    await db.upsertUser({
      openId: memberOpenId,
      name: "Test Member",
      email: `member-${Date.now()}@test.com`,
      loginMethod: "google",
      role: "user",
    });

    testOwner = (await db.getUserByOpenId(ownerOpenId))!;
    testMember = (await db.getUserByOpenId(memberOpenId))!;

    // Create test organization
    const orgSlug = `test-org-${Date.now()}`;
    const orgDatabase = `org_db_${Date.now()}`;
    testOrgId = await db.createOrganization({
      name: "Test Organization",
      slug: orgSlug,
      ownerUserId: testOwner.id,
      orgDatabase,
    });

    // Add owner as organization member
    await db.addOrganizationMember({
      organizationId: testOrgId,
      userId: testOwner.id,
      role: "owner",
    });
  });

  describe("Member Management", () => {
    it("should list organization members", async () => {
      const caller = appRouter.createCaller({
        user: testOwner,
      });

      const members = await caller.organizations.members.list({
        organizationId: testOrgId,
      });

      expect(members).toBeDefined();
      expect(members.length).toBeGreaterThan(0);
      expect(members[0].role).toBe("owner");
    });

    it("should add a member to organization", async () => {
      const caller = appRouter.createCaller({
        user: testOwner,
      });

      const result = await caller.organizations.members.add({
        organizationId: testOrgId,
        userEmail: testMember.email!,
        role: "member",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("successfully");

      // Verify member was added
      const members = await caller.organizations.members.list({
        organizationId: testOrgId,
      });
      const addedMember = members.find(m => m.userId === testMember.id);
      expect(addedMember).toBeDefined();
      expect(addedMember?.role).toBe("member");
    });

    it("should prevent adding non-existent user", async () => {
      const caller = appRouter.createCaller({
        user: testOwner,
      });

      const result = await caller.organizations.members.add({
        organizationId: testOrgId,
        userEmail: "nonexistent@test.com",
        role: "member",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("sign up first");
    });

    it("should prevent adding duplicate member", async () => {
      const caller = appRouter.createCaller({
        user: testOwner,
      });

      await expect(
        caller.organizations.members.add({
          organizationId: testOrgId,
          userEmail: testMember.email!,
          role: "member",
        })
      ).rejects.toThrow("already a member");
    });

    it("should update member role", async () => {
      const caller = appRouter.createCaller({
        user: testOwner,
      });

      // Get member ID
      const members = await caller.organizations.members.list({
        organizationId: testOrgId,
      });
      const member = members.find(m => m.userId === testMember.id);
      expect(member).toBeDefined();

      // Update role to admin
      const result = await caller.organizations.members.updateRole({
        memberId: member!.id,
        role: "admin",
      });

      expect(result.success).toBe(true);

      // Verify role was updated
      const updatedMembers = await caller.organizations.members.list({
        organizationId: testOrgId,
      });
      const updatedMember = updatedMembers.find(m => m.userId === testMember.id);
      expect(updatedMember?.role).toBe("admin");
    });

    it("should remove member from organization", async () => {
      const caller = appRouter.createCaller({
        user: testOwner,
      });

      // Get member ID
      const members = await caller.organizations.members.list({
        organizationId: testOrgId,
      });
      const member = members.find(m => m.userId === testMember.id);
      expect(member).toBeDefined();

      // Remove member
      const result = await caller.organizations.members.remove({
        memberId: member!.id,
      });

      expect(result.success).toBe(true);

      // Verify member was removed
      const remainingMembers = await caller.organizations.members.list({
        organizationId: testOrgId,
      });
      const removedMember = remainingMembers.find(m => m.userId === testMember.id);
      expect(removedMember).toBeUndefined();
    });
  });

  describe("Access Control", () => {
    it("should prevent non-admin from adding members", async () => {
      // Add test member back as regular member
      await db.addOrganizationMember({
        organizationId: testOrgId,
        userId: testMember.id,
        role: "member",
      });

      const caller = appRouter.createCaller({
        user: testMember,
      });

      await expect(
        caller.organizations.members.add({
          organizationId: testOrgId,
          userEmail: "another@test.com",
          role: "member",
        })
      ).rejects.toThrow();
    });

    it("should allow admin to add members", async () => {
      // Update test member to admin
      const members = await db.getOrganizationMembers(testOrgId);
      const member = members.find(m => m.userId === testMember.id);
      await db.updateOrganizationMemberRole(member!.id, "admin");

      const caller = appRouter.createCaller({
        user: testMember,
      });

      // Create another test user
      const newUserOpenId = `test-new-${Date.now()}`;
      await db.upsertUser({
        openId: newUserOpenId,
        name: "New User",
        email: `new-${Date.now()}@test.com`,
        loginMethod: "google",
        role: "user",
      });
      const newUser = await db.getUserByOpenId(newUserOpenId);

      const result = await caller.organizations.members.add({
        organizationId: testOrgId,
        userEmail: newUser!.email!,
        role: "member",
      });

      expect(result.success).toBe(true);
    });

    it("should list members for any organization member", async () => {
      const caller = appRouter.createCaller({
        user: testMember,
      });

      const members = await caller.organizations.members.list({
        organizationId: testOrgId,
      });

      expect(members).toBeDefined();
      expect(members.length).toBeGreaterThan(0);
    });
  });

  describe("Role Hierarchy", () => {
    it("should have correct role hierarchy (owner > admin > member)", async () => {
      const members = await db.getOrganizationMembers(testOrgId);
      
      const owner = members.find(m => m.role === "owner");
      const admin = members.find(m => m.role === "admin");
      const member = members.find(m => m.role === "member");

      expect(owner).toBeDefined();
      expect(admin).toBeDefined();
      expect(member).toBeDefined();
    });

    it("should allow owner to change any role", async () => {
      const caller = appRouter.createCaller({
        user: testOwner,
      });

      const members = await caller.organizations.members.list({
        organizationId: testOrgId,
      });
      const adminMember = members.find(m => m.role === "admin");

      const result = await caller.organizations.members.updateRole({
        memberId: adminMember!.id,
        role: "member",
      });

      expect(result.success).toBe(true);
    });
  });
});
