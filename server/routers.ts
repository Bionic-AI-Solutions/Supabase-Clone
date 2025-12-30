import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import {
  deprovisionProject,
  pauseProject,
  provisionProject,
  regenerateApiKeys,
  regenerateJwtSecret,
  resumeProject,
} from "./provisioning";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function checkOrganizationAccess(userId: number, organizationId: number, minRole: "owner" | "admin" | "member" = "member") {
  const role = await db.getUserOrganizationRole(userId, organizationId);
  
  if (!role) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this organization" });
  }

  const roleHierarchy = { owner: 3, admin: 2, member: 1 };
  if (roleHierarchy[role] < roleHierarchy[minRole]) {
    throw new TRPCError({ code: "FORBIDDEN", message: `This action requires ${minRole} role` });
  }

  return role;
}

async function checkProjectAccess(userId: number, projectId: number, minRole: "owner" | "admin" | "member" = "member") {
  const project = await db.getProjectById(projectId);
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }

  await checkOrganizationAccess(userId, project.organizationId, minRole);
  return project;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

// ============================================================================
// ROUTERS
// ============================================================================

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================================
  // ORGANIZATIONS
  // ============================================================================

  organizations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserOrganizations(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        await checkOrganizationAccess(ctx.user.id, input.id);
        return await db.getOrganizationById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const slug = generateSlug(input.name);
        
        // Check if slug already exists
        const existing = await db.getOrganizationBySlug(slug);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Organization with this name already exists" });
        }

        // Generate organization database name
        const orgDatabase = `supabase_org_${slug}`;
        
        const orgId = await db.createOrganization({
          name: input.name,
          slug,
          ownerUserId: ctx.user.id,
          orgDatabase,
        });

        // Add creator as owner
        await db.addOrganizationMember({
          organizationId: orgId,
          userId: ctx.user.id,
          role: "owner",
        });

        // Create default free subscription
        await db.createSubscription({
          organizationId: orgId,
          planType: "free",
          status: "active",
          billingCycle: "monthly",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          organizationId: orgId,
          action: "organization.created",
          resourceType: "organization",
          resourceId: orgId,
        });

        return { id: orgId, slug };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        await checkOrganizationAccess(ctx.user.id, input.id, "admin");
        
        await db.updateOrganization(input.id, { name: input.name });

        await db.createAuditLog({
          userId: ctx.user.id,
          organizationId: input.id,
          action: "organization.updated",
          resourceType: "organization",
          resourceId: input.id,
        });

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await checkOrganizationAccess(ctx.user.id, input.id, "owner");

        // Check if organization has projects
        const projects = await db.getOrganizationProjects(input.id);
        if (projects.length > 0) {
          throw new TRPCError({ 
            code: "PRECONDITION_FAILED", 
            message: "Cannot delete organization with existing projects. Delete all projects first." 
          });
        }

        await db.deleteOrganization(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          organizationId: input.id,
          action: "organization.deleted",
          resourceType: "organization",
          resourceId: input.id,
        });

        return { success: true };
      }),

    members: router({
      list: protectedProcedure
        .input(z.object({ organizationId: z.number() }))
        .query(async ({ ctx, input }) => {
          await checkOrganizationAccess(ctx.user.id, input.organizationId);
          return await db.getOrganizationMembers(input.organizationId);
        }),

      add: protectedProcedure
        .input(z.object({
          organizationId: z.number(),
          userEmail: z.string().email(),
          role: z.enum(["admin", "member"]),
        }))
        .mutation(async ({ ctx, input }) => {
          await checkOrganizationAccess(ctx.user.id, input.organizationId, "admin");

          // TODO: Implement user invitation system
          // For now, just return success
          return { success: true, message: "Invitation system not yet implemented" };
        }),

      updateRole: protectedProcedure
        .input(z.object({
          memberId: z.number(),
          role: z.enum(["owner", "admin", "member"]),
        }))
        .mutation(async ({ ctx, input }) => {
          // Get member to find organization
          const members = await db.getOrganizationMembers(input.memberId);
          if (members.length === 0) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
          }

          // Check access (only owners can change roles)
          await checkOrganizationAccess(ctx.user.id, input.memberId, "owner");

          await db.updateOrganizationMemberRole(input.memberId, input.role);
          return { success: true };
        }),

      remove: protectedProcedure
        .input(z.object({ memberId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          await db.removeOrganizationMember(input.memberId);
          return { success: true };
        }),
    }),
  }),

  // ============================================================================
  // PROJECTS
  // ============================================================================

  projects: router({
    list: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ ctx, input }) => {
        await checkOrganizationAccess(ctx.user.id, input.organizationId);
        return await db.getOrganizationProjects(input.organizationId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await checkProjectAccess(ctx.user.id, input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        name: z.string().min(1).max(255),
        region: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await checkOrganizationAccess(ctx.user.id, input.organizationId, "admin");

        // Check subscription limits
        const subscription = await db.getOrganizationSubscription(input.organizationId);
        if (!subscription) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active subscription" });
        }

        const limits = await db.getPlanLimits(subscription.planType);
        if (!limits) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Plan limits not configured" });
        }

        const existingProjects = await db.getOrganizationProjects(input.organizationId);
        if (existingProjects.length >= limits.maxProjects) {
          throw new TRPCError({ 
            code: "PRECONDITION_FAILED", 
            message: `Project limit reached. Upgrade to create more projects.` 
          });
        }

        const slug = generateSlug(input.name);
        
        // Check if slug already exists
        const existing = await db.getProjectBySlug(slug);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Project with this name already exists" });
        }

        // Get organization to determine database name
        const organization = await db.getOrganizationById(input.organizationId);
        if (!organization) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
        }
        
        // Create project record with schema-based isolation
        const projectId = await db.createProject({
          name: input.name,
          slug,
          organizationId: input.organizationId,
          databaseName: organization.orgDatabase, // Use org database
          databaseSchema: `project_${slug}`, // Project-specific schema
          region: input.region || "us-west-1",
          status: "provisioning",
        });

        // Provision infrastructure
        try {
          const provisioningResult = await provisionProject(slug, input.organizationId);

          // Store credentials
          await db.createProjectCredentials({
            projectId,
            jwtSecret: provisioningResult.jwtSecret,
            anonKey: provisioningResult.anonKey,
            serviceKey: provisioningResult.serviceKey,
            dbUsername: provisioningResult.dbUsername,
            dbPassword: provisioningResult.dbPassword,
            storageBucket: provisioningResult.storageBucket,
            postgresConnectionString: provisioningResult.postgresConnectionString,
          });

          // Update project status
          await db.updateProject(projectId, {
            status: "active",
            databaseHost: provisioningResult.databaseHost,
            databasePort: provisioningResult.databasePort,
          });

          await db.createAuditLog({
            userId: ctx.user.id,
            organizationId: input.organizationId,
            projectId,
            action: "project.created",
            resourceType: "project",
            resourceId: projectId,
          });

          return { id: projectId, slug };
        } catch (error) {
          // Mark project as failed
          await db.updateProject(projectId, { status: "deleted" });
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Failed to provision project infrastructure" 
          });
        }
      }),

    pause: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await checkProjectAccess(ctx.user.id, input.id, "admin");

        if (project.status !== "active") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Project is not active" });
        }

        await pauseProject(project.slug);
        await db.updateProject(input.id, { status: "paused", pausedAt: new Date() });

        await db.createAuditLog({
          userId: ctx.user.id,
          organizationId: project.organizationId,
          projectId: input.id,
          action: "project.paused",
          resourceType: "project",
          resourceId: input.id,
        });

        return { success: true };
      }),

    resume: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await checkProjectAccess(ctx.user.id, input.id, "admin");

        if (project.status !== "paused") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Project is not paused" });
        }

        await resumeProject(project.slug);
        await db.updateProject(input.id, { status: "active", pausedAt: null });

        await db.createAuditLog({
          userId: ctx.user.id,
          organizationId: project.organizationId,
          projectId: input.id,
          action: "project.resumed",
          resourceType: "project",
          resourceId: input.id,
        });

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await checkProjectAccess(ctx.user.id, input.id, "admin");

        await db.updateProject(input.id, { status: "deleting" });

        try {
          await deprovisionProject(project.slug, project.databaseName);
          await db.deleteProject(input.id);

          await db.createAuditLog({
            userId: ctx.user.id,
            organizationId: project.organizationId,
            projectId: input.id,
            action: "project.deleted",
            resourceType: "project",
            resourceId: input.id,
          });

          return { success: true };
        } catch (error) {
          await db.updateProject(input.id, { status: "active" });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete project" });
        }
      }),

    credentials: router({
      get: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
          await checkProjectAccess(ctx.user.id, input.projectId);
          return await db.getProjectCredentials(input.projectId);
        }),

      regenerateKeys: protectedProcedure
        .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await checkProjectAccess(ctx.user.id, input.projectId, "admin");
        const credentials = await db.getProjectCredentials(input.projectId);

          if (!credentials) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Credentials not found" });
          }

          const { anonKey, serviceKey } = await regenerateApiKeys(credentials.jwtSecret);

          await db.updateProjectCredentials(input.projectId, { anonKey, serviceKey });

          await db.createAuditLog({
            userId: ctx.user.id,
            organizationId: project.organizationId,
            projectId: input.projectId,
            action: "project.credentials.regenerated",
            resourceType: "project_credentials",
            resourceId: input.projectId,
          });

          return { anonKey, serviceKey };
        }),

      regenerateJwt: protectedProcedure
        .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await checkProjectAccess(ctx.user.id, input.projectId, "admin");

        const { jwtSecret, anonKey, serviceKey } = await regenerateJwtSecret();

          await db.updateProjectCredentials(input.projectId, { jwtSecret, anonKey, serviceKey });

          await db.createAuditLog({
            userId: ctx.user.id,
            organizationId: project.organizationId,
            projectId: input.projectId,
            action: "project.jwt.regenerated",
            resourceType: "project_credentials",
            resourceId: input.projectId,
          });

          return { jwtSecret, anonKey, serviceKey };
        }),
    }),
  }),

  // ============================================================================
  // EDGE FUNCTIONS
  // ============================================================================

  edgeFunctions: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await checkProjectAccess(ctx.user.id, input.projectId);
        return await db.getProjectEdgeFunctions(input.projectId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const func = await db.getEdgeFunctionById(input.id);
        if (!func) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Function not found" });
        }
        await checkProjectAccess(ctx.user.id, func.projectId);
        return func;
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string().min(1).max(255),
        code: z.string().optional(),
        envVars: z.record(z.string(), z.string()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        await checkProjectAccess(ctx.user.id, input.projectId, "admin");

        const slug = generateSlug(input.name);
        const defaultCode = input.code || `// ${input.name}\nexport default async function handler(req: Request) {\n  return new Response(\n    JSON.stringify({ message: 'Hello from ${input.name}!' }),\n    { headers: { 'Content-Type': 'application/json' } }\n  );\n}`;

        const functionId = await db.createEdgeFunction({
          projectId: input.projectId,
          name: input.name,
          slug,
          entrypoint: `${slug}.ts`,
          code: defaultCode,
          verifyJwt: true,
          envVars: input.envVars ?? null,
          status: "inactive",
        });

        return { id: functionId, slug };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        code: z.string().optional(),
        verifyJwt: z.boolean().optional(),
        envVars: z.record(z.string(), z.string()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const func = await db.getEdgeFunctionById(input.id);
        if (!func) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Function not found" });
        }

        await checkProjectAccess(ctx.user.id, func.projectId, "admin");

        const { id, ...updateData } = input;
        await db.updateEdgeFunction(id, updateData as any);

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const func = await db.getEdgeFunctionById(input.id);
        if (!func) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Function not found" });
        }

        await checkProjectAccess(ctx.user.id, func.projectId, "admin");
        await db.deleteEdgeFunction(input.id);

        return { success: true };
      }),

    deploy: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const func = await db.getEdgeFunctionById(input.id);
        if (!func) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Function not found" });
        }

        await checkProjectAccess(ctx.user.id, func.projectId, "admin");
        
        // Update function status to active and increment version
        await db.updateEdgeFunction(input.id, {
          status: "active",
          version: func.version + 1,
        });

        return { success: true, version: func.version + 1 };
      }),

    invoke: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        payload: z.any().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const func = await db.getEdgeFunctionById(input.id);
        if (!func) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Function not found" });
        }

        await checkProjectAccess(ctx.user.id, func.projectId);
        
        // In a real implementation, this would invoke the actual edge function
        // For now, return a mock response
        return {
          success: true,
          result: {
            message: "Function invoked successfully",
            payload: input.payload,
            timestamp: Date.now()
          }
        };
      }),

    logs: protectedProcedure
      .input(z.object({ functionId: z.number(), limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const func = await db.getEdgeFunctionById(input.functionId);
        if (!func) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Function not found" });
        }

        await checkProjectAccess(ctx.user.id, func.projectId);
        return await db.getEdgeFunctionLogs(input.functionId, input.limit);
      }),
  }),

  // ============================================================================
  // REALTIME
  // ============================================================================

  realtime: router({
    channels: router({
      list: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
          await checkProjectAccess(ctx.user.id, input.projectId);
          return await db.getProjectRealtimeChannels(input.projectId);
        }),

      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          const channel = await db.getRealtimeChannelById(input.id);
          if (!channel) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" });
          }

          await checkProjectAccess(ctx.user.id, channel.projectId);
          return channel;
        }),

      create: protectedProcedure
        .input(z.object({
          projectId: z.number(),
          name: z.string().min(1).max(255),
          type: z.enum(["broadcast", "presence", "postgres_changes"]),
          schema: z.string().optional(),
          table: z.string().optional(),
          filter: z.string().optional(),
          config: z.record(z.string(), z.any()).optional()
        }))
        .mutation(async ({ ctx, input }) => {
          await checkProjectAccess(ctx.user.id, input.projectId, "admin");

          const channelId = await db.createRealtimeChannel({
            projectId: input.projectId,
            name: input.name,
            type: input.type,
            enabled: true,
            schema: input.schema ?? null,
            table: input.table ?? null,
            filter: input.filter ?? null,
            config: input.config ?? null,
          });

          return { id: channelId };
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          enabled: z.boolean().optional(),
          config: z.record(z.string(), z.any()).optional()
        }))
        .mutation(async ({ ctx, input }) => {
          const channel = await db.getRealtimeChannelById(input.id);
          if (!channel) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" });
          }

          await checkProjectAccess(ctx.user.id, channel.projectId, "admin");

          const { id, ...updateData } = input;
          await db.updateRealtimeChannel(id, updateData as any);

          return { success: true };
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const channel = await db.getRealtimeChannelById(input.id);
          if (!channel) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" });
          }

          await checkProjectAccess(ctx.user.id, channel.projectId, "admin");
          await db.deleteRealtimeChannel(input.id);

          return { success: true };
        }),
    }),
  }),

  // ============================================================================
  // USAGE & ANALYTICS
  // ============================================================================

  usage: router({
    current: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await checkProjectAccess(ctx.user.id, input.projectId);
        return await db.getProjectCurrentUsage(input.projectId);
      }),

    metrics: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        metricType: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        await checkProjectAccess(ctx.user.id, input.projectId);
        return await db.getProjectUsageMetrics(
          input.projectId,
          input.metricType,
          input.startDate,
          input.endDate
        );
      }),
  }),

  // ============================================================================
  // BILLING & SUBSCRIPTIONS
  // ============================================================================

  billing: router({
    subscription: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ ctx, input }) => {
        await checkOrganizationAccess(ctx.user.id, input.organizationId);
        return await db.getOrganizationSubscription(input.organizationId);
      }),

    plans: publicProcedure.query(async () => {
      // Return all plan limits
      const free = await db.getPlanLimits("free");
      const pro = await db.getPlanLimits("pro");
      const enterprise = await db.getPlanLimits("enterprise");

      return { free, pro, enterprise };
    }),

    upgrade: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        planType: z.enum(["pro", "enterprise"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await checkOrganizationAccess(ctx.user.id, input.organizationId, "owner");

        // TODO: Integrate with Stripe for payment processing
        // For now, just update the subscription

        await db.updateSubscription(input.organizationId, {
          planType: input.planType,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        return { success: true, message: "Subscription upgraded (payment integration pending)" };
      }),

    events: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        await checkOrganizationAccess(ctx.user.id, input.organizationId);
        return await db.getOrganizationBillingEvents(
          input.organizationId,
          input.startDate,
          input.endDate
        );
      }),
  }),

  // ============================================================================
  // DATABASE MANAGEMENT
  // ============================================================================

  database: router({ executeQuery: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        query: z.string(),
        maxRows: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        await checkOrganizationAccess(ctx.user.id, project.organizationId);

        const dbMgmt = await import("./database-management");
        return await dbMgmt.executeQuery(
          project.databaseName,
          project.databaseSchema,
          input.query,
          input.maxRows
        );
      }),

    getTables: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        await checkOrganizationAccess(ctx.user.id, project.organizationId);

        const dbMgmt = await import("./database-management");
        return await dbMgmt.getTables(project.databaseName, project.databaseSchema);
      }),

    getTableColumns: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        tableName: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        await checkOrganizationAccess(ctx.user.id, project.organizationId);

        const dbMgmt = await import("./database-management");
        return await dbMgmt.getTableColumns(
          project.databaseName,
          project.databaseSchema,
          input.tableName
        );
      }),

    getSchemaInfo: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        await checkOrganizationAccess(ctx.user.id, project.organizationId);

        const dbMgmt = await import("./database-management");
        return await dbMgmt.getSchemaInfo(project.databaseName, project.databaseSchema);
      }),

    getTableData: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        tableName: z.string(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        await checkOrganizationAccess(ctx.user.id, project.organizationId);

        const dbMgmt = await import("./database-management");
        return await dbMgmt.getTableData(
          project.databaseName,
          project.databaseSchema,
          input.tableName,
          input.page,
          input.pageSize
        );
      }),

    updateRow: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        tableName: z.string(),
        primaryKeyColumn: z.string(),
        primaryKeyValue: z.any(),
        updates: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        await checkOrganizationAccess(ctx.user.id, project.organizationId, "admin");

        const dbMgmt = await import("./database-management");
        return await dbMgmt.updateTableRow(
          project.databaseName,
          project.databaseSchema,
          input.tableName,
          input.primaryKeyColumn,
          input.primaryKeyValue,
          input.updates
        );
      }),

    deleteRow: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        tableName: z.string(),
        primaryKeyColumn: z.string(),
        primaryKeyValue: z.any(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        await checkOrganizationAccess(ctx.user.id, project.organizationId, "admin");

        const dbMgmt = await import("./database-management");
        return await dbMgmt.deleteTableRow(
          project.databaseName,
          project.databaseSchema,
          input.tableName,
          input.primaryKeyColumn,
          input.primaryKeyValue
        );
      }),
  }),

  // ============================================================================
  // USERS
  // ============================================================================

  users: router({
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        role: z.enum(["admin", "user"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can update user roles
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update users" });
        }

        const { id, ...updateData } = input;
        await db.updateUser(id, updateData as any);

        return { success: true };
      }),
  }),

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  auditLogs: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ ctx, input }) => {
        // Only admins can view audit logs
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can view audit logs" });
        }

        return await db.getAuditLogs(input.limit);
      }),
  }),

  // ============================================================================
  // ADMIN PANEL
  // ============================================================================

  admin: router({
    stats: adminProcedure.query(async () => {
      const allOrgs = await db.getAllOrganizations();
      const allProjects = await db.getAllProjects();
      const allUsers = await db.getAllUsers();

      return {
        totalOrganizations: allOrgs.length,
        totalProjects: allProjects.length,
        totalUsers: allUsers.length,
        activeProjects: allProjects.filter(p => p.status === "active").length,
      };
    }),

    organizations: adminProcedure.query(async () => {
      return await db.getAllOrganizations();
    }),

    projects: adminProcedure.query(async () => {
      return await db.getAllProjects();
    }),

    users: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),
  }),
});

export type AppRouter = typeof appRouter;
