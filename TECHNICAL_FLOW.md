# Store Orchestrator - Complete Technical Flow

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Component Startup Flow](#component-startup-flow)
3. [Store Creation Flow (End-to-End)](#store-creation-flow-end-to-end)
4. [Store Deletion Flow](#store-deletion-flow)
5. [File-by-File Execution Map](#file-by-file-execution-map)
6. [Database Schema & Queries](#database-schema--queries)
7. [Kubernetes Resources Flow](#kubernetes-resources-flow)

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                     http://localhost:5174                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (React + Vite)                      │
│  Files: dashboard/src/App.jsx, StoreCard.jsx, api.js           │
│  Port: 5174                                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP REST API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Express.js)                      │
│  Files: backend/src/server.js, routes/stores.js                │
│  Port: 3000                                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ SQL Queries
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                           │
│  Table: stores                                                   │
│  Port: 5432 (port-forwarded from Kubernetes)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ Polling (every 10s)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Node.js)                        │
│  Files: orchestrator/src/controller.js, provisioners/*.js      │
│  No port (background process)                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ kubectl/helm commands
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    KUBERNETES CLUSTER (Kind)                     │
│  - Namespaces: platform, store-*                                │
│  - Resources: Pods, Services, Ingress, PVCs                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Startup Flow

### 1. PostgreSQL (Kubernetes)
**File**: N/A (Deployed via Helm)
**Command**: `kubectl port-forward --namespace platform svc/postgres-postgresql 5432:5432`

```
1. PostgreSQL pod starts in Kubernetes
2. Port-forward exposes it to localhost:5432
3. Database 'orchestrator' is created
4. Table 'stores' is ready for connections
```

---

### 2. Backend API Startup
**Entry Point**: `backend/src/server.js`

```javascript
// Execution Flow:
backend/src/server.js
  ├─ Line 1-10: Import dependencies (express, cors, dotenv)
  ├─ Line 12-16: Load environment variables from .env
  │   └─ Reads: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, PORT
  │
  ├─ Line 18-25: Import database and routes
  │   ├─ backend/src/db/postgres.js
  │   │   ├─ Line 1-15: Create PostgreSQL connection pool
  │   │   ├─ Line 17-30: initDatabase() function
  │   │   │   ├─ Connects to PostgreSQL
  │   │   │   ├─ Creates 'stores' table if not exists
  │   │   │   └─ Returns pool object
  │   │   └─ Exports: pool, initDatabase
  │   │
  │   └─ backend/src/routes/stores.js
  │       ├─ Line 1-5: Import express.Router and controller
  │       ├─ Line 7-11: Define routes
  │       │   ├─ GET /api/stores → storeController.getAllStores
  │       │   ├─ POST /api/stores → storeController.createStore
  │       │   └─ DELETE /api/stores/:id → storeController.deleteStore
  │       └─ Exports: router
  │
  ├─ Line 27-35: Initialize Express app
  │   ├─ app.use(cors()) - Allow cross-origin requests
  │   ├─ app.use(express.json()) - Parse JSON bodies
  │   └─ app.use('/api/stores', storeRoutes) - Mount routes
  │
  ├─ Line 37-45: start() async function
  │   ├─ await initDatabase() - Initialize DB and create table
  │   ├─ app.listen(PORT) - Start HTTP server on port 3000
  │   └─ console.log('🚀 Backend API running on port 3000')
  │
  └─ Line 47: start() - Execute startup
```

**Console Output**:
```
✅ Database schema initialized
🚀 Backend API running on port 3000
📊 Health check: http://localhost:3000/api/health
```

---

### 3. Orchestrator Startup
**Entry Point**: `orchestrator/src/controller.js`

```javascript
// Execution Flow:
orchestrator/src/controller.js
  ├─ Line 1-5: Import dependencies
  │   ├─ pg (PostgreSQL client)
  │   ├─ dotenv (environment variables)
  │   ├─ WooCommerceProvisioner
  │   ├─ MedusaProvisioner
  │   └─ logAndSanitizeError
  │
  ├─ Line 6: dotenv.config() - Load .env file
  │
  ├─ Line 10-16: Create PostgreSQL connection pool
  │   └─ Connects to same database as backend
  │
  ├─ Line 18-19: Load configuration
  │   ├─ DOMAIN = 'local.test'
  │   └─ RECONCILE_INTERVAL = 10000 (10 seconds)
  │
  ├─ Line 21-24: Initialize provisioners
  │   ├─ provisioners.woocommerce = new WooCommerceProvisioner(DOMAIN)
  │   └─ provisioners.medusa = new MedusaProvisioner(DOMAIN)
  │
  ├─ Line 26-154: Orchestrator class definition
  │   ├─ constructor() - Sets isReconciling = false
  │   ├─ reconcile() - Main reconciliation loop
  │   ├─ handleProvisioning() - Provisions stores
  │   ├─ handleDeletion() - Deletes stores
  │   └─ start() - Starts the orchestrator
  │
  ├─ Line 157-158: Create and start orchestrator
  │   ├─ const orchestrator = new Orchestrator()
  │   └─ orchestrator.start()
  │       ├─ Logs startup message
  │       ├─ setInterval(reconcile, 10000) - Start 10s loop
  │       └─ reconcile() - Run immediately
  │
  └─ Line 160-165: Graceful shutdown handler
```

**Console Output**:
```
🧠 Orchestrator starting...
📡 Domain: local.test
⏱️  Reconcile interval: 10000ms
🔄 Starting reconciliation at 2026-02-07T05:24:16.347Z
```

---

### 4. Dashboard Startup
**Entry Point**: `dashboard/index.html` → `dashboard/src/main.jsx`

```javascript
// Execution Flow:
dashboard/index.html
  └─ Line 13: <script type="module" src="/src/main.jsx">
      │
      └─ dashboard/src/main.jsx
          ├─ Line 1-4: Import React, ReactDOM, App, CSS
          ├─ Line 6-10: Render App component
          │   └─ ReactDOM.createRoot(document.getElementById('root'))
          │       └─ <App />
          │
          └─ dashboard/src/App.jsx
              ├─ Line 1-5: Import React hooks and components
              ├─ Line 7-15: State initialization
              │   ├─ stores = [] (list of stores)
              │   ├─ loading = true
              │   ├─ error = null
              │   └─ showCreateModal = false
              │
              ├─ Line 17-30: useEffect() - Fetch stores on mount
              │   ├─ fetchStores() called
              │   └─ setInterval(fetchStores, 5000) - Poll every 5s
              │
              ├─ Line 32-45: fetchStores() function
              │   └─ dashboard/src/services/api.js
              │       ├─ Line 1: const API_BASE_URL = 'http://localhost:3000/api'
              │       ├─ Line 3-10: getStores() function
              │       │   ├─ fetch(`${API_BASE_URL}/stores`)
              │       │   ├─ response.json()
              │       │   └─ return data.data (array of stores)
              │       │
              │       ├─ Line 12-20: createStore(name, type) function
              │       └─ Line 22-30: deleteStore(id) function
              │
              └─ Line 50-100: Render UI
                  ├─ Header with "Create New Store" button
                  ├─ Store cards grid
                  │   └─ dashboard/src/components/StoreCard.jsx
                  │       ├─ Shows store name, type, status
                  │       ├─ Shows URL (if ready)
                  │       ├─ Shows sanitized error (if failed)
                  │       └─ "Open Store" and "Delete" buttons
                  │
                  └─ CreateStoreModal (if showCreateModal)
```

**Browser Output**:
```
Dashboard loads at http://localhost:5174
Fetches stores from backend API
Displays store cards with real-time status updates
```

---

## Store Creation Flow (End-to-End)

### Phase 1: User Clicks "Create New Store"

```
USER ACTION: Click "+ Create New Store" button
  │
  ├─ dashboard/src/App.jsx
  │   └─ Line 85: onClick={() => setShowCreateModal(true)}
  │       └─ State: showCreateModal = true
  │           └─ Renders: <CreateStoreModal />
  │
  └─ dashboard/src/components/CreateStoreModal.jsx
      ├─ Line 1-20: Component renders
      ├─ User fills in:
      │   ├─ Store Name: "my-awesome-store"
      │   └─ Store Type: "woocommerce"
      │
      └─ Line 40: onClick={handleCreate}
```

---

### Phase 2: Form Submission to Backend

```
USER ACTION: Click "Create Store" button
  │
  ├─ dashboard/src/components/CreateStoreModal.jsx
  │   └─ Line 15-30: handleCreate() function
  │       ├─ Validates input (name is alphanumeric + hyphens)
  │       ├─ Calls: await createStore(storeName, storeType)
  │       │
  │       └─ dashboard/src/services/api.js
  │           └─ Line 12-20: createStore(name, type)
  │               ├─ fetch('http://localhost:3000/api/stores', {
  │               │   method: 'POST',
  │               │   headers: { 'Content-Type': 'application/json' },
  │               │   body: JSON.stringify({ name, type })
  │               │ })
  │               └─ Returns: response.json()
  │
  └─ HTTP POST → Backend API
```

**HTTP Request**:
```http
POST http://localhost:3000/api/stores
Content-Type: application/json

{
  "name": "my-awesome-store",
  "type": "woocommerce"
}
```

---

### Phase 3: Backend Processes Request

```
BACKEND RECEIVES: POST /api/stores
  │
  ├─ backend/src/server.js
  │   └─ Line 34: app.use('/api/stores', storeRoutes)
  │       │
  │       └─ backend/src/routes/stores.js
  │           └─ Line 8: router.post('/', storeController.createStore)
  │               │
  │               └─ backend/src/controllers/storeController.js
  │                   └─ Line 20-60: createStore(req, res)
  │                       │
  │                       ├─ Line 21-22: Extract name and type from req.body
  │                       │   ├─ name = "my-awesome-store"
  │                       │   └─ type = "woocommerce"
  │                       │
  │                       ├─ Line 24-30: Validate input
  │                       │   ├─ Check name is alphanumeric + hyphens
  │                       │   ├─ Check type is 'woocommerce' or 'medusa'
  │                       │   └─ Return 400 if invalid
  │                       │
  │                       ├─ Line 32-35: Generate unique identifiers
  │                       │   ├─ id = crypto.randomUUID()
  │                       │   │   → "d226a6cc-c50b-4d4d-9e3d-ec3a6841b90b"
  │                       │   ├─ namespace = `store-${name}-${id.substring(0, 8)}`
  │                       │   │   → "store-my-awesome-store-d226a6cc"
  │                       │   └─ helmRelease = name
  │                       │       → "my-awesome-store"
  │                       │
  │                       ├─ Line 37-50: Insert into database
  │                       │   └─ SQL Query:
  │                       │       INSERT INTO stores (
  │                       │         id, name, type, status, namespace, helm_release
  │                       │       ) VALUES (
  │                       │         'd226a6cc-...', 
  │                       │         'my-awesome-store',
  │                       │         'woocommerce',
  │                       │         'provisioning',
  │                       │         'store-my-awesome-store-d226a6cc',
  │                       │         'my-awesome-store'
  │                       │       )
  │                       │
  │                       └─ Line 52-58: Return response
  │                           └─ res.status(201).json({
  │                                 success: true,
  │                                 data: { id, name, type, status, ... }
  │                               })
```

**Database State After Insert**:
```sql
SELECT * FROM stores WHERE name = 'my-awesome-store';

id                  | d226a6cc-c50b-4d4d-9e3d-ec3a6841b90b
name                | my-awesome-store
type                | woocommerce
status              | provisioning  ← IMPORTANT: Orchestrator watches this
namespace           | store-my-awesome-store-d226a6cc
url                 | NULL
helm_release        | my-awesome-store
created_at          | 2026-02-07 12:08:33.997
updated_at          | 2026-02-07 12:08:33.997
error_message       | NULL
```

---

### Phase 4: Orchestrator Detects New Store

```
ORCHESTRATOR RECONCILIATION LOOP (runs every 10 seconds)
  │
  ├─ orchestrator/src/controller.js
  │   └─ Line 149: setInterval(() => this.reconcile(), 10000)
  │       │
  │       └─ Line 31-52: reconcile() function
  │           ├─ Line 32-35: Check if already reconciling
  │           │   └─ if (this.isReconciling) return; // Skip
  │           │
  │           ├─ Line 37: this.isReconciling = true
  │           ├─ Line 38: console.log('🔄 Starting reconciliation...')
  │           │
  │           ├─ Line 42: await this.handleProvisioning()
  │           │   │
  │           │   └─ Line 54-98: handleProvisioning() function
  │           │       │
  │           │       ├─ Line 55-57: Query database
  │           │       │   └─ SQL:
  │           │       │       SELECT * FROM stores 
  │           │       │       WHERE status = 'provisioning'
  │           │       │       ORDER BY created_at ASC
  │           │       │
  │           │       ├─ Line 59-62: Check if any stores found
  │           │       │   └─ stores.length = 1 (our new store!)
  │           │       │
  │           │       └─ Line 66-97: Loop through stores
  │           │           └─ For store "my-awesome-store":
  │           │               │
  │           │               ├─ Line 68: console.log('🚀 Provisioning...')
  │           │               │
  │           │               ├─ Line 70-73: Get provisioner
  │           │               │   └─ provisioner = provisioners['woocommerce']
  │           │               │       → WooCommerceProvisioner instance
  │           │               │
  │           │               └─ Line 75: result = await provisioner.provision(store)
  │           │                   │
  │           │                   └─ CONTINUE TO PHASE 5 ↓
  │           │
  │           ├─ Line 45: await this.handleDeletion()
  │           └─ Line 50: this.isReconciling = false
```

---

### Phase 5: WooCommerce Provisioner Executes

```
PROVISIONER: WooCommerceProvisioner.provision(store)
  │
  └─ orchestrator/src/provisioners/woocommerce.js
      └─ Line 13-42: provision(store) function
          │
          ├─ Line 14: console.log('📦 Provisioning WooCommerce store...')
          │
          ├─ STEP 1: Create Namespace
          │   └─ Line 17-19: await this.createNamespace(store.namespace)
          │       │
          │       └─ Line 44-62: createNamespace(namespace) function
          │           ├─ Line 46-54: Call Kubernetes API
          │           │   └─ orchestrator/src/k8s/client.js
          │           │       ├─ Line 1-5: Import @kubernetes/client-node
          │           │       ├─ Line 7-10: Load kubeconfig
          │           │       │   └─ kc.loadFromDefault()
          │           │       ├─ Line 12-15: Create API clients
          │           │       │   ├─ k8sApi = kc.makeApiClient(CoreV1Api)
          │           │       │   └─ k8sAppsApi = kc.makeApiClient(AppsV1Api)
          │           │       └─ Exports: k8sApi, k8sAppsApi
          │           │
          │           ├─ Executes: k8sApi.createNamespace({
          │           │   metadata: {
          │           │     name: 'store-my-awesome-store-d226a6cc',
          │           │     labels: {
          │           │       'app': 'store-orchestrator',
          │           │       'managed-by': 'orchestrator'
          │           │     }
          │           │   }
          │           │ })
          │           │
          │           └─ Line 56-60: Handle 409 (already exists)
          │               └─ console.log('⚠️ Namespace already exists')
          │
          ├─ STEP 2: Create ResourceQuota
          │   └─ Line 21-23: await this.createResourceQuota(namespace)
          │       │
          │       └─ Line 64-90: createResourceQuota(namespace) function
          │           ├─ Line 65-79: Define quota object
          │           │   └─ spec.hard:
          │           │       ├─ requests.cpu: '2'
          │           │       ├─ requests.memory: '4Gi'
          │           │       ├─ limits.cpu: '4'
          │           │       ├─ limits.memory: '8Gi'
          │           │       └─ persistentvolumeclaims: '3'
          │           │
          │           └─ Line 82: k8sApi.createNamespacedResourceQuota(namespace, quota)
          │
          ├─ STEP 3: Install Helm Chart
          │   └─ Line 25-27: await this.installHelmChart(store)
          │       │
          │       └─ Line 92-111: installHelmChart(store) function
          │           ├─ Line 93-100: Build helm command
          │           │   └─ Command:
          │           │       helm upgrade --install my-awesome-store \
          │           │         /home/sumit/urumi/helm/store-templates/woocommerce \
          │           │         --namespace store-my-awesome-store-d226a6cc \
          │           │         --set storeName=my-awesome-store \
          │           │         --set domain=local.test \
          │           │         --create-namespace \
          │           │         --atomic \
          │           │         --timeout 10m \
          │           │         --wait
          │           │
          │           ├─ Line 103: execAsync(helmCommand)
          │           │   │
          │           │   └─ Helm Chart Execution:
          │           │       └─ helm/store-templates/woocommerce/
          │           │           ├─ Chart.yaml (metadata)
          │           │           ├─ values.yaml (default values)
          │           │           └─ templates/
          │           │               ├─ secrets.yaml
          │           │               │   └─ Creates: mysql-secret
          │           │               │       ├─ root-password: <random>
          │           │               │       └─ database: wordpress
          │           │               │
          │           │               ├─ mysql-statefulset.yaml
          │           │               │   └─ Creates: StatefulSet/mysql
          │           │               │       ├─ Image: mysql:8.0
          │           │               │       ├─ Port: 3306
          │           │               │       ├─ Volume: mysql-data (10Gi)
          │           │               │       └─ Resources:
          │           │               │           ├─ requests: 200m CPU, 512Mi RAM
          │           │               │           └─ limits: 1000m CPU, 1Gi RAM
          │           │               │
          │           │               ├─ wordpress-deployment.yaml
          │           │               │   └─ Creates: Deployment/wordpress
          │           │               │       ├─ InitContainer: wait-for-mysql
          │           │               │       │   ├─ Image: busybox:latest
          │           │               │       │   ├─ Command: nc -z mysql 3306
          │           │               │       │   └─ Resources:
          │           │               │       │       ├─ requests: 10m CPU, 32Mi RAM
          │           │               │       │       └─ limits: 50m CPU, 64Mi RAM
          │           │               │       │
          │           │               │       └─ Container: wordpress
          │           │               │           ├─ Image: wordpress:latest
          │           │               │           ├─ Port: 80
          │           │               │           ├─ Env vars from mysql-secret
          │           │               │           ├─ Volume: wordpress-data (10Gi)
          │           │               │           └─ Resources:
          │           │               │               ├─ requests: 200m CPU, 512Mi RAM
          │           │               │               └─ limits: 1000m CPU, 1Gi RAM
          │           │               │
          │           │               ├─ wordpress-pvc.yaml
          │           │               │   └─ Creates: PVC/wordpress-pvc (10Gi)
          │           │               │
          │           │               └─ ingress.yaml
          │           │                   └─ Creates: Ingress/wordpress-ingress
          │           │                       ├─ Host: my-awesome-store.local.test
          │           │                       ├─ IngressClass: nginx
          │           │                       └─ Backend: wordpress:80
          │           │
          │           └─ Helm waits for all resources to be ready
          │
          ├─ STEP 4: Wait for Pods Ready
          │   └─ Line 29-31: await this.waitForReady(namespace)
          │       │
          │       └─ Line 113-136: waitForReady(namespace, timeout=600s)
          │           ├─ Line 117-133: Loop until timeout
          │           │   ├─ Line 119: pods = await k8sApi.listNamespacedPod(namespace)
          │           │   ├─ Line 120-123: Check all pods are Running and Ready
          │           │   │   └─ Checks:
          │           │   │       ├─ pod.status.phase === 'Running'
          │           │   │       └─ pod.status.conditions[].type === 'Ready'
          │           │   │
          │           │   ├─ Line 125-127: If all ready, return true
          │           │   └─ Line 129: await sleep(5000) // Wait 5s and retry
          │           │
          │           └─ Line 135: throw Error('Timeout...') if not ready
          │
          ├─ STEP 5: Add Host Entry
          │   └─ Line 33: await addHostEntry(store.name, this.domain)
          │       │
          │       └─ orchestrator/src/utils/hosts.js
          │           └─ Line 16-34: addHostEntry(storeName, domain)
          │               ├─ Line 17: hostname = 'my-awesome-store.local.test'
          │               ├─ Line 18: entry = '127.0.0.1 my-awesome-store.local.test'
          │               │
          │               ├─ Line 21-26: Check if entry exists
          │               │   └─ Read /etc/hosts and search for hostname
          │               │
          │               └─ Line 29-31: Add entry
          │                   └─ Command:
          │                       echo "127.0.0.1 my-awesome-store.local.test" | \
          │                       sudo tee -a /etc/hosts > /dev/null
          │
          ├─ STEP 6: Generate URL
          │   └─ Line 35-37: url = 'http://my-awesome-store.local.test'
          │
          └─ Line 39: return { success: true, url }
```

**Kubernetes Resources Created**:
```
Namespace: store-my-awesome-store-d226a6cc
├─ ResourceQuota: store-quota
├─ Secret: mysql-secret
├─ StatefulSet: mysql
│  └─ Pod: mysql-0
├─ Deployment: wordpress
│  └─ Pod: wordpress-7d8ddbfb78-xxxxx
├─ Service: mysql (ClusterIP, port 3306)
├─ Service: wordpress (ClusterIP, port 80)
├─ PVC: wordpress-pvc (10Gi)
├─ PVC: mysql-data-mysql-0 (10Gi)
└─ Ingress: wordpress-ingress
   └─ Host: my-awesome-store.local.test → wordpress:80
```

---

### Phase 6: Orchestrator Updates Database

```
ORCHESTRATOR: After provisioner.provision() returns
  │
  └─ orchestrator/src/controller.js
      └─ Line 75-89: Handle provision result
          │
          ├─ Line 77-82: If success
          │   └─ SQL Update:
          │       UPDATE stores 
          │       SET status = 'ready',
          │           url = 'http://my-awesome-store.local.test',
          │           updated_at = NOW()
          │       WHERE id = 'd226a6cc-...'
          │
          └─ Line 83-89: If failure
              └─ SQL Update:
                  UPDATE stores 
                  SET status = 'failed',
                      error_message = '<sanitized error>',
                      updated_at = NOW()
                  WHERE id = 'd226a6cc-...'
```

**Database State After Success**:
```sql
SELECT * FROM stores WHERE name = 'my-awesome-store';

id                  | d226a6cc-c50b-4d4d-9e3d-ec3a6841b90b
name                | my-awesome-store
type                | woocommerce
status              | ready  ← CHANGED from 'provisioning'
namespace           | store-my-awesome-store-d226a6cc
url                 | http://my-awesome-store.local.test  ← ADDED
helm_release        | my-awesome-store
created_at          | 2026-02-07 12:08:33.997
updated_at          | 2026-02-07 12:09:31.564  ← UPDATED
error_message       | NULL
```

---

### Phase 7: Dashboard Updates UI

```
DASHBOARD: Polling loop (every 5 seconds)
  │
  └─ dashboard/src/App.jsx
      └─ Line 17-30: useEffect with interval
          └─ Line 32-45: fetchStores() function
              │
              ├─ Calls: api.getStores()
              │   └─ GET http://localhost:3000/api/stores
              │       │
              │       └─ backend/src/routes/stores.js
              │           └─ Line 7: router.get('/', storeController.getAllStores)
              │               │
              │               └─ backend/src/controllers/storeController.js
              │                   └─ Line 5-18: getAllStores(req, res)
              │                       ├─ SQL: SELECT * FROM stores ORDER BY created_at DESC
              │                       └─ Returns: { success: true, data: [...stores] }
              │
              ├─ Line 40-42: Update state
              │   └─ setStores(data) // Triggers re-render
              │
              └─ UI Re-renders:
                  └─ dashboard/src/components/StoreCard.jsx
                      ├─ Status badge changes:
                      │   └─ 'provisioning' (yellow, pulsing) 
                      │       → 'ready' (green, ✅)
                      │
                      ├─ URL appears:
                      │   └─ <a href="http://my-awesome-store.local.test">
                      │
                      └─ "Open Store" button enabled
```

**User sees**:
```
┌─────────────────────────────────────┐
│ my-awesome-store          ✅ READY  │
│ woocommerce                         │
│                                     │
│ URL: http://my-awesome-store.local.test │
│ Created: 2/7/2026, 12:08:33 PM     │
│ Namespace: store-my-awesome-store-d226a6cc │
│                                     │
│ [Open Store]  [Delete]              │
└─────────────────────────────────────┘
```

---

## Store Deletion Flow

### Phase 1: User Clicks Delete

```
USER ACTION: Click "Delete" button
  │
  └─ dashboard/src/components/StoreCard.jsx
      └─ Line 64-70: Delete button onClick
          └─ onDelete(store.id) // Calls parent function
              │
              └─ dashboard/src/App.jsx
                  └─ Line 47-55: handleDelete(id) function
                      └─ await api.deleteStore(id)
                          │
                          └─ dashboard/src/services/api.js
                              └─ Line 22-30: deleteStore(id)
                                  └─ DELETE http://localhost:3000/api/stores/{id}
```

---

### Phase 2: Backend Marks for Deletion

```
BACKEND RECEIVES: DELETE /api/stores/{id}
  │
  └─ backend/src/routes/stores.js
      └─ Line 10: router.delete('/:id', storeController.deleteStore)
          │
          └─ backend/src/controllers/storeController.js
              └─ Line 62-85: deleteStore(req, res)
                  │
                  ├─ Line 63: id = req.params.id
                  │
                  ├─ Line 65-75: Update status to 'deleting'
                  │   └─ SQL:
                  │       UPDATE stores 
                  │       SET status = 'deleting', updated_at = NOW()
                  │       WHERE id = '{id}'
                  │
                  └─ Line 77-83: Return response
                      └─ res.json({ success: true, message: 'Store deletion initiated' })
```

**Database State**:
```sql
status = 'deleting'  ← Orchestrator will detect this
```

---

### Phase 3: Orchestrator Detects Deletion

```
ORCHESTRATOR RECONCILIATION LOOP
  │
  └─ orchestrator/src/controller.js
      └─ Line 45: await this.handleDeletion()
          │
          └─ Line 100-141: handleDeletion() function
              │
              ├─ Line 101-103: Query database
              │   └─ SQL:
              │       SELECT * FROM stores 
              │       WHERE status = 'deleting'
              │       ORDER BY created_at ASC
              │
              ├─ Line 105-108: Check if any stores found
              │
              └─ Line 112-140: Loop through stores
                  └─ For each store:
                      │
                      ├─ Line 114: console.log('🗑️ Deleting...')
                      │
                      ├─ Line 116-119: Get provisioner
                      │
                      └─ Line 121: result = await provisioner.deprovision(store)
                          │
                          └─ orchestrator/src/provisioners/woocommerce.js
                              └─ Line 138-159: deprovision(store) function
                                  │
                                  ├─ STEP 1: Uninstall Helm Release
                                  │   └─ Line 143-146: execAsync(helmCommand)
                                  │       └─ Command:
                                  │           helm uninstall my-awesome-store \
                                  │             --namespace store-my-awesome-store-d226a6cc
                                  │
                                  ├─ STEP 2: Delete Namespace
                                  │   └─ Line 148-150: k8sApi.deleteNamespace(namespace)
                                  │       └─ Deletes: store-my-awesome-store-d226a6cc
                                  │           └─ Cascades to all resources:
                                  │               ├─ Pods
                                  │               ├─ Services
                                  │               ├─ Deployments
                                  │               ├─ StatefulSets
                                  │               ├─ PVCs
                                  │               └─ Ingress
                                  │
                                  ├─ STEP 3: Remove Host Entry
                                  │   └─ Line 152: await removeHostEntry(store.name, domain)
                                  │       │
                                  │       └─ orchestrator/src/utils/hosts.js
                                  │           └─ Line 43-67: removeHostEntry()
                                  │               ├─ Read /etc/hosts
                                  │               ├─ Filter out lines with hostname
                                  │               └─ Write back to /etc/hosts
                                  │
                                  └─ Line 154: return { success: true }
```

---

### Phase 4: Orchestrator Deletes Database Record

```
ORCHESTRATOR: After deprovision() returns
  │
  └─ orchestrator/src/controller.js
      └─ Line 123-132: Handle deprovision result
          │
          ├─ Line 123-126: If success
          │   └─ SQL Delete:
          │       DELETE FROM stores WHERE id = '{id}'
          │
          └─ Line 127-132: If failure
              └─ SQL Update:
                  UPDATE stores 
                  SET error_message = '<sanitized error>'
                  WHERE id = '{id}'
```

---

### Phase 5: Dashboard Updates

```
DASHBOARD: Next polling cycle
  │
  └─ fetchStores() called
      ├─ Store no longer in database
      ├─ setStores(newStores) // Without deleted store
      └─ UI re-renders without the store card
```

---

## File-by-File Execution Map

### Backend Files

```
backend/
├─ src/
│  ├─ server.js ........................... Entry point, Express setup
│  ├─ db/
│  │  └─ postgres.js ...................... DB connection, schema init
│  ├─ routes/
│  │  └─ stores.js ........................ Route definitions
│  └─ controllers/
│     └─ storeController.js ............... Business logic
│        ├─ getAllStores() ................. SELECT * FROM stores
│        ├─ createStore() .................. INSERT INTO stores
│        └─ deleteStore() .................. UPDATE stores SET status='deleting'
└─ .env ................................. Configuration
```

### Orchestrator Files

```
orchestrator/
├─ src/
│  ├─ controller.js ....................... Entry point, reconciliation loop
│  │  ├─ Orchestrator class
│  │  ├─ reconcile() ...................... Main loop (every 10s)
│  │  ├─ handleProvisioning() ............. Process 'provisioning' stores
│  │  └─ handleDeletion() ................. Process 'deleting' stores
│  │
│  ├─ provisioners/
│  │  ├─ woocommerce.js ................... WooCommerce provisioner
│  │  │  ├─ provision() ................... Create store
│  │  │  │  ├─ createNamespace()
│  │  │  │  ├─ createResourceQuota()
│  │  │  │  ├─ installHelmChart()
│  │  │  │  ├─ waitForReady()
│  │  │  │  └─ addHostEntry()
│  │  │  └─ deprovision() ................. Delete store
│  │  │     ├─ helm uninstall
│  │  │     ├─ deleteNamespace()
│  │  │     └─ removeHostEntry()
│  │  │
│  │  └─ medusa.js ........................ MedusaJS provisioner (similar)
│  │
│  ├─ k8s/
│  │  └─ client.js ........................ Kubernetes API client
│  │
│  └─ utils/
│     ├─ hosts.js ......................... /etc/hosts management
│     │  ├─ addHostEntry()
│     │  └─ removeHostEntry()
│     └─ errors.js ........................ Error sanitization
│        ├─ sanitizeErrorMessage()
│        └─ logAndSanitizeError()
│
└─ .env .................................. Configuration
```

### Dashboard Files

```
dashboard/
├─ index.html ............................ HTML entry point
├─ src/
│  ├─ main.jsx ........................... React entry point
│  ├─ App.jsx ............................ Main component
│  │  ├─ State: stores, loading, error
│  │  ├─ useEffect: fetchStores() every 5s
│  │  ├─ handleCreate()
│  │  └─ handleDelete()
│  │
│  ├─ components/
│  │  ├─ StoreCard.jsx ................... Store display card
│  │  └─ CreateStoreModal.jsx ............ Store creation form
│  │
│  └─ services/
│     └─ api.js .......................... API client
│        ├─ getStores() .................. GET /api/stores
│        ├─ createStore() ................ POST /api/stores
│        └─ deleteStore() ................ DELETE /api/stores/:id
│
└─ src/App.css ........................... Styles
```

### Helm Chart Files

```
helm/store-templates/woocommerce/
├─ Chart.yaml ............................ Chart metadata
├─ values.yaml ........................... Default values
└─ templates/
   ├─ secrets.yaml ....................... MySQL credentials
   ├─ mysql-statefulset.yaml ............. MySQL database
   ├─ wordpress-deployment.yaml .......... WordPress application
   ├─ wordpress-pvc.yaml ................. WordPress storage
   └─ ingress.yaml ....................... HTTP routing
```

---

## Database Schema & Queries

### Table: stores

```sql
CREATE TABLE stores (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    namespace VARCHAR(255),
    url VARCHAR(255),
    helm_release VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    error_message TEXT
);
```

### Key Queries

```sql
-- Backend: Get all stores
SELECT * FROM stores ORDER BY created_at DESC;

-- Backend: Create store
INSERT INTO stores (id, name, type, status, namespace, helm_release)
VALUES ($1, $2, $3, 'provisioning', $4, $5);

-- Backend: Mark for deletion
UPDATE stores SET status = 'deleting', updated_at = NOW() WHERE id = $1;

-- Orchestrator: Find stores to provision
SELECT * FROM stores WHERE status = 'provisioning' ORDER BY created_at ASC;

-- Orchestrator: Find stores to delete
SELECT * FROM stores WHERE status = 'deleting' ORDER BY created_at ASC;

-- Orchestrator: Mark as ready
UPDATE stores 
SET status = 'ready', url = $1, updated_at = NOW() 
WHERE id = $2;

-- Orchestrator: Mark as failed
UPDATE stores 
SET status = 'failed', error_message = $1, updated_at = NOW() 
WHERE id = $2;

-- Orchestrator: Delete store record
DELETE FROM stores WHERE id = $1;
```

---

## Kubernetes Resources Flow

### Resource Creation Order

```
1. Namespace
   └─ store-{name}-{uuid}

2. ResourceQuota
   └─ Limits: CPU, Memory, PVCs

3. Secret (from Helm chart)
   └─ mysql-secret: root-password, database

4. PersistentVolumeClaims
   ├─ wordpress-pvc (10Gi)
   └─ mysql-data-mysql-0 (10Gi)

5. StatefulSet
   └─ mysql-0 pod
      ├─ Waits for PVC
      └─ Starts MySQL

6. Deployment
   └─ wordpress-xxx pod
      ├─ InitContainer: wait-for-mysql
      │  └─ Polls mysql:3306 until ready
      └─ Container: wordpress
         ├─ Connects to MySQL
         └─ Starts Apache/PHP

7. Services
   ├─ mysql (ClusterIP:3306)
   └─ wordpress (ClusterIP:80)

8. Ingress
   └─ Routes {name}.local.test → wordpress:80
```

### Resource Deletion Order

```
1. Helm Uninstall
   ├─ Deletes Deployment → Pods terminate
   ├─ Deletes StatefulSet → Pods terminate
   ├─ Deletes Services
   └─ Deletes Ingress

2. Namespace Deletion
   └─ Cascades to:
      ├─ PVCs (and bound PVs)
      ├─ Secrets
      ├─ ResourceQuota
      └─ Any remaining resources

3. /etc/hosts Cleanup
   └─ Remove hostname entry
```

---

## Summary: Complete Flow Timeline

```
T+0s    User clicks "Create New Store"
T+0.1s  Dashboard sends POST to backend
T+0.2s  Backend inserts record with status='provisioning'
T+0.3s  Backend returns success to dashboard
T+0.4s  Dashboard shows store with "provisioning" status

T+5s    Orchestrator reconciliation loop runs
T+5.1s  Orchestrator queries database, finds new store
T+5.2s  Orchestrator calls WooCommerceProvisioner.provision()
T+5.3s  Creates Kubernetes namespace
T+5.4s  Creates ResourceQuota
T+5.5s  Executes helm install command
T+5.6s  Helm creates all resources (Secrets, PVCs, Deployments, etc.)

T+30s   MySQL pod starts
T+45s   MySQL becomes ready
T+50s   WordPress init container completes (MySQL connection OK)
T+60s   WordPress pod starts
T+90s   WordPress becomes ready
T+91s   Orchestrator's waitForReady() returns true
T+92s   Orchestrator adds /etc/hosts entry
T+93s   Orchestrator updates database: status='ready', url='http://...'

T+95s   Dashboard polls backend
T+95.1s Dashboard receives updated store with status='ready'
T+95.2s Dashboard shows green "READY" badge and "Open Store" button

T+100s  User clicks "Open Store"
T+100.1s Browser navigates to http://my-awesome-store.local.test
T+100.2s nginx-ingress routes to wordpress service
T+100.3s WordPress installation page loads
```

---

## Key Takeaways

1. **Asynchronous Architecture**: Backend immediately returns after DB insert; actual provisioning happens asynchronously in orchestrator

2. **Status-Driven**: Everything is driven by the `status` field in the database:
   - `provisioning` → Orchestrator provisions
   - `ready` → User can access
   - `deleting` → Orchestrator deletes
   - `failed` → Shows error to user

3. **Polling Pattern**: 
   - Dashboard polls backend every 5s
   - Orchestrator polls database every 10s
   - This ensures eventual consistency

4. **Declarative Kubernetes**: Helm charts declare desired state; Kubernetes makes it happen

5. **Error Handling**: Errors are sanitized before showing to users, but full details logged server-side

6. **Idempotent Operations**: All operations handle "already exists" gracefully

---

This document provides the complete technical flow of the Store Orchestrator platform!
