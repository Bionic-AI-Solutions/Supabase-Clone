import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";

// Import schema
import {
  users,
  organizations,
  organizationMembers,
  projects,
  projectCredentials,
  edgeFunctions,
  realtimeChannels,
  usageMetrics,
  subscriptions,
} from "../drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

async function seedDemoData() {
  console.log("🌱 Seeding demo data...");

  try {
    // Create demo users
    console.log("Creating demo users...");
    const demoUsers = [];
    for (let i = 1; i <= 10; i++) {
      const userId = await db.insert(users).values({
        openId: `demo-user-${i}-${nanoid(8)}`,
        name: `Demo User ${i}`,
        email: `demo${i}@example.com`,
        loginMethod: "email",
        role: i === 1 ? "admin" : "user",
      });
      demoUsers.push({ id: userId[0].insertId, openId: `demo-user-${i}` });
    }
    console.log(`✓ Created ${demoUsers.length} demo users`);

    // Create demo organizations
    console.log("Creating demo organizations...");
    const demoOrgs = [];
    const orgNames = [
      "Acme Corporation",
      "TechStart Inc",
      "Global Solutions",
      "Innovation Labs",
      "Digital Ventures",
      "Cloud Systems",
      "Data Dynamics",
      "Smart Apps Co",
    ];

    for (let i = 0; i < orgNames.length; i++) {
      const slug = orgNames[i].toLowerCase().replace(/\s+/g, "-");
      const orgDatabase = `supabase_org_${slug}_${nanoid(6)}`;
      
      const orgId = await db.insert(organizations).values({
        name: orgNames[i],
        slug: `${slug}-${nanoid(6)}`,
        orgDatabase,
        ownerUserId: demoUsers[i % demoUsers.length].id,
      });
      
      demoOrgs.push({
        id: orgId[0].insertId,
        name: orgNames[i],
        ownerUserId: demoUsers[i % demoUsers.length].id,
      });

      // Add organization members
      const memberCount = Math.floor(Math.random() * 3) + 2; // 2-4 members per org
      for (let j = 0; j < memberCount; j++) {
        const userId = demoUsers[(i + j) % demoUsers.length].id;
        await db.insert(organizationMembers).values({
          organizationId: orgId[0].insertId,
          userId,
          role: j === 0 ? "owner" : j === 1 ? "admin" : "member",
        });
      }
    }
    console.log(`✓ Created ${demoOrgs.length} demo organizations`);

    // Create demo projects
    console.log("Creating demo projects...");
    const projectTypes = ["production", "staging", "development", "testing"];
    const regions = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"];
    let projectCount = 0;

    for (const org of demoOrgs) {
      const numProjects = Math.floor(Math.random() * 3) + 1; // 1-3 projects per org
      
      for (let i = 0; i < numProjects; i++) {
        const projectName = `${org.name.split(" ")[0]} ${projectTypes[i % projectTypes.length]}`;
        const slug = projectName.toLowerCase().replace(/\s+/g, "-");
        const region = regions[Math.floor(Math.random() * regions.length)];
        const databaseName = `supabase_${slug}_${nanoid(8)}`;
        const databaseSchema = `project_${nanoid(8)}`;
        
        const projectId = await db.insert(projects).values({
          name: projectName,
          slug: `${slug}-${nanoid(6)}`,
          organizationId: org.id,
          region,
          status: Math.random() > 0.1 ? "active" : "paused",
          databaseName,
          databaseSchema,
        });

        const pid = projectId[0].insertId;
        projectCount++;

        // Create project credentials
        await db.insert(projectCredentials).values({
          projectId: pid,
          anonKey: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${nanoid(40)}`,
          serviceKey: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${nanoid(60)}`,
          jwtSecret: nanoid(64),
          dbUsername: `project_user_${pid}`,
          dbPassword: nanoid(32),
          storageBucket: `project-${pid}-storage`,
          postgresConnectionString: `postgresql://project_user_${pid}:***@localhost:5432/${databaseName}`,
        });

        // Create edge functions
        const functionNames = ["send-email", "process-payment", "generate-report", "sync-data"];
        const numFunctions = Math.floor(Math.random() * 3) + 1;
        
        for (let j = 0; j < numFunctions; j++) {
          await db.insert(edgeFunctions).values({
            projectId: pid,
            name: functionNames[j % functionNames.length],
            description: `${functionNames[j % functionNames.length]} function`,
            runtime: "deno",
            code: `export default async function handler(req: Request) {\n  return new Response("Hello from ${functionNames[j % functionNames.length]}");\n}`,
            envVars: JSON.stringify({ API_KEY: "demo-key" }),
            status: Math.random() > 0.2 ? "deployed" : "draft",
          });
        }

        // Create realtime channels
        const channelNames = ["public:messages", "public:notifications", "public:presence"];
        const numChannels = Math.floor(Math.random() * 2) + 1;
        
        for (let j = 0; j < numChannels; j++) {
          await db.insert(realtimeChannels).values({
            projectId: pid,
            name: channelNames[j % channelNames.length],
            config: JSON.stringify({
              broadcast: true,
              presence: true,
              postgres_changes: [{ event: "*", schema: "public", table: "messages" }],
            }),
            isEnabled: Math.random() > 0.3,
          });
        }

        // Create usage metrics (last 30 days)
        const now = new Date();
        for (let day = 0; day < 30; day++) {
          const date = new Date(now);
          date.setDate(date.getDate() - day);
          
          await db.insert(usageMetrics).values({
            projectId: pid,
            metricType: "database_size",
            value: Math.floor(Math.random() * 500) + 100, // 100-600 MB
            timestamp: date,
          });
          
          await db.insert(usageMetrics).values({
            projectId: pid,
            metricType: "api_calls",
            value: Math.floor(Math.random() * 10000) + 1000, // 1000-11000 calls
            timestamp: date,
          });
          
          await db.insert(usageMetrics).values({
            projectId: pid,
            metricType: "storage_used",
            value: Math.floor(Math.random() * 1000) + 200, // 200-1200 MB
            timestamp: date,
          });
          
          await db.insert(usageMetrics).values({
            projectId: pid,
            metricType: "bandwidth",
            value: Math.floor(Math.random() * 5000) + 500, // 500-5500 MB
            timestamp: date,
          });
        }

        // Create subscription
        const plans = ["free", "pro", "enterprise"];
        const plan = plans[Math.floor(Math.random() * plans.length)];
        
        await db.insert(subscriptions).values({
          projectId: pid,
          plan,
          status: "active",
          currentPeriodStart: new Date(now.getFullYear(), now.getMonth(), 1),
          currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        });
      }
    }
    console.log(`✓ Created ${projectCount} demo projects with credentials, functions, channels, and usage data`);

    console.log("\n✅ Demo data seeding completed successfully!");
    console.log(`\nSummary:`);
    console.log(`- Users: ${demoUsers.length}`);
    console.log(`- Organizations: ${demoOrgs.length}`);
    console.log(`- Projects: ${projectCount}`);
    console.log(`- Edge Functions: ~${projectCount * 2} average`);
    console.log(`- Realtime Channels: ~${projectCount * 1.5} average`);
    console.log(`- Usage Metrics: ${projectCount * 30 * 4} records (30 days × 4 metric types)`);
    
  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}

// Run the seed function
seedDemoData()
  .then(() => {
    console.log("\n🎉 Seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Seeding failed:", error);
    process.exit(1);
  });
