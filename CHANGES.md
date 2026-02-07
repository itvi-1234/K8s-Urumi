# Changes Summary - Domain Update and Error Message Sanitization

## Date: 2026-02-07

### 1. Domain Change: `.dev` → `.test`

**Reason**: Changed from `local.dev` to `local.test` for better local development practices.

**Files Modified**:
- ✅ `/orchestrator/.env` - Updated `DOMAIN=local.test`
- ✅ `/orchestrator/src/controller.js` - Updated default domain
- ✅ `/orchestrator/src/provisioners/woocommerce.js` - Updated default domain
- ✅ `/orchestrator/src/provisioners/medusa.js` - Updated default domain
- ✅ `/orchestrator/src/utils/hosts.js` - Updated documentation
- ✅ `/helm/store-templates/woocommerce/values.yaml` - Updated default domain

**Impact**:
- All new stores will use `.test` domain (e.g., `my-store.local.test`)
- Existing stores with `.dev` domain will continue to work
- `/etc/hosts` entries will be automatically created with `.test` domain

### 2. Error Message Sanitization

**Reason**: Hide technical Helm logs, stack traces, and command output from end users while keeping full details in server logs.

**Files Created**:
- ✅ `/orchestrator/src/utils/errors.js` - Error sanitization utility

**Files Modified**:
- ✅ `/orchestrator/src/controller.js` - Integrated error sanitization
- ✅ `/dashboard/src/components/StoreCard.jsx` - Simplified error display

**Changes**:

1. **Server-side (Orchestrator)**:
   - Created `sanitizeErrorMessage()` function to convert technical errors to user-friendly messages
   - Created `logAndSanitizeError()` function to log full errors server-side while returning sanitized versions
   - Updated controller to use sanitization before storing errors in database

2. **Client-side (Dashboard)**:
   - Updated StoreCard component to show generic, user-friendly error messages
   - Removed display of raw Helm command output and stack traces

**Error Message Mapping**:
| Technical Error | User-Friendly Message |
|----------------|----------------------|
| Helm install failed | Store provisioning failed. Please try deleting and recreating the store. |
| Timeout waiting for pods | Store provisioning timed out. The store may still be starting up. |
| Resource quota errors | Insufficient resources to create store. Please try again later. |
| Connection errors | Connection error. Please check your cluster connectivity. |
| Other errors | An error occurred during provisioning. Please try again. |

**Benefits**:
- ✅ Users see clean, actionable error messages
- ✅ Full technical details still logged server-side for debugging
- ✅ No exposure of internal infrastructure details
- ✅ Better user experience

### 3. Testing

**To test domain change**:
1. Create a new store in the dashboard
2. Verify the URL ends with `.local.test`
3. Verify `/etc/hosts` entry is automatically created
4. Access the store at `http://<store-name>.local.test`

**To test error sanitization**:
1. Create a store that will fail (e.g., invalid configuration)
2. Check the dashboard - should show user-friendly error
3. Check orchestrator logs - should show full technical error

### 4. Rollback Instructions

If needed, to rollback to `.dev` domain:
```bash
# Update .env file
sed -i 's/local.test/local.dev/g' /home/sumit/urumi/orchestrator/.env

# Update code files
sed -i "s/'local.test'/'local.dev'/g" /home/sumit/urumi/orchestrator/src/controller.js
sed -i "s/'local.test'/'local.dev'/g" /home/sumit/urumi/orchestrator/src/provisioners/*.js
sed -i 's/local.test/local.dev/g' /home/sumit/urumi/helm/store-templates/woocommerce/values.yaml

# Restart orchestrator
cd /home/sumit/urumi/orchestrator && npm start
```

### 5. Next Steps

**Recommended**:
1. Update documentation files (README.md, QUICKSTART.md) to reflect `.test` domain
2. Consider adding a configuration UI to change domain without code changes
3. Add error logging to a centralized logging service for better debugging
4. Consider adding retry logic for transient errors

**Optional**:
1. Add more specific error message patterns to the sanitization utility
2. Create an admin panel to view full error logs
3. Add error notifications/alerts for critical failures
