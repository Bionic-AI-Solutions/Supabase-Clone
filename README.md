# Supabase Clone - Multi-Tenant Platform

A complete multi-tenant Supabase platform with organization-level database isolation and project-level schema separation.

## Architecture

### Multi-Tenancy Model

- **Organization Level**: Each organization gets its own dedicated PostgreSQL database
- **Project Level**: Each project within an organization gets its own schema within the org database
- **Storage**: MinIO buckets isolated per organization and project
- **Authentication**: Manus OAuth with role-based access control

### Database Structure

```
Organization → Database (supabase_org_{slug})
  ├── Project 1 → Schema (project_{slug})
  ├── Project 2 → Schema (project_{slug})
  └── Project 3 → Schema (project_{slug})
```

## Features

### Core Platform
- ✅ Organization management with team collaboration
- ✅ Project provisioning with automated infrastructure setup
- ✅ Credentials management (API keys, JWT secrets, connection strings)
- ✅ Project pause/resume functionality
- ✅ Usage tracking and analytics
- ✅ Billing and subscription management
- ✅ Admin panel for platform administration

### Supabase Capabilities (Per Project)
- ✅ Database with schema isolation
- ✅ Authentication configuration
- ✅ Storage buckets
- ✅ Edge Functions management
- ✅ Realtime channels
- 🚧 Supabase Studio integration (in progress)

## Tech Stack

- **Frontend**: React 19 + Tailwind CSS 4 + Wouter
- **Backend**: Express + tRPC 11
- **Database**: MySQL (platform) + PostgreSQL (tenant databases)
- **Storage**: MinIO
- **Authentication**: Manus OAuth
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm
- MySQL database
- PostgreSQL (for tenant databases)
- MinIO (for storage)

### Installation

```bash
# Install dependencies
pnpm install

# Set up database schema
pnpm db:push

# Seed plan limits
tsx scripts/seed-plans.mjs

# Start development server
pnpm dev
```

### Environment Variables

The platform uses Manus-managed environment variables. Key variables include:

- `DATABASE_URL`: MySQL connection string for platform database
- `JWT_SECRET`: Session signing secret
- `VITE_APP_TITLE`: Platform title
- `VITE_APP_LOGO`: Platform logo URL

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   └── lib/           # tRPC client
├── server/                # Express + tRPC backend
│   ├── routers.ts        # API endpoints
│   ├── db.ts             # Database helpers
│   ├── provisioning.ts   # Infrastructure provisioning
│   └── *.test.ts         # Backend tests
├── drizzle/              # Database schema and migrations
│   └── schema.ts         # Table definitions
└── scripts/              # Utility scripts
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

All 13 backend tests are passing, covering:
- Organization CRUD operations
- Project provisioning and management
- Credentials generation and regeneration
- Member management
- Subscription handling

## Deployment

### Kubernetes (Recommended)

Kubernetes deployment manifests and Helm charts will be provided for production deployment with:

- Kong API Gateway for routing
- Supavisor for connection pooling
- MinIO for distributed storage
- PostgreSQL for tenant databases
- Namespace-based isolation

### Docker

Docker Compose configuration for local development and testing.

## Roadmap

- [x] Core platform with organization and project management
- [x] Database architecture with org-level isolation
- [x] Automated project provisioning
- [x] Usage tracking and billing foundation
- [ ] Supabase Studio integration with proxy routing
- [ ] MinIO bucket policies and access control
- [ ] Kubernetes deployment package
- [ ] Monitoring and observability
- [ ] Backup and disaster recovery

## Contributing

This is a private project for Bionic AI Solutions. For questions or issues, please contact the development team.

## License

Proprietary - All rights reserved by Bionic AI Solutions

