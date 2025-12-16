import { drizzle } from "drizzle-orm/mysql2";
import { planLimits } from "../drizzle/schema.ts";
import "dotenv/config";

const db = drizzle(process.env.DATABASE_URL);

async function seedPlanLimits() {
  console.log("Seeding plan limits...");

  const plans = [
    {
      planType: "free",
      maxProjects: 2,
      maxDatabaseSizeMb: 500,
      maxStorageGb: 1,
      maxBandwidthGb: 2,
      maxApiCallsPerMonth: 50000,
      maxEdgeFunctions: 10,
      maxRealtimeConnections: 200,
      customDomain: false,
      prioritySupport: false,
    },
    {
      planType: "pro",
      maxProjects: 10,
      maxDatabaseSizeMb: 8000,
      maxStorageGb: 100,
      maxBandwidthGb: 250,
      maxApiCallsPerMonth: 5000000,
      maxEdgeFunctions: 100,
      maxRealtimeConnections: 5000,
      customDomain: true,
      prioritySupport: true,
    },
    {
      planType: "enterprise",
      maxProjects: 100,
      maxDatabaseSizeMb: 100000,
      maxStorageGb: 1000,
      maxBandwidthGb: 5000,
      maxApiCallsPerMonth: 100000000,
      maxEdgeFunctions: 1000,
      maxRealtimeConnections: 50000,
      customDomain: true,
      prioritySupport: true,
    },
  ];

  for (const plan of plans) {
    try {
      await db.insert(planLimits).values(plan).onDuplicateKeyUpdate({
        set: {
          maxProjects: plan.maxProjects,
          maxDatabaseSizeMb: plan.maxDatabaseSizeMb,
          maxStorageGb: plan.maxStorageGb,
          maxBandwidthGb: plan.maxBandwidthGb,
          maxApiCallsPerMonth: plan.maxApiCallsPerMonth,
          maxEdgeFunctions: plan.maxEdgeFunctions,
          maxRealtimeConnections: plan.maxRealtimeConnections,
          customDomain: plan.customDomain,
          prioritySupport: plan.prioritySupport,
        },
      });
      console.log(`✓ Seeded ${plan.planType} plan`);
    } catch (error) {
      console.error(`✗ Failed to seed ${plan.planType} plan:`, error.message);
    }
  }

  console.log("Plan limits seeding complete!");
  process.exit(0);
}

seedPlanLimits().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
