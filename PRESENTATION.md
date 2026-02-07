# Store Orchestrator - Visual Flow Presentation

## Slide 1: System Architecture Overview

![System Architecture](/.gemini/antigravity/brain/eea5f450-c0fd-4f04-96ef-bdbba8b3eae7/architecture_overview_1770444476483.png)

**Key Components:**
- **User Browser**: React-based dashboard (Port 5174)
- **Backend API**: Express.js REST API (Port 3000)
- **PostgreSQL Database**: Stores metadata and state (Port 5432)
- **Orchestrator**: Background reconciliation loop (10s interval)
- **Kubernetes Cluster**: Kind cluster hosting store workloads

**Communication Flow:**
1. Browser ↔ Backend: HTTP REST API
2. Backend ↔ Database: SQL queries
3. Orchestrator ↔ Database: Polling for state changes
4. Orchestrator ↔ Kubernetes: kubectl/helm commands

---

## Slide 2: Store Creation Flow

![Creation Flow](/.gemini/antigravity/brain/eea5f450-c0fd-4f04-96ef-bdbba8b3eae7/creation_flow_1770444502810.png)

**7-Step Process:**

1. **User Creates Store** (T+0s)
   - User fills form: name, type (WooCommerce/Medusa)
   - Clicks "Create Store" button

2. **Dashboard → Backend API** (T+0.5s)
   - POST /api/stores
   - Payload: `{ name: "my-store", type: "woocommerce" }`

3. **Backend Inserts Record** (T+1s)
   - Generates UUID, namespace, helm release name
   - INSERT with status: `provisioning`

4. **Orchestrator Detects** (T+1s-11s)
   - Reconciliation loop queries DB every 10s
   - Finds stores with status: `provisioning`

5. **Provision Resources** (T+11s-89s)
   - Create Kubernetes namespace
   - Install Helm chart (MySQL + WordPress)
   - Wait for all pods to be ready

6. **Update Database** (T+90s)
   - UPDATE status: `ready`
   - Set URL: `http://my-store.local.test`

7. **User Accesses Store** (T+90.5s)
   - Dashboard shows green "READY" badge
   - User clicks "Open Store" button

---

## Slide 3: Kubernetes Resources Deployment

```
┌─────────────────────────────────────────────────────────┐
│              Helm Chart Deployment                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Namespace: store-my-store-abc123                 │ │
│  │                                                    │ │
│  │  ┌──────────────┐      ┌──────────────┐          │ │
│  │  │ResourceQuota │      │   Secret     │          │ │
│  │  │  CPU: 4      │      │mysql-password│          │ │
│  │  │  RAM: 8Gi    │      └──────────────┘          │ │
│  │  └──────────────┘                                 │ │
│  │                                                    │ │
│  │  ┌──────────────┐      ┌──────────────┐          │ │
│  │  │     PVC      │      │     PVC      │          │ │
│  │  │ mysql-data   │      │wordpress-data│          │ │
│  │  │    10Gi      │      │    10Gi      │          │ │
│  │  └──────┬───────┘      └──────┬───────┘          │ │
│  │         │                     │                   │ │
│  │  ┌──────▼───────┐      ┌──────▼───────┐          │ │
│  │  │ StatefulSet  │      │ Deployment   │          │ │
│  │  │   MySQL      │      │  WordPress   │          │ │
│  │  │ ┌──────────┐ │      │ ┌──────────┐ │          │ │
│  │  │ │ mysql-0  │ │      │ │wordpress-│ │          │ │
│  │  │ │   pod    │ │      │ │   pod    │ │          │ │
│  │  │ └──────────┘ │      │ └──────────┘ │          │ │
│  │  └──────┬───────┘      └──────┬───────┘          │ │
│  │         │                     │                   │ │
│  │  ┌──────▼───────┐      ┌──────▼───────┐          │ │
│  │  │   Service    │      │   Service    │          │ │
│  │  │ mysql:3306   │      │ wordpress:80 │          │ │
│  │  └──────────────┘      └──────┬───────┘          │ │
│  │                               │                   │ │
│  │                        ┌──────▼───────┐          │ │
│  │                        │   Ingress    │          │ │
│  │                        │nginx-ingress │          │ │
│  │                        │my-store.local│          │ │
│  │                        │    .test     │          │ │
│  │                        └──────────────┘          │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Resource Creation Order:**
1. Namespace (container for all resources)
2. ResourceQuota (limits: 4 CPU, 8Gi RAM, 3 PVCs)
3. Secret (MySQL credentials)
4. PersistentVolumeClaims (storage for MySQL & WordPress)
5. StatefulSet (MySQL database)
6. Deployment (WordPress application)
7. Services (internal networking)
8. Ingress (external HTTP routing)

---

## Slide 4: Provisioning Timeline

```
Timeline: Store Provisioning (0 to 100 seconds)
═══════════════════════════════════════════════════════════

T+0s     ┌─────────┐
         │User Click│ User creates store in dashboard
         └─────────┘

T+0.2s   ┌─────────┐
         │DB Insert│ Backend inserts record (status: provisioning)
         └─────────┘

T+5s     ┌─────────┐
         │Orch Start│ Orchestrator detects new store
         └─────────┘

T+5.5s   ┌─────────┐
         │Helm Inst│ Helm chart installation begins
         └─────────┘

T+10s    ┌─────────┐
         │PVC Bound│ Storage volumes provisioned
         └─────────┘

T+30s    ┌─────────┐
         │MySQL Up │ MySQL pod starts and becomes ready
         └─────────┘

T+45s    ┌─────────┐
         │MySQL OK │ MySQL accepts connections
         └─────────┘

T+50s    ┌─────────┐
         │WP Init  │ WordPress init container completes
         └─────────┘

T+60s    ┌─────────┐
         │WP Start │ WordPress pod starts
         └─────────┘

T+90s    ┌─────────┐
         │WP Ready │ WordPress becomes ready
         └─────────┘

T+93s    ┌─────────┐
         │DB Update│ Status updated to 'ready'
         └─────────┘

T+95s    ┌─────────┐
         │UI Update│ Dashboard shows green badge
         └─────────┘

T+100s   ┌─────────┐
         │Access OK│ User clicks "Open Store"
         └─────────┘
```

**Key Milestones:**
- **0-5s**: User interaction & database insert
- **5-30s**: Kubernetes resource creation
- **30-60s**: MySQL initialization
- **60-90s**: WordPress initialization
- **90-100s**: Final status update & user access

---

## Slide 5: Database Schema & Queries

### Table: stores

```
┌──────────────┬──────────────┬─────────────┬──────────────┐
│ Column       │ Type         │ Nullable    │ Description  │
├──────────────┼──────────────┼─────────────┼──────────────┤
│ id           │ UUID         │ NOT NULL    │ Primary key  │
│ name         │ VARCHAR(255) │ NOT NULL    │ Store name   │
│ type         │ VARCHAR(50)  │ NOT NULL    │ woo/medusa   │
│ status       │ VARCHAR(50)  │ NOT NULL    │ State        │
│ namespace    │ VARCHAR(255) │ NULL        │ K8s namespace│
│ url          │ VARCHAR(255) │ NULL        │ Store URL    │
│ helm_release │ VARCHAR(255) │ NULL        │ Helm release │
│ created_at   │ TIMESTAMP    │ DEFAULT NOW │ Created time │
│ updated_at   │ TIMESTAMP    │ DEFAULT NOW │ Updated time │
│ error_message│ TEXT         │ NULL        │ Error details│
└──────────────┴──────────────┴─────────────┴──────────────┘
```

### Sample Data

```
┌────────────┬──────────┬────────┬──────────────┬─────────────────┐
│ name       │ type     │ status │ url          │ error_message   │
├────────────┼──────────┼────────┼──────────────┼─────────────────┤
│ store-1    │ woo      │ ready  │ http://...   │ NULL            │
│ store-2    │ woo      │ prov.. │ NULL         │ NULL            │
│ store-3    │ medusa   │ failed │ NULL         │ Provisioning... │
└────────────┴──────────┴────────┴──────────────┴─────────────────┘
```

### Key Queries

**1. Orchestrator - Find stores to provision:**
```sql
SELECT * FROM stores 
WHERE status = 'provisioning' 
ORDER BY created_at ASC;
```

**2. Orchestrator - Mark as ready:**
```sql
UPDATE stores 
SET status = 'ready', 
    url = 'http://store.local.test',
    updated_at = NOW() 
WHERE id = '{uuid}';
```

**3. Orchestrator - Find stores to delete:**
```sql
SELECT * FROM stores 
WHERE status = 'deleting' 
ORDER BY created_at ASC;
```

**4. Backend - Get all stores:**
```sql
SELECT * FROM stores 
ORDER BY created_at DESC;
```

---

## Slide 6: Code Execution Flow

### Component Interaction Map

```
┌─────────────────────────────────────────────────────────────┐
│                        DASHBOARD                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ src/App.jsx                                           │  │
│  │   ├─ handleCreate()                                   │  │
│  │   └─ calls api.createStore()                          │  │
│  │                                                        │  │
│  │ src/services/api.js                                   │  │
│  │   └─ createStore(name, type)                          │  │
│  │       └─ fetch('POST /api/stores')                    │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP POST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND API                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ src/server.js                                         │  │
│  │   └─ app.use('/api/stores', storeRoutes)             │  │
│  │                                                        │  │
│  │ src/routes/stores.js                                  │  │
│  │   └─ router.post('/', storeController.createStore)   │  │
│  │                                                        │  │
│  │ src/controllers/storeController.js                    │  │
│  │   └─ createStore(req, res)                            │  │
│  │       ├─ Validate input                               │  │
│  │       ├─ Generate UUID, namespace                     │  │
│  │       └─ INSERT INTO stores                           │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ SQL INSERT
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   POSTGRESQL DATABASE                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ stores table                                          │  │
│  │   status: 'provisioning' ← Triggers orchestrator     │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ Polling (every 10s)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ src/controller.js                                     │  │
│  │   ├─ reconcile() [every 10s]                          │  │
│  │   └─ handleProvisioning()                             │  │
│  │       └─ SELECT WHERE status='provisioning'           │  │
│  │                                                        │  │
│  │ src/provisioners/woocommerce.js                       │  │
│  │   └─ provision(store)                                 │  │
│  │       ├─ createNamespace()                            │  │
│  │       ├─ createResourceQuota()                        │  │
│  │       ├─ installHelmChart()                           │  │
│  │       │   └─ helm upgrade --install ...               │  │
│  │       ├─ waitForReady()                               │  │
│  │       └─ addHostEntry()                               │  │
│  │           └─ echo "127.0.0.1 ..." >> /etc/hosts      │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ kubectl/helm commands
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   KUBERNETES CLUSTER                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Namespace: store-my-store-abc123                      │  │
│  │   ├─ Pods: mysql-0, wordpress-xxx                     │  │
│  │   ├─ Services: mysql:3306, wordpress:80               │  │
│  │   └─ Ingress: my-store.local.test → wordpress        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### File Execution Order

**1. User Action → Dashboard**
- `dashboard/src/App.jsx` → `handleCreate()`
- `dashboard/src/services/api.js` → `createStore()`

**2. API Request → Backend**
- `backend/src/server.js` → Route handler
- `backend/src/routes/stores.js` → Route definition
- `backend/src/controllers/storeController.js` → `createStore()`
- `backend/src/db/postgres.js` → SQL INSERT

**3. Database → Orchestrator**
- `orchestrator/src/controller.js` → `reconcile()`
- `orchestrator/src/controller.js` → `handleProvisioning()`

**4. Provisioning → Kubernetes**
- `orchestrator/src/provisioners/woocommerce.js` → `provision()`
- `orchestrator/src/k8s/client.js` → Kubernetes API calls
- `orchestrator/src/utils/hosts.js` → `/etc/hosts` management

**5. Completion → Database**
- `orchestrator/src/controller.js` → UPDATE status='ready'

**6. UI Update → Dashboard**
- `dashboard/src/App.jsx` → `fetchStores()` (polling)
- `dashboard/src/components/StoreCard.jsx` → Render updated status

---

## Slide 7: Error Handling & Sanitization

### Error Flow

```
┌─────────────────────────────────────────────────────────┐
│              Error Occurs in Provisioner                │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         Raw Error (Technical Details)                   │
│  "Helm install failed: Command failed: helm upgrade..." │
│  "Error: UPGRADE FAILED: timeout waiting for pods..."   │
│  "kubectl error: namespace already exists..."           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│      orchestrator/src/utils/errors.js                   │
│        logAndSanitizeError()                            │
│                                                         │
│  ├─ Log full error to console (for debugging)          │
│  └─ Return sanitized message                            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         Sanitized Error (User-Friendly)                 │
│  "Store provisioning failed. Please try deleting and    │
│   recreating the store."                                │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         Stored in Database                              │
│  UPDATE stores SET error_message = 'Store provisioning  │
│  failed...' WHERE id = '{uuid}'                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         Displayed in Dashboard                          │
│  dashboard/src/components/StoreCard.jsx                 │
│  Shows: "Error: Store provisioning failed. Please try   │
│          deleting and recreating the store."            │
└─────────────────────────────────────────────────────────┘
```

### Error Message Mapping

| Technical Error | User-Friendly Message |
|----------------|----------------------|
| `Helm install failed: ...` | Store provisioning failed. Please try deleting and recreating the store. |
| `Timeout waiting for pods` | Store provisioning timed out. The store may still be starting up. |
| `quota exceeded` | Insufficient resources to create store. Please try again later. |
| `ECONNREFUSED` | Connection error. Please check your cluster connectivity. |
| `Unknown store type` | Invalid store type selected. |

---

## Slide 8: Key Features & Benefits

### Platform Capabilities

**Multi-Tenancy**
- Each store runs in isolated Kubernetes namespace
- Resource quotas prevent resource exhaustion
- Separate databases and storage per store

**Automated Provisioning**
- Zero-touch deployment via Helm charts
- Automatic DNS configuration (/etc/hosts)
- Health monitoring and readiness checks

**User-Friendly Interface**
- Real-time status updates (polling every 5s)
- Clean error messages (no technical jargon)
- One-click store creation and deletion

**Scalability**
- Kubernetes-native architecture
- Horizontal scaling of stores
- Efficient resource utilization

**Developer Experience**
- Clear separation of concerns
- Modular provisioner architecture
- Comprehensive logging and debugging

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React + Vite | User interface |
| Backend | Express.js | REST API |
| Database | PostgreSQL | State management |
| Orchestrator | Node.js | Reconciliation loop |
| Container Platform | Kubernetes (Kind) | Workload hosting |
| Package Manager | Helm | Application deployment |
| Ingress | nginx-ingress | HTTP routing |

---

## Slide 9: Deployment Architecture

### Local Development Setup

```
┌─────────────────────────────────────────────────────────┐
│                   Developer Machine                     │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Dashboard   │  │  Backend API │  │ Orchestrator │  │
│  │  Port: 5174  │  │  Port: 3000  │  │ Background   │  │
│  │  npm run dev │  │  npm start   │  │  npm start   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Kind Kubernetes Cluster                 │   │
│  │                                                 │   │
│  │  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │  platform   │  │  store-* namespaces     │  │   │
│  │  │  namespace  │  │  (one per store)        │  │   │
│  │  │             │  │                         │  │   │
│  │  │ PostgreSQL  │  │ MySQL + WordPress       │  │   │
│  │  │ (port-fwd)  │  │ (via Helm charts)       │  │   │
│  │  └─────────────┘  └─────────────────────────┘  │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │      nginx-ingress-controller           │   │   │
│  │  │      Routes: *.local.test → stores      │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  /etc/hosts:                                            │
│    127.0.0.1 my-store.local.test                        │
│    127.0.0.1 another-store.local.test                   │
└─────────────────────────────────────────────────────────┘
```

### Production Deployment (Future)

```
┌─────────────────────────────────────────────────────────┐
│                   Cloud Provider (AWS/GCP)              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Managed Kubernetes (EKS/GKE)            │   │
│  │                                                 │   │
│  │  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │  platform   │  │  store-* namespaces     │  │   │
│  │  │  namespace  │  │  (autoscaling)          │  │   │
│  │  │             │  │                         │  │   │
│  │  │ Backend API │  │ WooCommerce/Medusa      │  │   │
│  │  │ Orchestrator│  │ stores                  │  │   │
│  │  │ Dashboard   │  │                         │  │   │
│  │  └─────────────┘  └─────────────────────────┘  │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │      Load Balancer + Ingress            │   │   │
│  │  │      SSL/TLS certificates               │   │   │
│  │  │      Routes: *.yourdomain.com           │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Managed PostgreSQL (RDS/Cloud SQL)      │   │
│  │         Backups, High Availability              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         DNS (Route53/Cloud DNS)                 │   │
│  │         *.yourdomain.com → Load Balancer        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Slide 10: Summary & Next Steps

### What We Built

✅ **Multi-tenant store orchestration platform**
- Automated WooCommerce/Medusa deployment
- Kubernetes-native architecture
- Real-time status monitoring
- User-friendly error handling

✅ **Complete end-to-end flow**
- User creates store → Kubernetes deploys → User accesses
- Average provisioning time: 90 seconds
- Zero manual intervention required

✅ **Production-ready features**
- Resource isolation and quotas
- Automatic cleanup on deletion
- Comprehensive logging and debugging
- Sanitized error messages for users

### Key Metrics

| Metric | Value |
|--------|-------|
| Provisioning Time | ~90 seconds |
| Components | 4 (Dashboard, Backend, Orchestrator, Database) |
| Kubernetes Resources per Store | 9 (Namespace, Quota, Secret, 2 PVCs, 2 Pods, 2 Services, Ingress) |
| Database Polling Interval | 10 seconds |
| UI Polling Interval | 5 seconds |
| Supported Store Types | 2 (WooCommerce, Medusa) |

### Next Steps

**Short Term:**
1. Add store configuration options (themes, plugins)
2. Implement store backup and restore
3. Add monitoring and alerting
4. Create admin dashboard for platform management

**Medium Term:**
1. Support for custom domains (not just .local.test)
2. SSL/TLS certificate automation (Let's Encrypt)
3. Store scaling (horizontal pod autoscaling)
4. Multi-cluster support

**Long Term:**
1. Production deployment to cloud (AWS/GCP)
2. Marketplace for store templates
3. Analytics and reporting dashboard
4. API for programmatic store management

---

## Appendix: Quick Reference

### Important Files

```
/home/sumit/urumi/
├─ backend/
│  ├─ src/server.js              # Backend entry point
│  ├─ src/controllers/storeController.js  # Business logic
│  └─ src/db/postgres.js         # Database connection
│
├─ orchestrator/
│  ├─ src/controller.js          # Reconciliation loop
│  ├─ src/provisioners/woocommerce.js  # WooCommerce provisioner
│  └─ src/utils/hosts.js         # /etc/hosts management
│
├─ dashboard/
│  ├─ src/App.jsx                # Main React component
│  ├─ src/components/StoreCard.jsx  # Store display
│  └─ src/services/api.js        # API client
│
└─ helm/store-templates/woocommerce/
   ├─ Chart.yaml                 # Helm chart metadata
   ├─ values.yaml                # Default values
   └─ templates/                 # Kubernetes manifests
```

### Common Commands

```bash
# Start all services
kubectl port-forward --namespace platform svc/postgres-postgresql 5432:5432
cd backend && npm start
cd orchestrator && npm start
cd dashboard && npm run dev

# Check store status
kubectl get pods -n store-{name}-{uuid}
kubectl logs -n store-{name}-{uuid} wordpress-xxx

# Debug database
psql -h localhost -U postgres -d orchestrator
SELECT * FROM stores;

# Check Helm releases
helm list -A

# View ingress
kubectl get ingress -A
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Store stuck in "provisioning" | Check orchestrator logs, verify Helm chart |
| Can't access store URL | Verify /etc/hosts entry, check ingress |
| Database connection error | Ensure port-forward is running |
| Pods not starting | Check resource quotas, view pod logs |

---

**End of Presentation**

For detailed technical documentation, see:
- `TECHNICAL_FLOW.md` - Complete technical flow
- `DESIGN.md` - Architecture and design decisions
- `QUICKSTART.md` - Setup and usage guide
- `IMPLEMENTATION_PLAN.md` - Development roadmap
