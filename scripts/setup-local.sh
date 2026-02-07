#!/bin/bash
set -e

echo "🚀 Setting up local Kubernetes environment for Store Orchestrator"

# Check if Kind is installed
if ! command -v kind &> /dev/null; then
    echo "❌ Kind is not installed. Installing..."
    curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
    chmod +x ./kind
    sudo mv ./kind /usr/local/bin/kind
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    echo "❌ Helm is not installed. Installing..."
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# Create Kind cluster with ingress support
echo "📦 Creating Kind cluster..."
cat <<EOF | kind create cluster --name store-orchestrator --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
EOF

# Install nginx-ingress
echo "🌐 Installing nginx-ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for ingress controller
echo "⏳ Waiting for ingress controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

# Create platform namespace
echo "📁 Creating platform namespace..."
kubectl create namespace platform || true

# Install PostgreSQL for platform
echo "🐘 Installing PostgreSQL..."
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm install postgres bitnami/postgresql \
  --namespace platform \
  --set auth.username=postgres \
  --set auth.password=postgres \
  --set auth.database=orchestrator \
  --set primary.persistence.size=5Gi \
  --wait

# Setup local DNS
echo "🌍 Setting up local DNS..."
echo "127.0.0.1 dashboard.local.dev" | sudo tee -a /etc/hosts

echo ""
echo "✅ Local Kubernetes setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Build and deploy the platform:"
echo "   cd backend && npm install"
echo "   cd ../orchestrator && npm install"
echo "   cd ../dashboard && npm install"
echo ""
echo "2. Set environment variables:"
echo "   export DB_HOST=postgres-postgresql.platform.svc.cluster.local"
echo "   export DB_PASSWORD=postgres"
echo ""
echo "3. Run components locally (for development):"
echo "   # Terminal 1: Backend"
echo "   cd backend && npm start"
echo ""
echo "   # Terminal 2: Orchestrator"
echo "   cd orchestrator && npm start"
echo ""
echo "   # Terminal 3: Dashboard"
echo "   cd dashboard && npm run dev"
echo ""
echo "4. Access dashboard at: http://dashboard.local.dev:5173"
