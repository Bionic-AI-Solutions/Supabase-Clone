#!/bin/bash
# Database Provisioning Script for Organizations
# This script creates a new PostgreSQL database for an organization

set -e

# Required environment variables
: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${ORG_ID:?ORG_ID is required}"

# Generate database name
DATABASE_NAME="supabase_org_${ORG_ID}"

echo "Provisioning database for organization ${ORG_ID}..."
echo "Database name: ${DATABASE_NAME}"

# Export password for psql
export PGPASSWORD="${POSTGRES_PASSWORD}"

# Check if database already exists
DB_EXISTS=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DATABASE_NAME}'")

if [ "$DB_EXISTS" = "1" ]; then
    echo "Database ${DATABASE_NAME} already exists. Skipping creation."
    exit 0
fi

# Create the database
echo "Creating database ${DATABASE_NAME}..."
psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE ${DATABASE_NAME};"

# Initialize the database with required extensions and schemas
echo "Initializing database ${DATABASE_NAME}..."
sed "s/{{ORG_ID}}/${ORG_ID}/g; s/{{DATABASE_NAME}}/${DATABASE_NAME}/g" /scripts/init-tenant-db.sql | \
    psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${DATABASE_NAME}"

echo "Database ${DATABASE_NAME} provisioned successfully!"

# Output connection string
echo "Connection string: postgresql://${POSTGRES_USER}:****@${POSTGRES_HOST}:${POSTGRES_PORT}/${DATABASE_NAME}"
