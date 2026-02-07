#!/bin/bash

# Idempotency Test Script
# Tests that store provisioning is idempotent and recovers from failures

set -e

echo "🧪 Testing Idempotency Implementation"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test store name
STORE_NAME="test-idempotency-$(date +%s)"
STORE_TYPE="woocommerce"

echo -e "${YELLOW}Test 1: Normal Store Creation${NC}"
echo "Creating store: $STORE_NAME"

# Create store
RESPONSE=$(curl -s -X POST http://localhost:3000/api/stores \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$STORE_NAME\", \"type\": \"$STORE_TYPE\"}")

STORE_ID=$(echo $RESPONSE | jq -r '.data.id')
echo "Store ID: $STORE_ID"

# Wait for provisioning to complete
echo "Waiting for provisioning to complete..."
sleep 10

STATUS=""
for i in {1..30}; do
  STATUS=$(curl -s http://localhost:3000/api/stores | jq -r ".data[] | select(.id == \"$STORE_ID\") | .status")
  echo "Status: $STATUS (attempt $i/30)"
  
  if [ "$STATUS" == "ready" ]; then
    echo -e "${GREEN}✅ Test 1 PASSED: Store provisioned successfully${NC}"
    break
  elif [ "$STATUS" == "failed" ]; then
    echo -e "${RED}❌ Test 1 FAILED: Store provisioning failed${NC}"
    exit 1
  fi
  
  sleep 10
done

if [ "$STATUS" != "ready" ]; then
  echo -e "${RED}❌ Test 1 FAILED: Timeout waiting for store to be ready${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Test 2: Idempotency - Retry Provisioning${NC}"
echo "Manually setting store status back to 'provisioning'..."

# Set status back to provisioning
psql -h localhost -U postgres -d orchestrator -c \
  "UPDATE stores SET status = 'provisioning' WHERE id = '$STORE_ID';" > /dev/null 2>&1

echo "Waiting for orchestrator to detect and re-process..."
sleep 15

# Check status again
STATUS=$(curl -s http://localhost:3000/api/stores | jq -r ".data[] | select(.id == \"$STORE_ID\") | .status")

if [ "$STATUS" == "ready" ]; then
  echo -e "${GREEN}✅ Test 2 PASSED: Idempotency works - store returned to ready without errors${NC}"
else
  echo -e "${RED}❌ Test 2 FAILED: Store status is $STATUS (expected: ready)${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Test 3: Verify Namespace Exists${NC}"

NAMESPACE=$(curl -s http://localhost:3000/api/stores | jq -r ".data[] | select(.id == \"$STORE_ID\") | .namespace")
echo "Namespace: $NAMESPACE"

if kubectl get namespace $NAMESPACE > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Test 3 PASSED: Namespace exists${NC}"
else
  echo -e "${RED}❌ Test 3 FAILED: Namespace not found${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Test 4: Verify Helm Release Exists${NC}"

HELM_RELEASE=$(curl -s http://localhost:3000/api/stores | jq -r ".data[] | select(.id == \"$STORE_ID\") | .helm_release")
echo "Helm Release: $HELM_RELEASE"

if helm list -n $NAMESPACE | grep -q $HELM_RELEASE; then
  echo -e "${GREEN}✅ Test 4 PASSED: Helm release exists${NC}"
else
  echo -e "${RED}❌ Test 4 FAILED: Helm release not found${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Test 5: Verify Pods Are Running${NC}"

POD_COUNT=$(kubectl get pods -n $NAMESPACE --no-headers | wc -l)
RUNNING_COUNT=$(kubectl get pods -n $NAMESPACE --no-headers | grep -c "Running" || true)

echo "Total pods: $POD_COUNT"
echo "Running pods: $RUNNING_COUNT"

if [ "$POD_COUNT" -gt 0 ] && [ "$POD_COUNT" -eq "$RUNNING_COUNT" ]; then
  echo -e "${GREEN}✅ Test 5 PASSED: All pods are running${NC}"
else
  echo -e "${RED}❌ Test 5 FAILED: Not all pods are running${NC}"
  kubectl get pods -n $NAMESPACE
  exit 1
fi

echo ""
echo -e "${YELLOW}Cleanup: Deleting test store${NC}"

curl -s -X DELETE http://localhost:3000/api/stores/$STORE_ID > /dev/null
echo "Waiting for deletion..."
sleep 15

# Verify deletion
if kubectl get namespace $NAMESPACE > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Namespace still exists (may be terminating)${NC}"
else
  echo -e "${GREEN}✅ Cleanup complete: Namespace deleted${NC}"
fi

echo ""
echo "======================================"
echo -e "${GREEN}🎉 All Idempotency Tests PASSED!${NC}"
echo "======================================"
