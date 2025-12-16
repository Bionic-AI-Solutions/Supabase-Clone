# Supabase Multi-Tenant Platform - Kubernetes Deployment Guide

This document provides comprehensive instructions for deploying the Supabase Multi-Tenant Platform on Kubernetes with PostgreSQL, MinIO object storage, and Kong API Gateway.

## Architecture Overview

The platform implements a hierarchical multi-tenant architecture with strong isolation guarantees:

**Organization Level**: Each organization receives a dedicated PostgreSQL database (`supabase_org_{id}`), ensuring complete data isolation at the database level. This prevents cross-organization data leakage and simplifies backup, restore, and resource allocation operations.

**Project Level**: Within each organization database, individual projects are isolated using PostgreSQL schemas (`project_{id}`). This approach provides logical separation while maintaining efficient resource utilization and simplifying database management.

**Storage Layer**: MinIO provides S3-compatible object storage with bucket-level isolation. Each project receives its own bucket with scoped access policies, ensuring that storage resources remain completely separated between projects.

**API Gateway**: Kong routes all API traffic, providing rate limiting, authentication, and request routing to the appropriate backend services based on project context.

## Prerequisites

Before deploying the platform, ensure your Kubernetes cluster meets the following requirements:

| Component | Requirement | Purpose |
|-----------|------------|---------|
| Kubernetes Version | 1.24+ | Core orchestration platform |
| Helm | 3.8+ | Package management and templating |
| kubectl | Matching cluster version | Command-line cluster management |
| CloudNativePG Operator | 1.20+ | PostgreSQL cluster management |
| Cert-Manager | 1.11+ (optional) | TLS certificate automation |
| Ingress Controller | nginx/traefik | External traffic routing |
| Storage Class | Block storage with dynamic provisioning | Persistent volume management |

**Resource Requirements** (minimum for production):

- **CPU**: 8 cores total (4 for databases, 2 for platform, 2 for storage)
- **Memory**: 16 GB total (8 GB for databases, 4 GB for platform, 4 GB for storage)
- **Storage**: 200 GB persistent storage (100 GB for databases, 100 GB for object storage)

## Installation Steps

### Step 1: Install Required Operators

The platform relies on the CloudNativePG operator for PostgreSQL cluster management. Install it using the official Helm chart:

```bash
# Add CloudNativePG Helm repository
helm repo add cnpg https://cloudnative-pg.io/charts/
helm repo update

# Install CloudNativePG operator
helm install cnpg \
  --namespace cnpg-system \
  --create-namespace \
  cnpg/cloudnative-pg
```

Verify the operator is running:

```bash
kubectl get pods -n cnpg-system
```

### Step 2: Create Namespace

Create a dedicated namespace for the platform deployment:

```bash
kubectl create namespace supabase-platform
```

### Step 3: Configure Values

Copy the default values file and customize it for your environment:

```bash
cp k8s/helm/supabase-platform/values.yaml my-values.yaml
```

**Critical configuration parameters** that must be updated:

```yaml
# Platform configuration
platform:
  ingress:
    hosts:
      - host: your-domain.com  # Change to your actual domain
    tls:
      - secretName: platform-tls
        hosts:
          - your-domain.com
  
  env:
    JWT_SECRET: "CHANGE-THIS-TO-SECURE-RANDOM-STRING"  # Generate: openssl rand -base64 32
    OWNER_OPEN_ID: "your-owner-id"  # Your admin user ID
    OWNER_NAME: "Platform Administrator"

# PostgreSQL configuration
postgresql:
  auth:
    password: "CHANGE-THIS-SECURE-PASSWORD"  # Generate: openssl rand -base64 32

# MinIO configuration
minio:
  auth:
    rootPassword: "CHANGE-THIS-MINIO-PASSWORD"  # Generate: openssl rand -base64 32
```

**Security best practices**: Never commit the customized values file with secrets to version control. Use Kubernetes Secrets or external secret management systems (HashiCorp Vault, AWS Secrets Manager) for production deployments.

### Step 4: Install the Platform

Deploy the platform using Helm with your customized values:

```bash
helm install supabase-platform \
  ./k8s/helm/supabase-platform \
  --namespace supabase-platform \
  --values my-values.yaml \
  --wait \
  --timeout 10m
```

The `--wait` flag ensures Helm waits for all resources to be ready before returning. The installation process typically takes 5-10 minutes, depending on cluster performance and image pull speeds.

### Step 5: Initialize Platform Database

After the platform pods are running, initialize the platform management database with the required schema:

```bash
# Get the platform PostgreSQL pod name
PLATFORM_PG_POD=$(kubectl get pods -n supabase-platform -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')

# Copy initialization script to the pod
kubectl cp k8s/scripts/init-platform-db.sql \
  supabase-platform/${PLATFORM_PG_POD}:/tmp/init-platform-db.sql

# Execute the initialization script
kubectl exec -n supabase-platform ${PLATFORM_PG_POD} -- \
  psql -U supabase_admin -d supabase_platform -f /tmp/init-platform-db.sql
```

Verify the initialization completed successfully:

```bash
kubectl exec -n supabase-platform ${PLATFORM_PG_POD} -- \
  psql -U supabase_admin -d supabase_platform -c "\dt"
```

You should see all platform tables listed (users, organizations, projects, etc.).

### Step 6: Verify Deployment

Check that all components are running correctly:

```bash
# Check all pods are running
kubectl get pods -n supabase-platform

# Check services are created
kubectl get svc -n supabase-platform

# Check ingress is configured
kubectl get ingress -n supabase-platform

# Check PostgreSQL cluster status
kubectl get cluster -n supabase-platform
```

**Expected output**: All pods should show `Running` status, the PostgreSQL cluster should show `Cluster in healthy state`, and the ingress should have an external IP or hostname assigned.

### Step 7: Access the Platform

Once deployment is complete, access the platform through your configured domain:

```
https://your-domain.com
```

The first user to log in will automatically be assigned the `admin` role if their `openId` matches the `OWNER_OPEN_ID` configured in the values file.

## Database Provisioning

The platform automatically provisions databases and schemas as organizations and projects are created through the web interface. However, you can also provision them manually using the provided scripts.

### Manual Organization Database Provisioning

To manually create a database for an organization:

```bash
# Get tenant PostgreSQL cluster connection details
TENANT_PG_HOST=$(kubectl get cluster -n supabase-platform supabase-platform-tenant-postgres -o jsonpath='{.status.writeService}')
TENANT_PG_PASSWORD=$(kubectl get secret -n supabase-platform supabase-platform-tenant-postgres-superuser -o jsonpath='{.data.password}' | base64 -d)

# Run provisioning script
kubectl run -n supabase-platform provision-org-db-123 \
  --image=postgres:15-alpine \
  --rm -it --restart=Never \
  --env="POSTGRES_HOST=${TENANT_PG_HOST}" \
  --env="POSTGRES_USER=postgres" \
  --env="POSTGRES_PASSWORD=${TENANT_PG_PASSWORD}" \
  --env="ORG_ID=123" \
  -- /bin/bash -c "$(cat k8s/scripts/provision-org-database.sh)"
```

### Manual Project Schema Provisioning

To manually create a schema for a project within an organization database:

```bash
# Run project schema provisioning script
kubectl run -n supabase-platform provision-project-schema-456 \
  --image=postgres:15-alpine \
  --rm -it --restart=Never \
  --env="POSTGRES_HOST=${TENANT_PG_HOST}" \
  --env="POSTGRES_USER=postgres" \
  --env="POSTGRES_PASSWORD=${TENANT_PG_PASSWORD}" \
  --env="ORG_ID=123" \
  --env="PROJECT_ID=456" \
  -- /bin/bash -c "$(cat k8s/scripts/provision-project-schema.sh)"
```

## Configuration Reference

### Platform Configuration

The platform application accepts the following environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Application environment | Yes | `production` |
| `DATABASE_URL` | Platform PostgreSQL connection string | Yes | - |
| `JWT_SECRET` | Secret for signing JWT tokens | Yes | - |
| `TENANT_POSTGRES_HOST` | Tenant PostgreSQL cluster hostname | Yes | - |
| `TENANT_POSTGRES_PORT` | Tenant PostgreSQL cluster port | No | `5432` |
| `TENANT_POSTGRES_USER` | Tenant PostgreSQL superuser | Yes | - |
| `TENANT_POSTGRES_PASSWORD` | Tenant PostgreSQL password | Yes | - |
| `MINIO_ENDPOINT` | MinIO service endpoint | Yes | - |
| `MINIO_ACCESS_KEY` | MinIO root access key | Yes | - |
| `MINIO_SECRET_KEY` | MinIO root secret key | Yes | - |
| `OWNER_OPEN_ID` | Platform owner OpenID | Yes | - |
| `OWNER_NAME` | Platform owner display name | Yes | - |

### PostgreSQL Configuration

The CloudNativePG cluster can be tuned for performance using PostgreSQL parameters:

```yaml
tenantPostgres:
  cluster:
    postgresql:
      parameters:
        max_connections: "200"  # Maximum concurrent connections
        shared_buffers: "2GB"  # Memory for caching data
        effective_cache_size: "6GB"  # Estimated OS cache size
        work_mem: "10MB"  # Memory per query operation
```

**Performance tuning recommendations**:

- Set `shared_buffers` to 25% of available RAM
- Set `effective_cache_size` to 50-75% of available RAM
- Increase `max_connections` based on expected concurrent projects
- Monitor query performance and adjust `work_mem` accordingly

### MinIO Configuration

MinIO can be configured for high availability and performance:

```yaml
minio:
  mode: distributed  # Use distributed mode for HA
  replicas: 4  # Number of MinIO instances (must be 4, 8, 12, or 16)
  persistence:
    size: 100Gi  # Storage per instance
```

**Storage considerations**: Total available storage is `replicas * persistence.size / 2` due to erasure coding. For 4 replicas with 100Gi each, you get approximately 200Gi usable storage.

## Monitoring and Observability

Enable Prometheus and Grafana for comprehensive monitoring:

```yaml
monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
```

**Key metrics to monitor**:

- **Platform metrics**: Request rate, response time, error rate
- **Database metrics**: Connection pool usage, query performance, replication lag
- **Storage metrics**: Bucket usage, request rate, bandwidth
- **Resource metrics**: CPU, memory, disk I/O, network throughput

## Backup and Disaster Recovery

The platform includes automated backup capabilities using CloudNativePG's built-in backup system.

### Backup Configuration

Backups are stored in MinIO and can be configured with retention policies:

```yaml
backup:
  enabled: true
  schedule: "0 2 * * *"  # Daily at 2 AM UTC
  retention: 30  # Keep backups for 30 days
```

### Restore from Backup

To restore a PostgreSQL cluster from backup:

```bash
# List available backups
kubectl cnpg backup list -n supabase-platform supabase-platform-tenant-postgres

# Restore from specific backup
kubectl cnpg restore -n supabase-platform \
  --backup-name supabase-platform-tenant-postgres-20240101020000 \
  --target-name restored-cluster
```

## Scaling

The platform supports both horizontal and vertical scaling to handle increased load.

### Horizontal Pod Autoscaling

The platform deployment includes HPA configuration:

```yaml
platform:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
```

Monitor autoscaling behavior:

```bash
kubectl get hpa -n supabase-platform
```

### Database Scaling

Scale the PostgreSQL cluster by increasing instances:

```bash
kubectl cnpg scale -n supabase-platform \
  supabase-platform-tenant-postgres \
  --instances 5
```

**Important**: Scaling down requires careful planning to avoid data loss. Always ensure replication is healthy before reducing instances.

## Troubleshooting

### Common Issues

**Platform pods not starting**:

```bash
# Check pod logs
kubectl logs -n supabase-platform -l app.kubernetes.io/name=supabase-platform

# Check events
kubectl get events -n supabase-platform --sort-by='.lastTimestamp'
```

**Database connection failures**:

```bash
# Verify PostgreSQL cluster is healthy
kubectl get cluster -n supabase-platform

# Check database logs
kubectl logs -n supabase-platform supabase-platform-tenant-postgres-1
```

**MinIO not accessible**:

```bash
# Check MinIO pods
kubectl get pods -n supabase-platform -l app=minio

# Test MinIO connectivity
kubectl run -n supabase-platform minio-test \
  --image=minio/mc \
  --rm -it --restart=Never \
  -- mc alias set myminio http://supabase-platform-minio:9000 ACCESS_KEY SECRET_KEY
```

### Debug Mode

Enable debug logging for the platform:

```yaml
platform:
  env:
    LOG_LEVEL: "debug"
```

## Security Considerations

**Network Policies**: Implement network policies to restrict traffic between components:

```bash
kubectl apply -f k8s/network-policies/
```

**Secret Management**: Use external secret management systems for production:

- HashiCorp Vault with Vault Secrets Operator
- AWS Secrets Manager with External Secrets Operator
- Azure Key Vault with Secrets Store CSI Driver

**TLS/SSL**: Ensure all external communication uses TLS:

- Configure cert-manager for automatic certificate management
- Use Let's Encrypt for free SSL certificates
- Enforce HTTPS-only access through ingress annotations

**RBAC**: Apply principle of least privilege for service accounts and user access.

## Upgrade Procedures

To upgrade the platform to a new version:

```bash
# Update Helm repository
helm repo update

# Upgrade with new values
helm upgrade supabase-platform \
  ./k8s/helm/supabase-platform \
  --namespace supabase-platform \
  --values my-values.yaml \
  --wait
```

**Pre-upgrade checklist**:

1. Create a full backup of all databases
2. Review changelog for breaking changes
3. Test upgrade in staging environment
4. Plan maintenance window for production upgrade
5. Verify rollback procedure is documented

## Uninstallation

To completely remove the platform:

```bash
# Delete Helm release
helm uninstall supabase-platform -n supabase-platform

# Delete PVCs (WARNING: This deletes all data)
kubectl delete pvc -n supabase-platform --all

# Delete namespace
kubectl delete namespace supabase-platform
```

**Data retention**: Before uninstalling, ensure you have exported or backed up all critical data. PVC deletion is irreversible.

## Support and Resources

For additional help and resources:

- **GitHub Repository**: [https://github.com/Bionic-AI-Solutions/Supabase-Clone](https://github.com/Bionic-AI-Solutions/Supabase-Clone)
- **Issue Tracker**: Report bugs and request features on GitHub Issues
- **Documentation**: Additional guides available in `k8s/docs/`

---

**Author**: Manus AI  
**Last Updated**: December 2024  
**Version**: 1.0.0
