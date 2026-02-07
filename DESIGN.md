# System Design & Tradeoffs

## Architecture Overview

The Store Orchestrator platform follows a **control plane + data plane** architecture pattern, similar to Kubernetes itself:

- **Control Plane**: Dashboard, Backend API, Orchestrator, PostgreSQL
- **Data Plane**: Individual store workloads (WooCommerce/Medusa instances)

This separation ensures that platform operations (creating/deleting stores) are independent from store operations (serving customer traffic).

## Key Design Decisions

### 1. Namespace-per-Store Isolation

**Decision**: Each store runs in its own Kubernetes namespace.

**Rationale**:
- **Strong Isolation**: Namespaces provide resource isolation, RBAC boundaries, and network policy enforcement
- **Easy Cleanup**: Deleting a namespace cascades to all contained resources (Pods, Services, PVCs, Secrets)
- **Resource Quotas**: Per-namespace ResourceQuotas prevent a single store from consuming all cluster resources
- **Naming Collision Prevention**: Services/Pods can have the same names across stores

**Tradeoffs**:
- ✅ **Pros**: Strong isolation, simple cleanup, quota enforcement
- ❌ **Cons**: Higher overhead (each namespace has its own ServiceAccount, default Secrets), limited to ~10,000 namespaces per cluster

**Alternatives Considered**:
- **Single namespace with label selectors**: Weaker isolation, complex cleanup, no native quota support
- **Separate clusters per store**: Too expensive, operational overhead

### 2. Helm for Packaging (vs Kustomize)

**Decision**: Use Helm 3 for packaging and deploying stores.

**Rationale**:
- **Templating**: Helm's Go templating allows dynamic values (store name, domain, resources)
- **Release Management**: Helm tracks releases, enabling upgrades, rollbacks, and status checks
- **Atomic Installs**: `--atomic` flag ensures all-or-nothing deployments with automatic rollback on failure
- **Idempotency**: `helm upgrade --install` is idempotent (safe to retry)
- **Ecosystem**: Large chart repository (Bitnami, etc.) for dependencies like PostgreSQL

**Tradeoffs**:
- ✅ **Pros**: Powerful templating, release tracking, atomic operations, ecosystem
- ❌ **Cons**: Learning curve, template complexity, "Helm hell" with nested dependencies

**Alternatives Considered**:
- **Kustomize**: Simpler, but lacks release management and templating power
- **Raw YAML + kubectl**: No templating, no release tracking, manual rollback

### 3. Node.js Orchestrator (vs Go Operator)

**Decision**: Build orchestrator in Node.js using `@kubernetes/client-node`.

**Rationale**:
- **Consistency**: Same language as Backend API (shared code, single runtime)
- **Rapid Development**: Faster iteration for MVP
- **Helm Integration**: Easy to shell out to `helm` CLI
- **Database Access**: Reuse PostgreSQL client from backend

**Tradeoffs**:
- ✅ **Pros**: Fast development, code reuse, simpler stack
- ❌ **Cons**: Less performant than Go, no native Kubernetes operator framework (Kubebuilder/Operator SDK)

**Alternatives Considered**:
- **Go with Kubebuilder**: More performant, better K8s integration, but steeper learning curve
- **Python with Kopf**: Similar to Node.js approach but different ecosystem

**Future Migration Path**: If performance becomes an issue, migrate to Go operator while keeping the same reconciliation logic.

### 4. PostgreSQL for Metadata (vs CRDs)

**Decision**: Store metadata in PostgreSQL instead of Kubernetes Custom Resources.

**Rationale**:
- **Richer Queries**: SQL enables complex queries (e.g., "stores created in last 7 days")
- **Audit Logging**: Natural fit for append-only audit logs
- **Decoupling**: Platform state is independent of Kubernetes API server
- **Familiarity**: Most developers know SQL better than CRD controllers

**Tradeoffs**:
- ✅ **Pros**: Rich queries, audit logs, decoupling, familiar
- ❌ **Cons**: External dependency, no native K8s watch mechanism, eventual consistency

**Alternatives Considered**:
- **Custom Resources (CRDs)**: More "Kubernetes-native", but limited query capabilities and no audit log support
- **etcd directly**: Too low-level, no schema validation

**Hybrid Approach**: Could use CRDs for store definitions and PostgreSQL for audit logs (future enhancement).

## Idempotency & Failure Handling

### Provisioning Idempotency

**Challenge**: Orchestrator may crash mid-provisioning. On restart, it must safely resume.

**Solution**:
1. **Database as Source of Truth**: Store status is persisted in PostgreSQL
2. **Namespace Check**: Before creating namespace, check if it already exists
3. **Helm Idempotency**: `helm upgrade --install` is safe to retry
4. **Atomic Installs**: `--atomic` flag rolls back on failure

**Example Flow**:
```
1. Store created with status='provisioning'
2. Orchestrator creates namespace
3. Orchestrator crashes
4. Orchestrator restarts
5. Reconcile loop finds store with status='provisioning'
6. Namespace already exists (idempotent check passes)
7. Helm install proceeds (idempotent)
8. Pods become ready
9. Status updated to 'ready'
```

### Timeout Handling

**Problem**: Provisioning may hang indefinitely (e.g., image pull failure).

**Solution**:
- **Helm Timeout**: `--timeout 10m` ensures Helm fails after 10 minutes
- **Readiness Check Timeout**: Orchestrator waits max 10 minutes for pods to be ready
- **Status Update**: On timeout, status set to 'failed' with error message

### Cleanup Guarantees

**Problem**: Partial cleanup leaves orphaned resources.

**Solution**:
1. **Helm Uninstall**: Removes all Helm-managed resources
2. **Namespace Deletion**: Cascades to any remaining resources (fail-safe)
3. **Database Cleanup**: Only delete DB record after successful K8s cleanup

**Failure Scenario**:
- If Helm uninstall fails, namespace deletion still removes resources
- If namespace deletion fails, store remains in 'deleting' status for manual intervention

## Production Differences

### Local vs Production Configuration

| Aspect | Local (Kind) | Production (k3s) |
|--------|-------------|------------------|
| **Domain** | `*.local.dev` | `*.yourdomain.com` |
| **Ingress TLS** | Disabled | Enabled (cert-manager) |
| **Storage Class** | `standard` (hostPath) | `local-path` or cloud provider |
| **Resource Limits** | Low (500m CPU, 512Mi RAM) | High (2 CPU, 2Gi RAM) |
| **Secrets** | Kubernetes Secrets | External Secrets Operator (optional) |
| **DNS** | `/etc/hosts` | Wildcard DNS record |
| **Monitoring** | Logs only | Prometheus + Grafana (optional) |

### Helm Values Overrides

**Local**:
```yaml
domain: local.dev
ingress:
  tls: false
storage:
  storageClass: standard
```

**Production**:
```yaml
domain: yourdomain.com
ingress:
  tls: true
  certManager: true
storage:
  storageClass: local-path
```

### TLS/cert-manager

**Local**: HTTP only (TLS adds complexity for development)

**Production**: HTTPS with Let's Encrypt via cert-manager

**Implementation**:
1. Install cert-manager in cluster
2. Create ClusterIssuer for Let's Encrypt
3. Ingress annotations trigger automatic certificate issuance
4. Certificates auto-renew every 90 days

### Secret Management

**Local**: Kubernetes Secrets (base64-encoded)

**Production Options**:
1. **Kubernetes Secrets**: Simple, but secrets in etcd
2. **External Secrets Operator**: Sync from Vault/AWS Secrets Manager
3. **Sealed Secrets**: Encrypt secrets in Git

**Recommendation**: Start with Kubernetes Secrets, migrate to External Secrets Operator for production.

### DNS Configuration

**Local**:
```bash
# /etc/hosts
127.0.0.1 dashboard.local.dev
127.0.0.1 mystore.local.dev
```

**Production**:
```
# DNS Provider (Cloudflare, Route53, etc.)
Type: A
Name: *
Value: VPS_IP
TTL: 300
```

Wildcard DNS allows `*.yourdomain.com` to resolve to VPS without per-store DNS updates.

## Scaling Considerations

### Current Limitations

- **Single Orchestrator Instance**: No leader election, not HA
- **Database Bottleneck**: All components share single PostgreSQL instance
- **Helm CLI Overhead**: Shelling out to `helm` is slower than native K8s API calls

### Horizontal Scaling Plan

**Orchestrator**:
1. **Leader Election**: Use Kubernetes Lease API for leader election
2. **Work Queue**: Distribute provisioning tasks across multiple orchestrator replicas
3. **Sharding**: Assign namespaces to specific orchestrator instances

**Backend API**:
- Already stateless, can scale horizontally with `kubectl scale deployment backend --replicas=3`
- Use PostgreSQL connection pooling (PgBouncer)

**Database**:
- **Read Replicas**: For read-heavy workloads (store list queries)
- **Connection Pooling**: PgBouncer to handle many concurrent connections
- **Sharding**: If > 100,000 stores, shard by store ID

### Concurrency Controls

**Problem**: Multiple stores provisioning simultaneously may overwhelm cluster.

**Solution**:
- **Semaphore**: Limit to N concurrent provisioning operations
- **Rate Limiting**: Max 1 store creation per minute per user
- **Queue**: FIFO queue for provisioning requests

**Implementation** (future):
```javascript
const CONCURRENCY_LIMIT = 5;
const provisioningSemaphore = new Semaphore(CONCURRENCY_LIMIT);

async function reconcile() {
  const stores = await getProvisioningStores();
  
  await Promise.all(
    stores.map(store => 
      provisioningSemaphore.acquire().then(async (release) => {
        try {
          await provisionStore(store);
        } finally {
          release();
        }
      })
    )
  );
}
```

## Security

### RBAC (Role-Based Access Control)

**Orchestrator Service Account**:
```yaml
rules:
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["create", "delete", "get", "list"]
- apiGroups: [""]
  resources: ["pods", "services", "persistentvolumeclaims"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "statefulsets"]
  verbs: ["get", "list", "watch"]
```

**Principle of Least Privilege**: Orchestrator can only create/delete namespaces and read resources, not modify store workloads.

### Network Policies

**Goal**: Prevent stores from communicating with each other.

**Implementation** (future):
```yaml
# Default deny all traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

# Allow ingress from nginx-ingress only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress
spec:
  podSelector:
    matchLabels:
      app: wordpress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
```

### Non-Root Containers

**Current**: WordPress and MySQL run as root (default images)

**Production Hardening**:
- Use non-root images (e.g., Bitnami WordPress)
- Set `securityContext.runAsNonRoot: true`
- Set `securityContext.readOnlyRootFilesystem: true` where possible

### Secret Encryption

**Current**: Secrets stored in etcd (base64-encoded)

**Production**:
- Enable etcd encryption at rest
- Use External Secrets Operator to avoid storing secrets in K8s

## Reliability

### Health Checks

**Liveness Probes**: Restart container if unhealthy
```yaml
livenessProbe:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 60
  periodSeconds: 10
```

**Readiness Probes**: Remove from load balancer if not ready
```yaml
readinessProbe:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 30
  periodSeconds: 5
```

### Persistent Storage

**Challenge**: Pods are ephemeral, but data must persist.

**Solution**:
- **StatefulSets**: For MySQL/PostgreSQL (stable network identity)
- **PersistentVolumeClaims**: For WordPress files, database data
- **StorageClass**: Defines provisioner (local-path, AWS EBS, etc.)

**Backup Strategy** (future):
- **Velero**: Backup PVCs and Kubernetes resources
- **Database Dumps**: Scheduled CronJobs to dump MySQL/PostgreSQL

### Disaster Recovery

**Scenario**: Cluster is destroyed.

**Recovery**:
1. **Restore PostgreSQL**: Platform metadata (store list, audit logs)
2. **Restore PVCs**: Store data (WordPress files, databases)
3. **Redeploy Platform**: Helm install platform chart
4. **Orchestrator Reconciliation**: Detects stores in DB but not in K8s, recreates them

**RTO/RPO**:
- **RTO** (Recovery Time Objective): 1 hour (manual restore)
- **RPO** (Recovery Point Objective): 24 hours (daily backups)

## Upgrades and Rollback

### Platform Upgrades

**Helm-based Upgrades**:
```bash
helm upgrade platform ./helm/platform \
  --namespace platform \
  --set image.tag=v2
```

**Rollback**:
```bash
helm rollback platform --namespace platform
```

### Store Upgrades

**Challenge**: Upgrade WordPress/MySQL versions for existing stores.

**Solution**:
1. Update Helm chart values (new image tags)
2. Run `helm upgrade` on store release
3. Kubernetes performs rolling update (zero downtime)

**Example**:
```bash
helm upgrade mystore ./helm/store-templates/woocommerce \
  --namespace store-mystore \
  --set wordpress.image=wordpress:6.4
```

**Rollback**:
```bash
helm rollback mystore --namespace store-mystore
```

### Database Migrations

**Challenge**: Schema changes require migrations.

**Solution**:
1. **Versioned Migrations**: Use migration tool (e.g., `node-pg-migrate`)
2. **Backward Compatibility**: Ensure old code works with new schema during rollout
3. **Blue-Green Deployment**: Run old and new versions simultaneously during migration

## Observability

### Logging

**Current**: Console logs (stdout/stderr)

**Production**:
- **Centralized Logging**: Fluentd/Fluent Bit → Elasticsearch → Kibana
- **Structured Logging**: JSON format for easy parsing
- **Log Levels**: DEBUG, INFO, WARN, ERROR

**Example**:
```javascript
console.log(JSON.stringify({
  level: 'INFO',
  timestamp: new Date().toISOString(),
  message: 'Store provisioned',
  storeId: store.id,
  duration: 180000
}));
```

### Metrics (Future)

**Prometheus Metrics**:
- `stores_total{status="ready|failed|provisioning"}` - Gauge
- `provisioning_duration_seconds` - Histogram
- `store_creation_errors_total` - Counter
- `api_requests_total{method,path,status}` - Counter

**Grafana Dashboards**:
- Store provisioning success rate
- Average provisioning time
- Resource usage per store

### Tracing (Future)

**OpenTelemetry**:
- Trace request from Dashboard → Backend → Orchestrator → Kubernetes
- Identify bottlenecks (e.g., Helm install taking 90% of time)

## Cost Optimization

### Resource Requests vs Limits

**Requests**: Guaranteed resources (used for scheduling)
**Limits**: Maximum resources (enforced by cgroup)

**Strategy**:
- Set **requests** low (200m CPU, 512Mi RAM) for efficient bin-packing
- Set **limits** high (1 CPU, 1Gi RAM) to allow bursting
- Monitor actual usage and adjust

### Storage Costs

**Local**: Free (hostPath)
**Cloud**: $0.10/GB/month (AWS EBS)

**Optimization**:
- Use `local-path` provisioner on k3s (free, but not replicated)
- Set PVC size limits (10Gi for WordPress, 10Gi for MySQL)
- Implement PVC cleanup on store deletion

### Compute Costs

**VPS Pricing** (4GB RAM, 2 vCPU):
- DigitalOcean: $24/month
- Hetzner: €4.51/month (~$5)
- Linode: $24/month

**Optimization**:
- Use spot instances (AWS/GCP) for non-production
- Horizontal pod autoscaling for platform components
- Vertical pod autoscaling for stores (adjust resources based on usage)

## Future Enhancements

### Multi-Tenancy

**Goal**: Support multiple users, each with their own stores.

**Implementation**:
1. Add `user_id` column to `stores` table
2. Add authentication (OAuth2, JWT)
3. Filter stores by `user_id` in API
4. Implement per-user quotas (max 5 stores per user)

### Custom Domains

**Goal**: Allow users to use their own domains (e.g., `shop.example.com`).

**Implementation**:
1. User provides domain and points CNAME to platform
2. Platform creates Ingress with custom domain
3. cert-manager issues certificate for custom domain

### Store Templates

**Goal**: Pre-configured stores (e.g., "Fashion Store" with theme + plugins).

**Implementation**:
1. Create Helm chart variants with different values
2. Add `template` field to store creation API
3. Orchestrator selects appropriate Helm chart based on template

### Backup/Restore

**Goal**: Users can backup and restore their stores.

**Implementation**:
1. Velero for PVC backups
2. MySQL dumps stored in S3
3. API endpoints: `POST /api/stores/:id/backup`, `POST /api/stores/:id/restore`

---

**This design balances simplicity (for MVP) with extensibility (for future growth). Key principles: idempotency, isolation, observability, and production-readiness.**
