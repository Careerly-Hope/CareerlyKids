# 🔐 Authentication System Guide

A complete guide to understanding how authentication works in your application.

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [The Big Picture](#the-big-picture)
3. [Core Concepts](#core-concepts)
4. [How Authentication Works](#how-authentication-works)
5. [Services Explained](#services-explained)
6. [Endpoints Guide](#endpoints-guide)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Common Scenarios](#common-scenarios)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What is this system?

Your app uses **Clerk** for authentication (login/signup) and maintains its own **database** for user data. Think of it like this:

- **Clerk** = Your security guard (handles passwords, tokens, login)
- **Your Database** = Your filing cabinet (stores user profiles, relationships)

### Why two systems?

1. **Clerk** is an expert at security - let them handle the hard stuff
2. **Your Database** lets you build features - join users with posts, courses, etc.
3. **Together** they give you both security and flexibility

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                             │
└─────────────────────────────────────────────────────────────────┘

1. 👤 User signs up
   ↓
   Clerk creates account → Webhook → Your DB creates profile
   
2. 🔑 User logs in
   ↓
   Clerk verifies password → Returns JWT token → User saves token
   
3. 📱 User makes API request
   ↓
   Sends token → Your app verifies → Checks DB → Returns data
   
4. ✏️ User updates profile
   ↓
   Your app updates Clerk → Updates DB → Logs change
   
5. 🗑️ User deletes account
   ↓
   Your app tells Clerk → Webhook → Your DB soft-deletes
```

---

## Core Concepts

### 1. **Clerk = Source of Truth**

Clerk owns:
- Email/password
- Authentication tokens (JWT)
- Login sessions
- Basic profile (firstName, lastName)
- Custom metadata (school, grade, bio, dateOfBirth)

**Rule:** Always update Clerk first, then mirror to your database.

### 2. **Your Database = Application Data**

Your database stores:
- User profiles (mirrored from Clerk)
- Relationships (posts, enrollments, courses)
- Foreign keys (userId references)
- Application-specific fields (phoneNumber, status)

**Rule:** Database follows Clerk, never leads.

### 3. **Webhooks = Sync Mechanism**

When something happens in Clerk (signup, update, delete), Clerk sends you a webhook:

```
Clerk Event → Webhook → Your App → Database Update
```

**This keeps everything in sync automatically.**

### 4. **JWT Tokens = Proof of Identity**

When a user logs in via Clerk, they get a JWT token:

```
User Login → Clerk → JWT Token → User stores it → Sends with every request
```

Your app verifies this token on every protected request.

---

## How Authentication Works

### Step-by-Step: User Signs Up

```
1. User fills signup form in your frontend
   ↓
2. Frontend calls Clerk signup API
   ↓
3. Clerk creates user account
   ↓
4. Clerk sends "user.created" webhook to your backend
   ↓
5. Your backend receives webhook
   ↓
6. WebhookHandlerService creates user in database
   ↓
7. User now exists in both Clerk and your database
```

**Key Files:**
- `auth.controller.ts` → Receives webhook
- `webhook-handler.service.ts` → Creates database record
- `webhook-idempotency.service.ts` → Prevents duplicates

### Step-by-Step: User Logs In

```
1. User enters email/password in your frontend
   ↓
2. Frontend calls Clerk login API
   ↓
3. Clerk verifies credentials
   ↓
4. Clerk returns JWT token (valid for 1 hour by default)
   ↓
5. Frontend stores token (localStorage/cookie)
   ↓
6. Frontend sends token with every API request
```

**Key Point:** Your backend never sees the password!

### Step-by-Step: User Makes API Request

```
1. Frontend sends request with token:
   Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ↓
2. Your backend receives request
   ↓
3. ClerkStrategy (Passport guard) intercepts
   ↓
4. Verifies token with Clerk
   ↓
5. Looks up user in database
   ↓
6. Attaches user to request object
   ↓
7. Controller handler runs with authenticated user
```

**Key Files:**
- `clerk.strategy.ts` → Verifies token
- `jwt-auth.guard.ts` → Protects routes
- `current-user.decorator.ts` → Extracts user from request

### Step-by-Step: User Updates Profile

```
1. User submits profile update form
   ↓
2. Frontend calls PATCH /api/v2/auth/profile
   ↓
3. ProfileUpdateService validates changes
   ↓
4. Updates Clerk first (source of truth)
   ↓
5. If Clerk succeeds → Updates database
   ↓
6. If Clerk fails → Stops (database not touched)
   ↓
7. If database fails → Rolls back Clerk update
   ↓
8. Logs change in audit table
```

**Key Files:**
- `auth.controller.ts` → Receives request
- `profile-update.service.ts` → Handles update logic
- `audit.service.ts` → Records changes

### Step-by-Step: User Deletes Account

```
1. User clicks "Delete Account"
   ↓
2. Frontend calls DELETE /api/v2/auth/account
   ↓
3. AccountDeletionService calls Clerk delete API
   ↓
4. Clerk deletes user
   ↓
5. Clerk sends "user.deleted" webhook
   ↓
6. WebhookHandlerService soft-deletes in database
   ↓
7. User marked as INACTIVE, not permanently deleted
```

**Key Files:**
- `account-deletion.service.ts` → Triggers Clerk deletion
- `webhook-handler.service.ts` → Handles cleanup

---

## Services Explained

### 1. **AuthService** (Main Orchestrator)

**Location:** `auth.service.ts`

**What it does:**
- Coordinates all auth operations
- Delegates to specialized services
- Handles webhook events
- Manages dev utilities

**Methods:**
- `handleUserCreated()` - Webhook: New user signup
- `handleUserUpdated()` - Webhook: User profile change
- `handleUserDeleted()` - Webhook: User account deletion
- `updateProfile()` - User updates their profile
- `deleteAccount()` - User deletes their account
- `generateTestToken()` - DEV: Create test tokens
- `createSuperAdmin()` - DEV: Create admin users

**Think of it as:** The receptionist who directs you to the right department.

---

### 2. **ClerkStrategy** (Token Validator)

**Location:** `clerk.strategy.ts`

**What it does:**
- Intercepts every protected API request
- Verifies JWT token with Clerk
- Looks up user in database
- Attaches user to request

**Flow:**
```
Request → Extract token → Verify with Clerk → Lookup DB → Attach user
```

**Think of it as:** The bouncer checking IDs at the door.

---

### 3. **WebhookHandlerService** (Sync Manager)

**Location:** `services/webhook-handler.service.ts`

**What it does:**
- Receives events from Clerk
- Creates/updates/deletes users in database
- Prevents duplicate processing (idempotency)

**Handles:**
- `user.created` - New signup
- `user.updated` - Profile change in Clerk
- `user.deleted` - Account deletion

**Think of it as:** The messenger who keeps both offices in sync.

---

### 4. **ProfileUpdateService** (Update Manager)

**Location:** `services/profile-update.service.ts`

**What it does:**
- Handles profile updates
- Updates Clerk first (source of truth)
- Mirrors changes to database
- Rolls back on failure
- Logs all changes

**Key Features:**
- **Normalization:** Converts dates, validates input
- **Type Safety:** Strong typing, no `any`
- **Rollback:** Reverts Clerk if database fails
- **Audit Trail:** Records who, what, when, where

**Think of it as:** The editor who makes sure changes are published correctly.

---

### 5. **AccountDeletionService** (Deletion Manager)

**Location:** `services/account-deletion.service.ts`

**What it does:**
- Triggers account deletion in Clerk
- Logs deletion request
- Webhook handles database cleanup

**Why separate?**
- Deletion is critical - deserves its own service
- Clean separation of concerns
- Easy to add deletion logic later (export data, notify users, etc.)

**Think of it as:** The specialist who handles account closures.

---

### 6. **ProfileReconciliationService** (Drift Detector)

**Location:** `services/profile-reconciliation.service.ts`

**What it does:**
- Runs periodic checks (every 10 minutes)
- Detects differences between Clerk and database
- Automatically fixes mismatches
- Alerts on high drift rates

**Why needed?**
- Network issues might cause missed webhooks
- Manual changes in Clerk dashboard
- Race conditions in updates

**Think of it as:** The auditor who makes sure records match.

---

### 7. **DevUtilitiesService** (Testing Tools)

**Location:** `services/dev-utilities.service.ts`

**What it does:**
- Generates test tokens for Swagger/Postman
- Creates super admin accounts
- Only works in development mode

**Methods:**
- `generateTestToken()` - Create long-lived JWT for testing
- `createSuperAdmin()` - Create admin users

**Think of it as:** The workshop where you build test tools.

---

### 8. **WebhookIdempotencyService** (Duplicate Prevention)

**Location:** `services/webhook-idempotency.service.ts`

**What it does:**
- Tracks webhook events by ID
- Prevents processing duplicates
- Uses database unique constraint

**Why needed?**
Clerk might send the same webhook twice if:
- Network timeout (retries)
- Your server restart
- Webhook delivery issues

**Think of it as:** The stamp that marks "already processed."

---

### 9. **AuditService** (Change Logger)

**Location:** `audit/audit.service.ts` (imported)

**What it does:**
- Records all profile changes
- Tracks who made changes
- Stores when and where (IP, timestamp)

**Used by:**
- ProfileUpdateService
- AccountDeletionService
- WebhookHandlerService

**Think of it as:** The security camera recording everything.

---

## Endpoints Guide

### 🔓 Public Endpoints (No Authentication)

#### 1. `POST /api/v2/auth/webhook/clerk`

**Purpose:** Receive webhooks from Clerk

**What happens:**
1. Clerk sends event (user.created, user.updated, user.deleted)
2. Your app verifies signature (security)
3. Processes event (create/update/delete user)
4. Returns success

**Used by:** Clerk (automatic)

**Security:** Svix signature verification

---

#### 2. `POST /api/v2/auth/dev/generate-token` (DEV ONLY)

**Purpose:** Generate test JWT tokens

**What happens:**
1. You provide user email
2. Service finds user in Clerk
3. Creates/finds active session
4. Generates JWT token (10-year expiry)
5. Returns token for Swagger/Postman

**Used by:** Developers testing API

**Example:**
```json
POST /api/v2/auth/dev/generate-token
{
  "email": "student@test.com",
  "templateName": "api-testing"
}

Response:
{
  "token": "eyJhbGci...",
  "howToUse": {
    "swagger": "Click 'Authorize' and paste token"
  }
}
```

---

#### 3. `POST /api/v2/auth/dev/create-super-admin` (DEV ONLY)

**Purpose:** Create admin users

**What happens:**
1. Creates user in Clerk with SUPER_ADMIN role
2. Creates user in database
3. Returns credentials

**Used by:** System setup, testing

**Example:**
```json
POST /api/v2/auth/dev/create-super-admin
{
  "email": "admin@test.com",
  "password": "Admin123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

---

### 🔒 Protected Endpoints (Requires Authentication)

#### 4. `GET /api/v2/auth/me`

**Purpose:** Get current user profile

**What happens:**
1. ClerkStrategy verifies JWT token
2. Looks up user in database
3. Returns user profile

**Used by:** Frontend to load user data

**Example:**
```http
GET /api/v2/auth/me
Authorization: Bearer eyJhbGci...

Response:
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "email": "student@test.com",
    "firstName": "John",
    "role": "STUDENT",
    ...
  }
}
```

---

#### 5. `PATCH /api/v2/auth/profile`

**Purpose:** Update user profile

**What happens:**
1. Validates input (dates, fields)
2. Updates Clerk (firstName, lastName, metadata)
3. Updates database (all fields including phoneNumber)
4. Logs change in audit table
5. On failure: Rolls back Clerk update

**Used by:** Frontend profile settings

**Example:**
```http
PATCH /api/v2/auth/profile
Authorization: Bearer eyJhbGci...
{
  "firstName": "Jane",
  "school": "New School",
  "grade": "Grade 11"
}

Response:
{
  "success": true,
  "data": { ...updated user... },
  "message": "Profile updated successfully"
}
```

**Fields you can update:**
- `firstName` - Stored in Clerk + DB
- `lastName` - Stored in Clerk + DB
- `phoneNumber` - Stored in DB only
- `school` - Stored in Clerk metadata + DB
- `grade` - Stored in Clerk metadata + DB
- `bio` - Stored in Clerk metadata + DB
- `dateOfBirth` - Stored in Clerk metadata + DB (as ISO string)

---

#### 6. `DELETE /api/v2/auth/account`

**Purpose:** Delete user account

**What happens:**
1. Deletes user from Clerk
2. Logs deletion request
3. Clerk sends webhook
4. Webhook soft-deletes in database (INACTIVE status)

**Used by:** User account settings

**Example:**
```http
DELETE /api/v2/auth/account
Authorization: Bearer eyJhbGci...

Response:
{
  "success": true,
  "message": "Account deletion requested. Cleanup will complete shortly."
}
```

**Note:** Database cleanup happens via webhook (async)

---

## Data Flow Diagrams

### Flow 1: User Signup

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ 1. POST /signup (email, password)
       ↓
┌─────────────┐
│    Clerk    │ ← User created here first
└──────┬──────┘
       │ 2. Webhook: user.created
       ↓
┌─────────────────────┐
│  Your Backend       │
│  (Webhook Endpoint) │
└──────┬──────────────┘
       │ 3. Verify signature
       ↓
┌─────────────────────┐
│  WebhookHandler     │
│  Service            │
└──────┬──────────────┘
       │ 4. Check idempotency
       ↓
┌─────────────┐
│  Database   │ ← User profile created
└─────────────┘
```

---

### Flow 2: Protected API Request

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ 1. GET /api/v2/auth/me
       │    Authorization: Bearer <token>
       ↓
┌─────────────────────┐
│  Your Backend       │
│  (Auth Guard)       │
└──────┬──────────────┘
       │ 2. Extract token
       ↓
┌─────────────────────┐
│  ClerkStrategy      │
└──────┬──────────────┘
       │ 3. Verify with Clerk
       ↓
┌─────────────┐
│    Clerk    │ ← Token validated
└──────┬──────┘
       │ 4. Token valid ✓
       ↓
┌─────────────────────┐
│  ClerkStrategy      │
└──────┬──────────────┘
       │ 5. Lookup user in DB
       ↓
┌─────────────┐
│  Database   │ ← User profile fetched
└──────┬──────┘
       │ 6. Return user data
       ↓
┌─────────────────────┐
│  Controller         │
│  (Handler)          │
└──────┬──────────────┘
       │ 7. Business logic
       ↓
┌─────────────┐
│   Frontend  │ ← Response returned
└─────────────┘
```

---

### Flow 3: Profile Update

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ 1. PATCH /profile { firstName: "Jane" }
       ↓
┌─────────────────────┐
│  ProfileUpdate      │
│  Service            │
└──────┬──────────────┘
       │ 2. Normalize & validate
       ↓
       │ 3. Update Clerk first
       ↓
┌─────────────┐
│    Clerk    │ ← Source of truth updated
└──────┬──────┘
       │ 4. Success ✓
       ↓
┌─────────────────────┐
│  ProfileUpdate      │
│  Service            │
└──────┬──────────────┘
       │ 5. Update database
       ↓
┌─────────────┐
│  Database   │ ← Mirror updated
└──────┬──────┘
       │ 6. Success ✓
       ↓
┌─────────────────────┐
│  AuditService       │
└──────┬──────────────┘
       │ 7. Log change
       ↓
┌─────────────┐
│  Database   │ ← Audit record created
│ (audit log) │
└──────┬──────┘
       │ 8. Return updated user
       ↓
┌─────────────┐
│   Frontend  │
└─────────────┘

If step 5 fails:
       ↓
┌─────────────────────┐
│  ProfileUpdate      │
│  Service            │
└──────┬──────────────┘
       │ Rollback Clerk (3 retries)
       ↓
┌─────────────┐
│    Clerk    │ ← Reverted to original
└─────────────┘
```

---

### Flow 4: Account Deletion

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ 1. DELETE /account
       ↓
┌─────────────────────┐
│  AccountDeletion    │
│  Service            │
└──────┬──────────────┘
       │ 2. Delete from Clerk
       ↓
┌─────────────┐
│    Clerk    │ ← User deleted
└──────┬──────┘
       │ 3. Webhook: user.deleted
       ↓
┌─────────────────────┐
│  WebhookHandler     │
│  Service            │
└──────┬──────────────┘
       │ 4. Soft delete in DB
       ↓
┌─────────────┐
│  Database   │ ← Status: INACTIVE
└──────┬──────┘
       │ 5. Audit log
       ↓
┌─────────────┐
│  Database   │
│ (audit log) │
└─────────────┘
```

---

## Common Scenarios

### Scenario 1: "User profile not yet synchronized"

**Symptom:**
User just signed up, tries to login, gets error:
```
"User profile not yet synchronized. Please try again in a moment."
```

**What happened:**
1. User signed up in Clerk ✓
2. Webhook hasn't been delivered yet ⏳
3. Your database doesn't have user yet ✗

**Solution:**
- User waits 2-3 seconds and retries
- Webhook arrives and creates database record
- Next login succeeds ✓

**Why it happens:**
Webhooks are async - there's a tiny delay (usually < 1 second)

---

### Scenario 2: Duplicate webhook events

**Symptom:**
Webhook logs show:
```
"Skipping duplicate user.created event: evt_123"
```

**What happened:**
Clerk sent the same webhook twice (network retry)

**Solution:**
WebhookIdempotencyService detects duplicate and skips it

**Why it works:**
Each webhook has unique `svix-id` stored in database with unique constraint

---

### Scenario 3: Profile update fails

**Symptom:**
User updates profile, gets error, but some fields changed

**What happened:**
1. Clerk update succeeded ✓
2. Database update failed ✗
3. Rollback attempted ✓
4. Clerk reverted to original ✓

**Solution:**
System automatically rolled back Clerk to maintain consistency

**Logs show:**
```
⚠️ SYNC FAILURE: Clerk updated but DB failed for user clerk_123
✅ Clerk rollback successful
```

---

### Scenario 4: Data drift detected

**Symptom:**
Reconciliation logs show:
```
⚠️ Drift detected for user clerk_123:
  firstName: "John" → "Jane"
```

**What happened:**
Someone manually changed user in Clerk dashboard, but database wasn't updated

**Solution:**
ProfileReconciliationService automatically updates database to match Clerk

**Runs:** Every 10 minutes (automatic)

---

## Troubleshooting

### Problem: "Invalid or expired token"

**Possible causes:**
1. Token expired (default: 1 hour)
2. User was deleted
3. Clock skew between server and Clerk

**Solutions:**
1. Frontend should refresh token before expiry
2. User needs to log in again
3. Check server time is synchronized

---

### Problem: "Webhook signature verification failed"

**Possible causes:**
1. Wrong `CLERK_WEBHOOK_SECRET` in .env
2. Clerk dashboard webhook URL incorrect
3. Request body was modified

**Solutions:**
1. Copy correct secret from Clerk dashboard
2. Verify webhook URL matches your endpoint
3. Check middleware isn't parsing body as JSON (needs raw body)

---

### Problem: "User not found in database"

**Possible causes:**
1. Webhook not delivered yet (< 1 second)
2. Webhook failed to process
3. User created manually in Clerk (not via signup)

**Solutions:**
1. User retries after 2 seconds
2. Check webhook logs for errors
3. Use reconciliation service to sync

---

### Problem: "Rollback failed after database error"

**Symptom:**
Logs show:
```
❌ CRITICAL: Rollback failed for user clerk_123. Manual reconciliation required.
```

**What to do:**
1. Check reconciliation logs for details
2. Run manual reconciliation:
   ```
   POST /admin/reconcile/clerk_123
   ```
3. Or wait for periodic reconciliation (every 10 minutes)

---

## Best Practices

### 1. Always Update Clerk First

```typescript
// ✅ CORRECT
await clerkClient.users.updateUser(clerkId, updates);
await database.user.update({ where: { clerkId }, data: updates });

// ❌ WRONG
await database.user.update({ where: { clerkId }, data: updates });
await clerkClient.users.updateUser(clerkId, updates);
```

**Why:** Clerk is source of truth. If Clerk fails, database shouldn't change.

---

### 2. Never Store Passwords

```typescript
// ❌ NEVER DO THIS
const user = {
  email: 'test@test.com',
  password: 'secret123', // ← Never store this!
};
```

**Why:** Clerk handles passwords. Your app never sees them.

---

### 3. Always Use Webhooks for Sync

```typescript
// ✅ CORRECT - Let webhook handle DB creation
// User signs up → Clerk creates → Webhook creates DB record

// ❌ WRONG - Don't create DB record on signup endpoint
// User signs up → Your app creates in Clerk AND DB
```

**Why:** Webhooks are reliable, automatic, and idempotent.

---

### 4. Use RequestContext for Audit Logs

```typescript
// ✅ CORRECT
@Patch('profile')
async updateProfile(
  @CurrentUser() user,
  @Body() dto,
  @RequestContext() context, // ← Includes requestId, ipAddress
) {
  await service.updateProfile(user.clerkId, dto, user.id, context.requestId, context.ipAddress);
}

// ❌ WRONG - Missing audit trail
async updateProfile(@CurrentUser() user, @Body() dto) {
  await service.updateProfile(user.clerkId, dto, user.id);
}
```

---

### 5. Handle Rollback Failures

```typescript
// ✅ CORRECT - Log critical errors
if (!rollbackSuccess) {
  logger.error('CRITICAL: Manual reconciliation required', {
    clerkId,
    attemptedChanges,
    originalState,
  });
}

// ❌ WRONG - Silent failure
if (!rollbackSuccess) {
  // Nothing logged, data inconsistent forever
}
```

---

## Security Considerations

### 1. Token Verification

**How it works:**
- Every protected request → ClerkStrategy verifies token with Clerk
- Invalid/expired tokens → Rejected immediately
- No database lookup until token is valid

### 2. Webhook Signature Verification

**How it works:**
- Clerk signs webhooks with secret key (Svix)
- Your app verifies signature before processing
- Invalid signatures → Rejected (logs warning)

### 3. Soft Deletes

**Why:**
- User accounts marked INACTIVE, not deleted permanently
- Preserves audit trail and relationships
- Can recover accounts if needed

### 4. Audit Logging

**What's logged:**
- Who made the change (userId)
- What changed (fields)
- When (timestamp)
- Where (IP address, requestId)

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Authentication Success Rate**
   - Target: > 99%
   - Alert if: < 95%

2. **Webhook Processing Time**
   - Target: < 500ms
   - Alert if: > 2 seconds

3. **Rollback Frequency**
   - Target: < 1 per day
   - Alert if: > 5 per hour

4. **Drift Detection Rate**
   - Target: 0 users
   - Alert if: > 10 users

5. **Token Verification Time**
   - Target: < 200ms
   - Alert if: > 1 second

---

## Summary

### Key Takeaways

1. **Clerk is the boss** - Always update Clerk first
2. **Webhooks keep things in sync** - Automatic, reliable
3. **Database follows Clerk** - Mirror, never lead
4. **Rollback prevents chaos** - If something fails, revert
5. **Reconciliation fixes drift** - Periodic checks and repairs
6. **Audit logs everything** - Who, what, when, where

### Architecture Principles

1. **Single Source of Truth** - Clerk owns authentication
2. **Eventual Consistency** - Webhooks sync data asynchronously
3. **Best-Effort Rollback** - Try to revert on failures
4. **Idempotency** - Safe to process same event multiple times
5. **Audit Trail** - Every change is logged

### System Guarantees

✅ **We guarantee:**
- User can always log in if Clerk account exists
- Profile changes are logged
- Webhooks prevent data loss
- Rollback attempts on failures

❌ **We cannot guarantee:**
- Zero millisecond sync (webhooks take time)
- 100% rollback success (network issues)
- Perfect consistency at all times (eventual consistency model)

---

## Questions?

Common questions answered:

**Q: Why not just use Clerk's database?**
A: Clerk doesn't support relational data (posts, courses, enrollments). You need your own database.

**Q: Can I skip webhooks and create users directly?**
A: No. Webhooks ensure Clerk and your DB stay in sync automatically.

**Q: What if webhook fails?**
A: Clerk retries for 3 days. ProfileReconciliationService catches missed ones.

**Q: Why soft delete instead of hard delete?**
A: Preserves audit trail, relationships, and allows account recovery.

**Q: Can I change the source of truth to my database?**
A: Not recommended. Clerk is an expert at security. Let them handle it.

---

## Next Steps

1. ✅ Read this guide
2. ✅ Test endpoints in Swagger
3. ✅ Check webhook logs
4. ✅ Monitor reconciliation service
5. ✅ Review audit logs
6. ✅ Set up alerts for critical errors