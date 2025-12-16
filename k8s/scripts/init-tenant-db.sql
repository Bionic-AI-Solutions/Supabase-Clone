-- Tenant Database Initialization Script
-- This script is run for each new organization database
-- Variables: {{ORG_ID}}, {{DATABASE_NAME}}

-- Enable required PostgreSQL extensions for Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create auth schema for Supabase Auth
CREATE SCHEMA IF NOT EXISTS auth;

-- Create storage schema for Supabase Storage
CREATE SCHEMA IF NOT EXISTS storage;

-- Create realtime schema for Supabase Realtime
CREATE SCHEMA IF NOT EXISTS realtime;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT USAGE ON SCHEMA storage TO postgres;
GRANT USAGE ON SCHEMA realtime TO postgres;

-- Create function to automatically create project schemas
CREATE OR REPLACE FUNCTION create_project_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Create the schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    
    -- Grant permissions
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO postgres', schema_name);
    EXECUTE format('GRANT ALL ON SCHEMA %I TO postgres', schema_name);
    
    -- Create default tables in the project schema
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(320) UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', schema_name);
    
    -- Create updated_at trigger
    EXECUTE format('
        CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON %I.users 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column()', schema_name);
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create audit log function
CREATE OR REPLACE FUNCTION audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, operation, new_data, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW), CURRENT_TIMESTAMP);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, operation, old_data, new_data, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), CURRENT_TIMESTAMP);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, operation, old_data, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), CURRENT_TIMESTAMP);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create audit_logs table in public schema
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_created ON public.audit_logs(table_name, created_at);

COMMENT ON DATABASE CURRENT_DATABASE() IS 'Organization {{ORG_ID}} - Multi-tenant Supabase database';
