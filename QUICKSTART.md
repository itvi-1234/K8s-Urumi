# 🚀 Quick Start Guide - Store Orchestrator

## What You Need to Do NOW

This guide will get you from zero to a running platform in **15 minutes**.

---

## ✅ Step 1: Check Prerequisites (2 min)

Run these commands to verify you have everything:

```bash
# Check Docker
docker --version
# Should show: Docker version 20.x or higher

# Check kubectl
kubectl version --client
# Should show: Client Version: v1.27 or higher

# Check Node.js
node --version
# Should show: v20.x or higher

# Check npm
npm --version
# Should show: 9.x or higher
```

**Missing something?**
- **Docker**: https://docs.docker.com/get-docker/
- **kubectl**: `sudo snap install kubectl --classic`
- **Node.js**: `sudo snap install node --classic --channel=20`

---

## 🎯 Step 2: Setup Kubernetes Cluster (5 min)

```bash
cd /home/sumit/urumi

# Run the automated setup script
./scripts/setup-local.sh
```

**What this does:**
- Installs Kind (if not present)
- Creates a Kind cluster named `store-orchestrator`
- Installs nginx-ingress controller
- Deploys PostgreSQL database
- Configures local DNS (*.local.dev)

**Wait for it to complete** - you'll see: ✅ Local Kubernetes setup complete!

---

## 📦 Step 3: Install Dependencies (3 min)

Open **3 terminals** and run these in parallel:

### Terminal 1: Backend
```bash
cd /home/sumit/urumi/backend
npm install
cp .env.example .env
```

### Terminal 2: Orchestrator
```bash
cd /home/sumit/urumi/orchestrator
npm install
```

### Terminal 3: Dashboard
```bash
cd /home/sumit/urumi/dashboard
npm install
```

---

## ⚙️ Step 4: Configure Environment (1 min)

### Backend Configuration

Edit `/home/sumit/urumi/backend/.env`:

```env
DB_HOST=postgres-postgresql.platform.svc.cluster.local
DB_PORT=5432
DB_NAME=orchestrator
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3000
```

### Orchestrator Configuration

Create `/home/sumit/urumi/orchestrator/.env`:

```env
DB_HOST=postgres-postgresql.platform.svc.cluster.local
DB_PORT=5432
DB_NAME=orchestrator
DB_USER=postgres
DB_PASSWORD=postgres
DOMAIN=local.dev
WOOCOMMERCE_CHART_PATH=/home/sumit/urumi/helm/store-templates/woocommerce
MEDUSA_CHART_PATH=/home/sumit/urumi/helm/store-templates/medusa
RECONCILE_INTERVAL=10000
```

---

## 🚀 Step 5: Start the Platform (2 min)

Keep those **3 terminals** open and run:

### Terminal 1: Backend API
```bash
cd /home/sumit/urumi/backend
npm start
```

**Wait for:** `🚀 Backend API running on port 3000`

### Terminal 2: Orchestrator
```bash
cd /home/sumit/urumi/orchestrator
npm start
```

**Wait for:** `🧠 Orchestrator starting...`

### Terminal 3: Dashboard
```bash
cd /home/sumit/urumi/dashboard
npm run dev
```

**Wait for:** `Local: http://localhost:5173/`

---

## 🎉 Step 6: Access Dashboard (1 min)

Open your browser: **http://localhost:5173**

You should see the **Store Orchestrator** dashboard with a dark gradient header!

---

## 🏪 Step 7: Create Your First Store (5 min)

1. Click **"Create New Store"** button
2. Enter store name: `test-shop` (only letters, numbers, hyphens)
3. Select type: **WooCommerce**
4. Click **"Create Store"**

**What happens next:**
- Status changes to **PROVISIONING** (yellow, pulsing)
- Orchestrator creates Kubernetes namespace
- Helm installs WordPress + MySQL
- Wait 3-5 minutes...
- Status changes to **READY** (green)

---

## 🛒 Step 8: Place a Test Order (5 min)

Once status is **READY**:

1. Click **"Open Store"** button
2. WordPress setup wizard appears:
   - Language: **English**
   - Site Title: **My Test Shop**
   - Username: `admin`
   - Password: `admin123` (or your choice)
   - Email: `test@example.com`
   - Click **"Install WordPress"**

3. Login to WordPress admin
4. Install WooCommerce:
   - Go to **Plugins → Add New**
   - Search: **WooCommerce**
   - Click **Install Now** → **Activate**

5. WooCommerce Setup Wizard:
   - Skip store details (or fill them)
   - Payment: Enable **"Cash on Delivery"**
   - Skip shipping
   - Click **"Continue"**

6. Create a sample product:
   - Go to **Products → Add New**
   - Title: **Test Product**
   - Price: **$19.99**
   - Click **"Publish"**

7. Place an order:
   - Visit store: `http://test-shop.local.dev`
   - Add **Test Product** to cart
   - Click **"Proceed to Checkout"**
   - Fill billing details (any fake data)
   - Payment method: **Cash on Delivery**
   - Click **"Place Order"**

8. Verify order:
   - Go back to admin: `http://test-shop.local.dev/wp-admin`
   - Click **WooCommerce → Orders**
   - You should see your order!

**✅ SUCCESS!** You've completed the end-to-end flow!

---

## 🗑️ Step 9: Delete the Store (1 min)

Back in the dashboard:

1. Click **"Delete"** button on your store card
2. Confirm deletion
3. Status changes to **DELETING**
4. Store disappears after ~30 seconds

**What happened:**
- Helm uninstalled the release
- Kubernetes deleted the namespace
- All resources (Pods, PVCs, Services) cleaned up
- Database record removed

---

## 🐛 Troubleshooting

### Dashboard won't load
```bash
# Check if Vite is running
cd /home/sumit/urumi/dashboard
npm run dev
```

### Store stuck in PROVISIONING
```bash
# Check orchestrator logs
cd /home/sumit/urumi/orchestrator
# Look at the terminal output

# Check Kubernetes pods
kubectl get pods -A
```

### Cannot access store URL
```bash
# Check /etc/hosts
cat /etc/hosts | grep local.dev

# Should see:
# 127.0.0.1 dashboard.local.dev

# Add store URL manually if needed:
echo "127.0.0.1 test-shop.local.dev" | sudo tee -a /etc/hosts
```

### PostgreSQL connection failed
```bash
# Check if PostgreSQL is running
kubectl get pods -n platform

# Port-forward to test connection
kubectl port-forward -n platform svc/postgres-postgresql 5432:5432

# In another terminal:
psql -h localhost -U postgres -d orchestrator
# Password: postgres
```

---

## 📊 What's Running?

### Kubernetes Cluster (Kind)
- **Namespace: platform**
  - PostgreSQL (stores metadata)
  
- **Namespace: ingress-nginx**
  - nginx-ingress-controller (routes traffic)

- **Namespace: store-test-shop** (when you create a store)
  - WordPress pod
  - MySQL pod
  - Services, PVCs, Ingress

### Local Processes
- **Backend API** (port 3000) - REST API
- **Orchestrator** (no port) - Reconciliation loop
- **Dashboard** (port 5173) - React UI

---

## 🎯 Next Steps

### Try These:
1. **Create multiple stores** - See them all in the dashboard
2. **Create a Medusa store** - Select "MedusaJS" instead of "WooCommerce"
3. **Monitor resources** - Run `kubectl top pods -A` (requires metrics-server)
4. **Check logs** - `kubectl logs -n store-test-shop deployment/wordpress`

### Production Deployment:
- Read **README.md** for VPS deployment instructions
- Read **DESIGN.md** to understand architecture decisions
- Read **IMPLEMENTATION_PLAN.md** for detailed technical breakdown

---

## 🆘 Need Help?

### Check Logs:
```bash
# Backend logs
cd /home/sumit/urumi/backend
# Look at terminal output

# Orchestrator logs
cd /home/sumit/urumi/orchestrator
# Look at terminal output

# Kubernetes logs
kubectl logs -n platform deployment/backend
kubectl logs -n store-test-shop deployment/wordpress
```

### Verify Cluster:
```bash
# Check all pods
kubectl get pods -A

# Check ingress
kubectl get ingress -A

# Check namespaces
kubectl get namespaces
```

### Reset Everything:
```bash
# Delete Kind cluster
kind delete cluster --name store-orchestrator

# Re-run setup
./scripts/setup-local.sh
```

---

**🎉 Congratulations! You've successfully deployed a Kubernetes-powered e-commerce provisioning platform!**
