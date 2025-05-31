# Permission System v3.0 - Testing Guide

## Overview

The Permission System v3.0 dual-mode implementation creates `PendingPermissionOperation` entries alongside existing permission computation. This allows us to test the new asynchronous system before switching over.

## Implementation Summary

### New Files Created

1. **Database Schema** (`packages/prisma/src/prisma/schema/sharing.prisma`)
   - Added `PendingPermissionOperation` model
   - Added `PermissionOperationType` and `PermissionOperationStatus` enums

2. **Operation Builder** (`packages/util/src/permissions/operationBuilder.ts`)
   - `buildOperation()` - Core builder function
   - `buildOperationsForDirectPermission()` - For new permissions
   - `buildOperationsForPermissionUpdate()` - For permission updates
   - `buildOperationsForPermissionRevoke()` - For permission removal

3. **Operation Config** (`packages/util/src/permissions/operationConfig.ts`)
   - `shouldCreateOperations()` - Checks if feature is enabled
   - `logOperation()` - Logging utility
   - `OperationMetrics` - Performance tracking

4. **Operation Types** (`packages/util/src/permissions/operationTypes.ts`)
   - Type guards and utility functions
   - Operation fingerprint generation

### Modified Files

1. **Sharing Service** (`packages/graphql/src/services/sharing.ts`)
   - Extended `shareObject()` - Creates operations when granting permissions
   - Extended `revokeObjectAccess()` - Creates operations when revoking
   - Extended `changeObjectPermissionLevel()` - Creates operations when updating

## Testing Steps

### 1. Enable the Feature Flag

Set the environment variable to enable operation creation:

```bash
export ENABLE_PENDING_OPERATIONS=true
```

Or add to your `.env` file:
```
ENABLE_PENDING_OPERATIONS=true
```

### 2. Start the Development Environment

```bash
# Start all services with the feature enabled
pnpm dev
```

### 3. Monitor the Database

Connect to your PostgreSQL database and monitor the PendingPermissionOperation table:

```sql
-- Check if operations are being created
SELECT * FROM "PendingPermissionOperation" ORDER BY "createdAt" DESC LIMIT 10;

-- Count operations by type
SELECT "operationType", COUNT(*) 
FROM "PendingPermissionOperation" 
GROUP BY "operationType";

-- Check operation statuses
SELECT "status", COUNT(*) 
FROM "PendingPermissionOperation" 
GROUP BY "status";
```

### 4. Test Scenarios

#### Test 1: Share an Element with a User

1. Login as a lecturer
2. Go to the element library
3. Share an element with another user
4. Check the database for new operations:

```sql
SELECT * FROM "PendingPermissionOperation" 
WHERE "operationType" = 'PROCESS_USER_ELEMENT_ACCESS'
ORDER BY "createdAt" DESC LIMIT 1;
```

#### Test 2: Share with a User Group

1. Create or use an existing user group
2. Share a course with the user group
3. Check for group expansion operations:

```sql
SELECT * FROM "PendingPermissionOperation" 
WHERE "operationType" = 'EXPAND_GROUP_TO_USER_OPERATIONS'
ORDER BY "createdAt" DESC LIMIT 1;
```

#### Test 3: Update Permission Level

1. Find an existing permission
2. Change the permission level (e.g., from READ to WRITE)
3. Check for update operations:

```sql
SELECT * FROM "PendingPermissionOperation" 
WHERE "operationType" = 'UPDATE_PERMISSION_LEVEL'
ORDER BY "createdAt" DESC LIMIT 1;
```

#### Test 4: Revoke Permission

1. Remove a user's access to an object
2. Check for revoke operations:

```sql
SELECT * FROM "PendingPermissionOperation" 
WHERE "operationType" = 'REVOKE_USER_PERMISSION'
ORDER BY "createdAt" DESC LIMIT 1;
```

### 5. Monitor Logs

Watch the application logs for operation creation:

```bash
# In your terminal running the dev server
# You should see logs like:
# [OperationMetrics] Created pending permission operations...
# [OperationMetrics] Created pending revoke operations...
```

### 6. Performance Testing

Compare performance with and without the feature:

1. Disable the feature: `export ENABLE_PENDING_OPERATIONS=false`
2. Share a course with 50+ users and measure time
3. Enable the feature: `export ENABLE_PENDING_OPERATIONS=true`
4. Repeat the same operation and compare times

## Validation Queries

### Check Operation Creation Success Rate

```sql
-- Operations created in last hour
SELECT 
  COUNT(*) as total_operations,
  SUM(CASE WHEN "status" = 'PENDING' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN "status" = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN "status" = 'FAILED' THEN 1 ELSE 0 END) as failed
FROM "PendingPermissionOperation"
WHERE "createdAt" > NOW() - INTERVAL '1 hour';
```

### Check Operation Details

```sql
-- Detailed view of recent operations
SELECT 
  "id",
  "operationType",
  "status",
  "targetUserId",
  "targetGroupId",
  "objectId",
  "objectType",
  "permissionLevel",
  "createdAt"
FROM "PendingPermissionOperation"
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Verify Fingerprint Uniqueness

```sql
-- Check for duplicate operations (should be none due to fingerprints)
SELECT "fingerprint", COUNT(*) as count
FROM "PendingPermissionOperation"
GROUP BY "fingerprint"
HAVING COUNT(*) > 1;
```

## Troubleshooting

### Operations Not Being Created

1. Check environment variable: `echo $ENABLE_PENDING_OPERATIONS`
2. Check logs for errors in operation creation
3. Verify database migration was applied:
   ```sql
   SELECT * FROM "_prisma_migrations" 
   WHERE "migration_name" LIKE '%pending_permission_operation%';
   ```

### Performance Issues

1. Monitor operation creation time in logs
2. Check database indexes:
   ```sql
   \d "PendingPermissionOperation"
   ```
3. Reduce batch sizes if needed

## Expected Results

When the feature is working correctly:

1. Every permission grant/update/revoke creates corresponding operations
2. No errors in the application logs
3. Performance overhead should be <5%
4. All operations have status 'PENDING' (since we haven't implemented processing yet)
5. Fingerprints prevent duplicate operations

## Next Steps

After validating operation creation works correctly:

1. Implement Epic 4: Operation Processing Engine
2. Add monitoring dashboards
3. Create comparison tools
4. Plan gradual production rollout