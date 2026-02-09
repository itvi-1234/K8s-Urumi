#!/bin/bash

# Test Abuse Prevention Features

echo "🧪 Testing Abuse Prevention"
echo "============================"
echo ""

echo "Test 1: Create a store and verify audit logging"
echo "------------------------------------------------"

# Create a test store
STORE_NAME="abuse-test-$(date +%s)"# 1. SSH into the new IP
ssh -i ~/Downloads/urumi-key.pem ubuntu@43.205.215.225

# 2. Update k3s with the new IP
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--tls-san 43.205.215.225" sh -
echo "Creating store: $STORE_NAME"

RESPONSE=$(curl -s -X POST http://localhost:3000/api/stores \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$STORE_NAME\", \"type\": \"woocommerce\"}")

STORE_ID=$(echo $RESPONSE | jq -r '.data.id')
echo "Store ID: $STORE_ID"
echo ""

# Wait a moment for audit log to be written
sleep 2

# Check audit log
echo "Checking audit log in database..."
kubectl exec -it -n platform postgres-postgresql-0 -- psql -U postgres -d orchestrator -c \
  "SELECT action, details, ip_address, created_at FROM audit_log WHERE store_id = '$STORE_ID' ORDER BY created_at DESC;" <<EOF
postgres
EOF

echo ""
echo "Test 2: Wait for provisioning and check audit logs"
echo "---------------------------------------------------"
echo "Waiting 90 seconds for provisioning..."
sleep 90

# Check audit logs again
echo "Checking audit logs after provisioning..."
kubectl exec -it -n platform postgres-postgresql-0 -- psql -U postgres -d orchestrator -c \
  "SELECT action, details->'url' as url, created_at FROM audit_log WHERE store_id = '$STORE_ID' ORDER BY created_at DESC;" <<EOF
postgres
EOF

echo ""
echo "Test 3: Delete store and verify audit logging"
echo "----------------------------------------------"
curl -s -X DELETE http://localhost:3000/api/stores/$STORE_ID
echo "Store deletion initiated"
sleep 2

# Check audit logs for delete
echo "Checking audit logs after deletion request..."
kubectl exec -it -n platform postgres-postgresql-0 -- psql -U postgres -d orchestrator -c \
  "SELECT action, details, created_at FROM audit_log WHERE store_id = '$STORE_ID' ORDER BY created_at DESC;" <<EOF
postgres
EOF

echo ""
echo "============================"
echo "✅ Abuse Prevention Tests Complete!"
echo "============================"
echo ""
echo "Expected audit log actions:"
echo "  1. create (from API)"
echo "  2. provision_success (from orchestrator)"
echo "  3. delete (from API)"
echo "  4. deprovision_success (from orchestrator)"
