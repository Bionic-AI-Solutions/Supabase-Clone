import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  createOrganization,
  createProject,
  createEdgeFunction,
  createRealtimeChannel,
  createUsageMetric,
  createSubscription,
} from "../server/db.ts";

const db = drizzle(process.env.DATABASE_URL);

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedSimpleData() {
  console.log("🌱 Seeding demo data using helper functions...");

  try {
    const orgNames = [
      "Acme Corporation",
      "TechStart Inc",
      "Global Solutions",
      "Innovation Labs",
    ];

    const projectTypes = ["Production", "Staging", "Development"];
    
    console.log(`Creating ${orgNames.length} organizations with projects...`);

    for (const orgName of orgNames) {
      // Create organization (will use current user as owner)
      const slug = `${generateSlug(orgName)}-${nanoid(6)}`;
      const orgDatabase = `supabase_org_${generateSlug(orgName)}_${nanoid(6)}`;
      
      const orgId = await createOrganization({
        name: orgName,
        slug,
        ownerUserId: 1, // Assuming user ID 1 exists
        orgDatabase,
      });
      
      const org = { id: orgId, name: orgName };
      
      console.log(`✓ Created organization: ${orgName} (ID: ${org.id})`);

      // Create 2-3 projects per organization
      const numProjects = Math.floor(Math.random() * 2) + 2;
      
      for (let i = 0; i < numProjects; i++) {
        const projectName = `${orgName.split(" ")[0]} ${projectTypes[i % projectTypes.length]}`;
        
        const projectSlug = `${generateSlug(projectName)}-${nanoid(6)}`;
        const databaseName = `supabase_${generateSlug(projectName)}_${nanoid(8)}`;
        const databaseSchema = `project_${nanoid(8)}`;
        
        const projectId = await createProject({
          name: projectName,
          slug: projectSlug,
          organizationId: org.id,
          region: ["us-east-1", "us-west-2", "eu-west-1"][i % 3],
          databaseName,
          databaseSchema,
        });
        
        const project = { id: projectId, name: projectName };
        
        console.log(`  ✓ Created project: ${projectName} (ID: ${project.id})`);

        // Create 2-3 edge functions
        const functionNames = ["send-email", "process-payment", "generate-report"];
        for (let j = 0; j < 2; j++) {
          await createEdgeFunction({
            projectId: project.id,
            name: functionNames[j],
            slug: `${generateSlug(functionNames[j])}-${nanoid(6)}`,
            description: `${functionNames[j]} function`,
            code: `export default async function handler(req) {\n  return new Response("Hello");\n}`,
            runtime: "deno",
            status: "active",
          });
        }

        // Create 1-2 realtime channels
        const channelNames = ["public:messages", "public:notifications"];
        for (let j = 0; j < 2; j++) {
          await createRealtimeChannel({
            projectId: project.id,
            name: channelNames[j],
            config: JSON.stringify({ broadcast: true, presence: true }),
          });
        }

        // Create usage metrics for the last 7 days
        const now = new Date();
        for (let day = 0; day < 7; day++) {
          const date = new Date(now);
          date.setDate(date.getDate() - day);
          
          await createUsageMetric({
            projectId: project.id,
            metricType: "database_size",
            value: Math.floor(Math.random() * 500) + 100,
            timestamp: date,
          });
          
          await createUsageMetric({
            projectId: project.id,
            metricType: "api_calls",
            value: Math.floor(Math.random() * 10000) + 1000,
            timestamp: date,
          });
        }

        // Create subscription
        await createSubscription({
          projectId: project.id,
          plan: ["free", "pro"][Math.floor(Math.random() * 2)],
        });
      }
    }

    console.log("\n✅ Demo data seeding completed successfully!");
    
  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}

// Run the seed function
seedSimpleData()
  .then(() => {
    console.log("\n🎉 Seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Seeding failed:", error);
    process.exit(1);
  });
