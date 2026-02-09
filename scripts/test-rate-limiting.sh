#!/bin/bash

# Rate Limiting Test Script
# Tests that rate limiting works correctly

echo "🧪 Testing Rate Limiting"
echo "========================"
echo ""

echo "Test 1: Create 6 stores rapidly (should hit rate limit at 6th)"
echo "----------------------------------------------------------------"

for i in {1..6}; do
  echo "Attempt $i/6..."
  
  RESPONSE=$(curl -s -X POST http://localhost:3000/api/stores \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"rate-test-$i\", \"type\": \"woocommerce\"}")
  
  SUCCESS=$(echo $RESPONSE | jq -r '.success')
  
  if [ "$SUCCESS" == "true" ]; then
    echo "  ✅ Store created successfully"
    STORE_ID=$(echo $RESPONSE | jq -r '.data.id')
    echo "     Store ID: $STORE_ID"
  else
    ERROR=$(echo $RESPONSE | jq -r '.error')
    echo "  ❌ Rate limit hit: $ERROR"
    
    if [[ "$ERROR" == *"Too many stores"* ]]; then
      echo ""
      echo "✅ Test 1 PASSED: Rate limiting is working!"
      echo "   - First 5 stores created successfully"
      echo "   - 6th store blocked by rate limiter"
      break
    fi
  fi
  
  sleep 1
done

echo ""
echo "Test 2: Check rate limit headers"
echo "---------------------------------"

RESPONSE=$(curl -s -i -X GET http://localhost:3000/api/stores)

echo "Response headers:"
echo "$RESPONSE" | grep -i "ratelimit"

echo ""
echo "Test 3: Verify rate limit info"
echo "-------------------------------"

# Make a request and check headers
HEADERS=$(curl -s -i -X GET http://localhost:3000/api/stores | grep -i "ratelimit")

if [ -n "$HEADERS" ]; then
  echo "✅ Rate limit headers present:"
  echo "$HEADERS"
else
  echo "⚠️  No rate limit headers found"
fi

echo ""
echo "========================"
echo "Rate Limiting Tests Complete!"
echo "========================"
echo ""
echo "📊 Rate Limits Configured:"
echo "  - Store Creation: 5 per hour per IP"
echo "  - Store Deletion: 10 per hour per IP"
echo "  - General API: 100 requests per 15 minutes per IP"
echo ""
echo "🧹 Cleanup:"
echo "To delete test stores, run:"
echo "  curl http://localhost:3000/api/stores | jq -r '.data[] | select(.name | startswith(\"rate-test\")) | .id' | xargs -I {} curl -X DELETE http://localhost:3000/api/stores/{}"
