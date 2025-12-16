-- Platform Database Initialization Script
-- This script initializes the platform management database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    "openId" VARCHAR(64) NOT NULL UNIQUE,
    name TEXT,
    email VARCHAR(320),
    "loginMethod" VARCHAR(64),
    role VARCHAR(20) DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin')),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSignedIn" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    "ownerUserId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "orgDatabase" VARCHAR(255) UNIQUE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
    id SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE("organizationId", "userId")
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    "organizationId" INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    region VARCHAR(50) DEFAULT 'us-east-1' NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'paused', 'deleted')),
    "databaseName" VARCHAR(255),
    "databaseSchema" VARCHAR(255) UNIQUE,
    "databaseHost" VARCHAR(255),
    "databasePort" INTEGER DEFAULT 5432,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pausedAt" TIMESTAMP,
    "deletedAt" TIMESTAMP
);

-- Create project_credentials table
CREATE TABLE IF NOT EXISTS project_credentials (
    id SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    "anonKey" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "jwtSecret" TEXT NOT NULL,
    "databaseUrl" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "realtimeUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    plan VARCHAR(50) DEFAULT 'free' NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due')),
    "currentPeriodStart" TIMESTAMP NOT NULL,
    "currentPeriodEnd" TIMESTAMP NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN DEFAULT FALSE,
    "stripeCustomerId" VARCHAR(255),
    "stripeSubscriptionId" VARCHAR(255),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create plan_limits table
CREATE TABLE IF NOT EXISTS plan_limits (
    id SERIAL PRIMARY KEY,
    plan VARCHAR(50) NOT NULL UNIQUE CHECK (plan IN ('free', 'pro', 'enterprise')),
    "maxProjects" INTEGER NOT NULL,
    "maxDatabaseSize" BIGINT NOT NULL,
    "maxStorageSize" BIGINT NOT NULL,
    "maxBandwidth" BIGINT NOT NULL,
    "maxApiCalls" BIGINT NOT NULL,
    "maxEdgeFunctions" INTEGER NOT NULL,
    "maxRealtimeConnections" INTEGER NOT NULL,
    "priceMonthly" INTEGER DEFAULT 0,
    "priceYearly" INTEGER DEFAULT 0,
    features JSONB,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create usage_metrics table
CREATE TABLE IF NOT EXISTS usage_metrics (
    id SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "databaseSize" BIGINT DEFAULT 0,
    "storageSize" BIGINT DEFAULT 0,
    "bandwidth" BIGINT DEFAULT 0,
    "apiCalls" BIGINT DEFAULT 0,
    date DATE NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE("projectId", date)
);

-- Create edge_functions table
CREATE TABLE IF NOT EXISTS edge_functions (
    id SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    entrypoint VARCHAR(500) DEFAULT 'index.ts',
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'active', 'inactive')),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE("projectId", slug)
);

-- Create realtime_channels table
CREATE TABLE IF NOT EXISTS realtime_channels (
    id SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    "enablePresence" BOOLEAN DEFAULT FALSE,
    "enableBroadcast" BOOLEAN DEFAULT TRUE,
    "enablePostgresChanges" BOOLEAN DEFAULT FALSE,
    "postgresChangesTable" VARCHAR(255),
    "postgresChangesFilter" TEXT,
    config JSONB,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE("projectId", topic)
);

-- Insert default plan limits
INSERT INTO plan_limits (plan, "maxProjects", "maxDatabaseSize", "maxStorageSize", "maxBandwidth", "maxApiCalls", "maxEdgeFunctions", "maxRealtimeConnections", "priceMonthly", "priceYearly", features)
VALUES 
    ('free', 2, 536870912, 1073741824, 2147483648, 50000, 2, 100, 0, 0, '{"support": "community", "backups": false, "customDomain": false}'::jsonb),
    ('pro', 10, 8589934592, 107374182400, 21474836480, 500000, 10, 1000, 25, 250, '{"support": "email", "backups": true, "customDomain": true}'::jsonb),
    ('enterprise', -1, -1, -1, -1, -1, -1, -1, 0, 0, '{"support": "dedicated", "backups": true, "customDomain": true, "sla": true}'::jsonb)
ON CONFLICT (plan) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations("ownerUserId");
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members("organizationId");
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members("userId");
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects("organizationId");
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_project_date ON usage_metrics("projectId", date);
CREATE INDEX IF NOT EXISTS idx_edge_functions_project ON edge_functions("projectId");
CREATE INDEX IF NOT EXISTS idx_realtime_channels_project ON realtime_channels("projectId");

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_credentials_updated_at BEFORE UPDATE ON project_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plan_limits_updated_at BEFORE UPDATE ON plan_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_edge_functions_updated_at BEFORE UPDATE ON edge_functions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_realtime_channels_updated_at BEFORE UPDATE ON realtime_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
