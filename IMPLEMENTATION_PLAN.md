---
title: Kubernetes Store Orchestration - Implementation Plan
created: 2026-02-06
status: draft
---

# Implementation Plan: Kubernetes Store Orchestration Platform

## Project Overview

Build a multi-tenant SaaS platform that automatically provisions isolated e-commerce stores (WooCommerce/MedusaJS) on Kubernetes, deployable locally (Kind/k3d) and production (k3s on VPS).

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     Platform Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────┐│
│  │Dashboard │→ │ Backend  │→ │Orchestrator │→ │PostgreSQL││
│  │ (React)  │  │   API    │  │(Controller) │  │          ││
│  └──────────┘  └──────────┘  └─────────────┘  └──────────┘│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Store Layer (Tenants)                   │
│  ┌────────────────────┐      ┌────────────────────┐        │
│  │ Namespace: store-1 │      │ Namespace: store-2 │        │
│  │ ┌────────────────┐ │      │ ┌────────────────┐ │        │
│  │ │  WooCommerce   │ │      │ │    MedusaJS    │ │        │
│  │ │  + WordPress   │ │      │ │  + Storefront  │ │        │
│  │ │  + MySQL       │ │      │ │  + PostgreSQL  │ │        │
│  │ └────────────────┘ │      │ │  + Redis       │ │        │
│  └────────────────────┘      │ └────────────────┘ │        │
│                               └────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Platform Components
- **Dashboard**: React + Vite + Tailwind CSS
- **Backend API**: Node.js + Express + PostgreSQL
- **Orchestrator**: Node.js + @kubernetes/client-node
- **Packaging**: Helm 3
- **Ingress**: nginx-ingress-controller
- **Local K8s**: Kind or k3d
- **Production K8s**: k3s on VPS

### Store Engines
- **WooCommerce**: WordPress + MySQL + WooCommerce plugin
- **MedusaJS**: Medusa backend + Next.js storefront + PostgreSQL + Redis

---

## Phase 1: Foundation & Local Setup (Days 1-3)

### 1.1 Project Initialization
**Goal**: Set up project structure and development environment

**Tasks**:
- [ ] Create folder structure
- [ ] Initialize Git repository
- [ ] Set up Kind cluster with nginx-ingress
- [ ] Configure local DNS (*.local.dev → 127.0.0.1)

**Deliverables**:
```
urumi/
├── dashboard/
├── backend/
├── orchestrator/
├── helm/
│   ├── platform/
│   └── store-templates/
├── scripts/
└── docs/
```

**Commands**:
```bash
# Create Kind cluster with ingress
kind create cluster --config kind-config.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Setup local DNS
echo "127.0.0.1 dashboard.local.dev" | sudo tee -a /etc/hosts
```

---

### 1.2 Backend API Development
**Goal**: REST API for store management with PostgreSQL

**Database Schema**:
```sql
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'woocommerce' or 'medusa'
    status VARCHAR(50) NOT NULL, -- 'provisioning', 'ready', 'failed'
    namespace VARCHAR(255) UNIQUE NOT NULL,
    url VARCHAR(255),
    helm_release VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    error_message TEXT
);

CREATE INDEX idx_stores_status ON stores(status);
CREATE INDEX idx_stores_namespace ON stores(namespace);
```

**API Endpoints**:
```
GET    /api/stores          - List all stores
POST   /api/stores          - Create new store
GET    /api/stores/:id      - Get store details
DELETE /api/stores/:id      - Delete store
GET    /api/health          - Health check
```

**Request/Response Examples**:
```json
// POST /api/stores
{
  "name": "my-store",
  "type": "woocommerce"
}

// Response
{
  "id": "abc-123",
  "name": "my-store",
  "type": "woocommerce",
  "status": "provisioning",
  "namespace": "store-abc-123",
  "url": null,
  "created_at": "2026-02-06T21:38:00Z"
}
```

**Implementation**:
- Express.js server
- PostgreSQL with `pg` library
- Input validation with `joi`
- Error handling middleware
- Dockerized for Kubernetes deployment

---

### 1.3 Dashboard Development
**Goal**: React UI for store management

**Features**:
- Store list with status badges (Provisioning/Ready/Failed)
- Create store modal (name input + type selector)
- Delete confirmation dialog
- Auto-refresh every 5 seconds for status updates
- Responsive design with Tailwind CSS

**Key Components**:
```
src/
├── components/
│   ├── StoreList.jsx       - Main list view
│   ├── StoreCard.jsx       - Individual store card
│   ├── CreateStoreModal.jsx - Creation form
│   └── DeleteConfirm.jsx   - Delete confirmation
├── services/
│   └── api.js              - API client
├── hooks/
│   └── useStores.js        - Store management hook
└── App.jsx
```

**Status Badge Colors**:
- Provisioning: Yellow/Orange (animated pulse)
- Ready: Green
- Failed: Red

---

### 1.4 Orchestrator Development
**Goal**: Kubernetes controller that provisions stores

**Core Logic**:
```javascript
// Reconciliation loop
async function reconcile() {
  // 1. Get stores with status='provisioning'
  const stores = await getProvisioningStores();
  
  for (const store of stores) {
    try {
      // 2. Create namespace with ResourceQuota
      await createNamespace(store);
      
      // 3. Install Helm chart
      await installStoreChart(store);
      
      // 4. Wait for pods to be ready
      await waitForReady(store);
      
      // 5. Update status to 'ready'
      await updateStoreStatus(store.id, 'ready', url);
    } catch (error) {
      await updateStoreStatus(store.id, 'failed', null, error.message);
    }
  }
}

// Run every 10 seconds
setInterval(reconcile, 10000);
```

**Idempotency Strategy**:
- Check if namespace exists before creating
- Use Helm's `helm status` to check if release exists
- Use `helm upgrade --install` for idempotent installs
- Store Helm release name in database

**Cleanup on Delete**:
```javascript
async function deleteStore(storeId) {
  const store = await getStore(storeId);
  
  // 1. Uninstall Helm release
  await helmUninstall(store.helm_release, store.namespace);
  
  // 2. Delete namespace (cascades to all resources)
  await deleteNamespace(store.namespace);
  
  // 3. Delete from database
  await deleteStoreRecord(storeId);
}
```

**Timeout Handling**:
- Max provisioning time: 10 minutes
- If exceeded, mark as 'failed' with timeout error

---

## Phase 2: WooCommerce Implementation (Days 2-3)

### 2.1 WooCommerce Helm Chart
**Goal**: Helm chart for WooCommerce store

**Chart Structure**:
```
helm/store-templates/woocommerce/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── namespace.yaml
    ├── resourcequota.yaml
    ├── wordpress-deployment.yaml
    ├── mysql-statefulset.yaml
    ├── wordpress-pvc.yaml
    ├── mysql-pvc.yaml
    ├── wordpress-service.yaml
    ├── mysql-service.yaml
    ├── ingress.yaml
    └── secrets.yaml
```

**Key Resources**:

**MySQL StatefulSet**:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql
  replicas: 1
  template:
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: root-password
        - name: MYSQL_DATABASE
          value: wordpress
        volumeMounts:
        - name: mysql-data
          mountPath: /var/lib/mysql
        livenessProbe:
          exec:
            command: ["mysqladmin", "ping"]
          initialDelaySeconds: 30
        readinessProbe:
          exec:
            command: ["mysqladmin", "ping"]
          initialDelaySeconds: 10
  volumeClaimTemplates:
  - metadata:
      name: mysql-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

**WordPress Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wordpress
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: wordpress
        image: wordpress:latest
        env:
        - name: WORDPRESS_DB_HOST
          value: mysql:3306
        - name: WORDPRESS_DB_NAME
          value: wordpress
        - name: WORDPRESS_DB_USER
          value: root
        - name: WORDPRESS_DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: root-password
        ports:
        - containerPort: 80
        volumeMounts:
        - name: wordpress-data
          mountPath: /var/www/html
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
      volumes:
      - name: wordpress-data
        persistentVolumeClaim:
          claimName: wordpress-pvc
```

**Ingress**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wordpress-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: {{ .Values.storeName }}.{{ .Values.domain }}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wordpress
            port:
              number: 80
```

**ResourceQuota**:
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: store-quota
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 4Gi
    limits.cpu: "4"
    limits.memory: 8Gi
    persistentvolumeclaims: "3"
```

### 2.2 WooCommerce Auto-Setup
**Goal**: Automatically install WooCommerce plugin

**Approach**: Use Kubernetes Job with WP-CLI

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: woocommerce-setup
spec:
  template:
    spec:
      containers:
      - name: wp-cli
        image: wordpress:cli
        command:
        - /bin/sh
        - -c
        - |
          # Wait for WordPress to be ready
          while ! wp core is-installed --allow-root; do
            sleep 5
          done
          
          # Install WooCommerce
          wp plugin install woocommerce --activate --allow-root
          
          # Create sample products
          wp wc product create \
            --name="Sample Product" \
            --regular_price=19.99 \
            --allow-root
      restartPolicy: OnFailure
```

---

## Phase 3: Platform Helm Chart (Day 3)

### 3.1 Platform Chart Structure
```
helm/platform/
├── Chart.yaml
├── values.yaml
├── values-local.yaml
├── values-prod.yaml
└── templates/
    ├── namespace.yaml
    ├── postgres-statefulset.yaml
    ├── postgres-service.yaml
    ├── postgres-pvc.yaml
    ├── backend-deployment.yaml
    ├── backend-service.yaml
    ├── orchestrator-deployment.yaml
    ├── dashboard-deployment.yaml
    ├── dashboard-service.yaml
    ├── ingress.yaml
    ├── rbac.yaml
    └── secrets.yaml
```

### 3.2 RBAC for Orchestrator
**Goal**: Least-privilege access for orchestrator

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: orchestrator
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: orchestrator-role
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
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["resourcequotas"]
  verbs: ["create", "get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: orchestrator-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: orchestrator-role
subjects:
- kind: ServiceAccount
  name: orchestrator
  namespace: platform
```

### 3.3 Values Files

**values-local.yaml**:
```yaml
environment: local

domain: local.dev

ingress:
  enabled: true
  className: nginx
  tls:
    enabled: false

postgres:
  persistence:
    size: 5Gi
    storageClass: standard

resources:
  backend:
    limits:
      cpu: 500m
      memory: 512Mi
  orchestrator:
    limits:
      cpu: 500m
      memory: 512Mi
  dashboard:
    limits:
      cpu: 200m
      memory: 256Mi

storeDefaults:
  storageClass: standard
  resourceQuota:
    cpu: "2"
    memory: 4Gi
```

**values-prod.yaml**:
```yaml
environment: production

domain: yourdomain.com

ingress:
  enabled: true
  className: nginx
  tls:
    enabled: true
    certManager: true

postgres:
  persistence:
    size: 20Gi
    storageClass: local-path

resources:
  backend:
    limits:
      cpu: 2000m
      memory: 2Gi
  orchestrator:
    limits:
      cpu: 1000m
      memory: 1Gi
  dashboard:
    limits:
      cpu: 500m
      memory: 512Mi

storeDefaults:
  storageClass: local-path
  resourceQuota:
    cpu: "4"
    memory: 8Gi
```

---

## Phase 4: Testing & Validation (Day 4)

### 4.1 End-to-End Test: WooCommerce
**Goal**: Verify complete order flow

**Test Steps**:
1. Open dashboard at `http://dashboard.local.dev`
2. Click "Create New Store"
3. Enter name: "test-woo", select "WooCommerce"
4. Wait for status to change to "Ready" (~3-5 minutes)
5. Click store URL: `http://test-woo.local.dev`
6. Add product to cart
7. Proceed to checkout
8. Select "Cash on Delivery"
9. Place order
10. Verify order in WooCommerce admin: `http://test-woo.local.dev/wp-admin`

**Success Criteria**:
- Store provisions without errors
- Storefront loads correctly
- Order completes successfully
- Order visible in admin panel

### 4.2 Idempotency Test
**Goal**: Verify retry safety

**Test Steps**:
1. Create store
2. Kill orchestrator pod during provisioning
3. Restart orchestrator
4. Verify store completes provisioning without duplicates

### 4.3 Cleanup Test
**Goal**: Verify complete resource deletion

**Test Steps**:
1. Create store
2. Delete store from dashboard
3. Verify namespace is deleted: `kubectl get ns`
4. Verify PVCs are deleted: `kubectl get pvc -A`
5. Verify Helm release is gone: `helm list -A`

---

## Phase 5: Production Deployment (Day 5)

### 5.1 VPS Setup (k3s)
**Goal**: Deploy on production VPS

**Requirements**:
- VPS with 4GB+ RAM (DigitalOcean, Hetzner, Linode)
- Ubuntu 22.04
- Public IP address
- Domain name with wildcard DNS

**Setup Steps**:
```bash
# Install k3s
curl -sfL https://get.k3s.io | sh -

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Configure DNS
# Add A record: *.yourdomain.com → VPS_IP
```

### 5.2 TLS with cert-manager
**Goal**: Automatic HTTPS certificates

**ClusterIssuer**:
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

**Update Ingress**:
```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-prod
tls:
- hosts:
  - "*.yourdomain.com"
  secretName: wildcard-tls
```

### 5.3 Deploy Platform
```bash
# Build and push Docker images
docker build -t yourregistry/dashboard:v1 ./dashboard
docker build -t yourregistry/backend:v1 ./backend
docker build -t yourregistry/orchestrator:v1 ./orchestrator
docker push yourregistry/dashboard:v1
docker push yourregistry/backend:v1
docker push yourregistry/orchestrator:v1

# Install platform
helm install platform ./helm/platform \
  -f ./helm/platform/values-prod.yaml \
  --set image.registry=yourregistry \
  --set domain=yourdomain.com \
  --create-namespace \
  --namespace platform
```

---

## Phase 6: Enhancements (Days 6-7)

### 6.1 MedusaJS Implementation
**Goal**: Add second store engine

**Helm Chart**: Similar to WooCommerce but with:
- Medusa backend deployment
- Next.js storefront deployment
- PostgreSQL StatefulSet
- Redis deployment

**Test**: Complete checkout flow with Medusa storefront

### 6.2 Observability
**Goal**: Monitoring and logging

**Metrics** (Prometheus):
- `stores_total{status="ready|failed|provisioning"}`
- `provisioning_duration_seconds`
- `store_creation_errors_total`

**Logs**:
- Structured JSON logging in all components
- Store provisioning events in database

**Dashboard Enhancement**:
- Show provisioning logs in UI
- Display error messages for failed stores

### 6.3 Abuse Prevention
**Goal**: Prevent resource exhaustion

**Features**:
- Max 5 stores per user (configurable)
- Provisioning timeout: 10 minutes
- Rate limiting: 1 store creation per minute per user
- Audit log table:
```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    action VARCHAR(50), -- 'create', 'delete'
    store_id UUID,
    timestamp TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR(45)
);
```

### 6.4 Network Policies
**Goal**: Network isolation between stores

**Default Deny**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

**Allow Ingress from nginx**:
```yaml
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

---

## Documentation Deliverables

### README.md Structure
```markdown
# Kubernetes Store Orchestration Platform

## Quick Start (Local)
1. Prerequisites
2. Setup Kind cluster
3. Deploy platform
4. Create first store
5. Place test order

## Production Deployment
1. VPS requirements
2. k3s installation
3. DNS configuration
4. Deploy with Helm
5. TLS setup

## Architecture
- High-level diagram
- Component descriptions
- Data flow

## API Reference
- Endpoint documentation
- Request/response examples

## Troubleshooting
- Common issues
- Debug commands
```

### DESIGN.md Structure
```markdown
# System Design & Tradeoffs

## Architecture Decisions
1. Namespace-per-store isolation (why)
2. Helm for packaging (vs Kustomize)
3. Node.js orchestrator (vs Go operator)
4. PostgreSQL for metadata (vs CRDs)

## Idempotency & Failure Handling
- Retry logic
- Helm atomic installs
- Timeout handling
- Cleanup guarantees

## Production Differences
- Storage classes
- Resource limits
- TLS/cert-manager
- Secret management
- DNS configuration

## Scaling Considerations
- Horizontal scaling of orchestrator
- Database connection pooling
- Concurrency controls

## Security
- RBAC
- Network policies
- Secret management
- Non-root containers
```

---

## Success Criteria Checklist

### Must Have (Definition of Done)
- [ ] WooCommerce store can be provisioned
- [ ] End-to-end order placement works
- [ ] Store deletion cleans up all resources
- [ ] Runs on local Kind cluster
- [ ] Deployable to k3s VPS with same Helm charts
- [ ] README with setup instructions
- [ ] DESIGN.md with architecture explanation

### Strong Differentiators
- [ ] Production VPS deployment documented
- [ ] TLS with cert-manager working
- [ ] ResourceQuotas per store namespace
- [ ] Idempotent provisioning (retry-safe)
- [ ] Provisioning timeout (10 min)
- [ ] Per-user store quotas
- [ ] Observability (logs in dashboard)

### Advanced (Optional)
- [ ] MedusaJS implementation
- [ ] NetworkPolicies
- [ ] Audit logs
- [ ] Prometheus metrics
- [ ] Horizontal scaling for orchestrator

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Foundation | Day 1 | Project structure, Kind cluster, basic API |
| 2. WooCommerce | Days 2-3 | Working WooCommerce provisioning |
| 3. Platform Chart | Day 3 | Helm chart for platform |
| 4. Testing | Day 4 | E2E tests passing |
| 5. Production | Day 5 | VPS deployment working |
| 6. Enhancements | Days 6-7 | MedusaJS, observability, security |
| 7. Documentation | Day 7 | README, DESIGN.md complete |

**Total**: 7 days for complete implementation

---

## Next Steps

1. Review this plan
2. Confirm approach and priorities
3. Begin Phase 1: Project initialization
4. Iterate based on testing feedback

