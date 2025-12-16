#!/bin/bash
# Project Schema Provisioning Script
# This script creates a new schema within an organization's database for a project

set -e

# Required environment variables
: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${ORG_ID:?ORG_ID is required}"
: "${PROJECT_ID:?PROJECT_ID is required}"

# Generate names
DATABASE_NAME="supabase_org_${ORG_ID}"
SCHEMA_NAME="project_${PROJECT_ID}"

echo "Provisioning schema for project ${PROJECT_ID} in organization ${ORG_ID}..."
echo "Database: ${DATABASE_NAME}"
echo "Schema: ${SCHEMA_NAME}"

# Export password for psql
export PGPASSWORD="${POSTGRES_PASSWORD}"

# Check if database exists
DB_EXISTS=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DATABASE_NAME}'")

if [ "$DB_EXISTS" != "1" ]; then
    echo "Error: Database ${DATABASE_NAME} does not exist. Please provision the organization database first."
    exit 1
fi

# Check if schema already exists
SCHEMA_EXISTS=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${DATABASE_NAME}" -tAc "SELECT 1 FROM information_schema.schemata WHERE schema_name='${SCHEMA_NAME}'")

if [ "$SCHEMA_EXISTS" = "1" ]; then
    echo "Schema ${SCHEMA_NAME} already exists. Skipping creation."
    exit 0
fi

# Create the schema using the database function
echo "Creating schema ${SCHEMA_NAME}..."
psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${DATABASE_NAME}" -c "SELECT create_project_schema('${SCHEMA_NAME}');"

echo "Schema ${SCHEMA_NAME} provisioned successfully!"

# Output connection details
echo "Connection string: postgresql://${POSTGRES_USER}:****@${POSTGRES_HOST}:${POSTGRES_PORT}/${DATABASE_NAME}?schema=${SCHEMA_NAME}"
