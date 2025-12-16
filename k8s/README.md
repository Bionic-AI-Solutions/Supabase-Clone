# Kubernetes Deployment Package

This directory contains all necessary files for deploying the Supabase Multi-Tenant Platform on Kubernetes.

## Package Contents

```
k8s/
├── helm/
│   └── supabase-platform/          # Helm chart for the platform
│       ├── Chart.yaml              # Chart metadata and dependencies
│       ├── values.yaml             # Default configuration values
│       └── templates/              # Kubernetes manifest templates
│           ├── deployment.yaml     # Platform application deployment
│           ├── service.yaml        # Service definitions
│           ├── ingress.yaml        # Ingress configuration
│           ├── secrets.yaml        # Secret templates
│           ├── serviceaccount.yaml # RBAC configuration
│           ├── tenant-postgres-cluster.yaml  # Tenant PostgreSQL cluster
│           ├── db-init-job.yaml    # Database initialization job
│           ├── hpa.yaml            # Horizontal Pod Autoscaler
│           └── _helpers.tpl        # Helm template helpers
├── scripts/
│   ├── init-platform-db.sql       # Platform database schema
│   ├── init-tenant-db.sql         # Tenant database initialization
│   ├── provision-org-database.sh  # Organization database provisioning
│   └── provision-project-schema.sh # Project schema provisioning
└── docs/
    └── DEPLOYMENT.md               # Comprehensive deployment guide
```

## Quick Start

Follow these steps for a basic deployment:

**Step 1**: Install CloudNativePG operator

```bash
helm repo add cnpg https://cloudnative-pg.io/charts/
helm install cnpg cnpg/cloudnative-pg --namespace cnpg-system --create-namespace
```

**Step 2**: Create namespace

```bash
kubectl create namespace supabase-platform
```

**Step 3**: Customize values

```bash
cp helm/supabase-platform/values.yaml my-values.yaml
# Edit my-values.yaml with your configuration
```

**Step 4**: Install the platform

```bash
helm install supabase-platform ./helm/supabase-platform \
  --namespace supabase-platform \
  --values my-values.yaml
```

**Step 5**: Initialize platform database

```bash
# See docs/DEPLOYMENT.md for detailed instructions
```

## Documentation

Comprehensive deployment documentation is available in `docs/DEPLOYMENT.md`, including:

- Architecture overview
- Prerequisites and requirements
- Detailed installation steps
- Configuration reference
- Monitoring and observability
- Backup and disaster recovery
- Scaling procedures
- Troubleshooting guide
- Security considerations
- Upgrade procedures

## Zero-Touch Deployment

This package follows zero-touch deployment principles. You should only need to:

1. Customize configuration values in `my-values.yaml`
2. Run the Helm install command
3. Initialize the platform database

No code modifications are required for standard deployments.

## Support

For issues, questions, or contributions:

- GitHub Repository: [https://github.com/Bionic-AI-Solutions/Supabase-Clone](https://github.com/Bionic-AI-Solutions/Supabase-Clone)
- Issue Tracker: GitHub Issues
- Documentation: `docs/DEPLOYMENT.md`

---

**Version**: 1.0.0  
**Kubernetes**: 1.24+  
**Helm**: 3.8+
