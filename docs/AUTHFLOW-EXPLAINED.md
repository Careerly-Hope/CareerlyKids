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

Your app uses **Clerk** for authentication (login/signup) and maintains its own **database** for user data.

```
┌──────────────┐         ┌──────────────┐
│    Clerk     │         │  Your  DB    │
│ (Security)   │  sync   │ (Features)   │
└──────────────┘ ──────► └──────────────┘
```

- **Clerk** = Security guard (passwords, tokens, login)
- **Your Database** = Filing cabinet (profiles, relationships)

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────┐
│                    USER JOURNEY                          │
└─────────────────────────────────────────────────────────┘

1. 👤 Signup
   User → Clerk → Webhook → Your DB

2. 🔑 Login  
   User → Clerk → JWT Token → Store

3. 📱 API Request
   Token → Verify → DB Lookup → Response

4. ✏️ Update Profile
   Request → Clerk First → DB Mirror → Audit

5. 🗑️ Delete Account
   Request → Clerk Delete → Webhook → Soft Delete DB
```

---

## Core Concepts

### 1. Clerk = Source of Truth

```
┌─────────────────────────────────────────────┐
│           CLERK OWNS                        │
├─────────────────────────────────────────────┤
│ • Email/Password                            │
│ • JWT Tokens                                │
│ • Login Sessions                            │
│ • firstName, lastName (built-in)            │
│ • publicMetadata (school, grade, bio, dob)  │
└─────────────────────────────────────────────┘
```

**Rule:** Always update Clerk first, then mirror to database.

---

### 2. Database = Application Data

```
┌─────────────────────────────────────────────┐
│         YOUR DATABASE STORES                │
├─────────────────────────────────────────────┤
│ • User profiles (mirrored from Clerk)       │
│ • Relationships (posts, courses)            │
│ • Foreign keys (userId references)          │
│ • Application fields (phoneNumber, status)  │
└─────────────────────────────────────────────┘
```

**Rule:** Database follows Clerk, never leads.

---

### 3. Webhooks = Sync Mechanism

```
Clerk Event → Webhook → Your App → Database Update
```

Keeps everything in sync automatically.

---

### 4. JWT Tokens = Proof of Identity

```
User Login → Clerk → JWT → User Stores → Sends with Requests
```

---

## How Authentication Works

### Step-by-Step: User Signs Up

```
┌─────────┐
│Frontend │ 1. POST /signup
└────┬────┘
     │
     ▼
┌─────────┐
│ Clerk   │ 2. Create user ✓
└────┬────┘
     │ 3. Webhook: user.created
     ▼
┌─────────────┐
│Your Backend │ 4. Verify signature
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Database   │ 5. Create profile ✓
└─────────────┘
```

---

### Step-by-Step: User Logs In

```
┌─────────┐
│Frontend │ 1. POST /login (email, password)
└────┬────┘
     │
     ▼
┌─────────┐
│ Clerk   │ 2. Verify credentials ✓
└────┬────┘
     │ 3. Return JWT token
     ▼
┌─────────┐
│Frontend │ 4. Store token
└─────────┘    5. Send with every request
```

---

### Step-by-Step: Protected API Request

```
┌─────────┐
│Frontend │ 1. GET /api/v2/auth/me + token
└────┬────┘
     │
     ▼
┌──────────────┐
│ClerkStrategy │ 2. Extract & verify token
└──────┬───────┘
       │ 3. Valid? ✓
       ▼
┌──────────────┐
│  Database    │ 4. Lookup user
└──────┬───────┘
       │ 5. Attach to request
       ▼
┌──────────────┐
│ Controller   │ 6. Process request
└──────┬───────┘
       │
       ▼
┌─────────┐
│Frontend │ 7. Return response
└─────────┘
```

---

### Step-by-Step: Profile Update (NEW FLOW)

```
┌─────────┐
│Frontend │ 1. PATCH /profile {firstName: "Jane"}
└────┬────┘
     │
     ▼
┌──────────────────┐
│ProfileUpdate     │ 2. Normalize & validate
│Service           │
└────┬─────────────┘
     │
     │ 3. Fetch current state
     ├─────────────┬─────────────┐
     ▼             ▼             ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│  Clerk  │   │Database │   │ Merge   │
│  State  │   │  State  │   │Metadata │
└────┬────┘   └────┬────┘   └────┬────┘
     │             │             │
     └─────────────┴─────────────┘
                   │
                   ▼
           ┌──────────────┐
           │Prepare Clerk │ 4. Build updates
           │Updates with  │    (merge metadata)
           │Merge         │
           └──────┬───────┘
                  │
                  ▼
           ┌──────────────┐
           │    Clerk     │ 5. Update ✓
           └──────┬───────┘
                  │ Success
                  ▼
           ┌──────────────┐
           │  Database    │ 6. Mirror ✓
           └──────┬───────┘
                  │ Success
                  ▼
           ┌──────────────┐
           │ AuditLog     │ 7. Record change ✓
           └──────┬───────┘
                  │
                  ▼
           ┌──────────────┐
           │   Response   │
           └──────────────┘

IF Database Fails:
           ┌──────────────┐
           │  Database    │ ❌ Error
           └──────┬───────┘
                  │
                  ▼
           ┌──────────────┐
           │Rollback Clerk│ 8. Revert to
           │(3 retries)   │    original state
           └──────┬───────┘
                  │
                  ▼
           ┌──────────────┐
           │    Clerk     │ ✓ Reverted
           └──────────────┘
```

---

### Step-by-Step: Account Deletion

```
┌─────────┐
│Frontend │ 1. DELETE /account
└────┬────┘
     │
     ▼
┌─────────────┐
│   Clerk     │ 2. Delete user ✓
└──────┬──────┘
       │ 3. Webhook: user.deleted
       ▼
┌─────────────┐
│Your Backend │ 4. Process webhook
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Database   │ 5. Soft delete
│             │    status = INACTIVE
│             │    deletedAt = now()
└─────────────┘
```

---

## Services Explained

### 1. AuthService (Orchestrator)

```
┌────────────────────────────────────────┐
│          AuthService                   │
├────────────────────────────────────────┤
│ • handleUserCreated()                  │
│ • handleUserUpdated()                  │
│ • handleUserDeleted()                  │
│ • updateProfile()                      │
│ • deleteAccount()                      │
│ • generateTestToken() [DEV]           │
│ • createSuperAdmin() [DEV]            │
└────────────────────────────────────────┘
         │
         ├─► WebhookHandlers
         ├─► ProfileUpdateService
         ├─► AccountDeletionService
         └─► DevUtilities
```

---

### 2. ClerkStrategy (Token Validator)

```
Request
  │
  ▼
┌───────────────┐
│Extract Token  │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│Verify w/Clerk │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│Lookup DB User │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│Attach to Req  │ ✓ user.dbUser
└───────────────┘
```

**Rule:** READ-ONLY - Never creates users

---

### 3. ProfileUpdateService (NEW - Update Manager)

```
┌─────────────────────────────────────────────┐
│      ProfileUpdateService Flow              │
└─────────────────────────────────────────────┘

Input: UpdateProfileDto
  │
  ▼
┌─────────────────┐
│1. Normalize     │ Convert dates, validate
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│2. Fetch State   │ Parallel: Clerk + DB
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│3. Prepare       │ Merge with existing
│   Clerk Updates │ Clerk metadata
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│4. Update Clerk  │ Source of truth
└────────┬────────┘
         │ ✓
         ▼
┌─────────────────┐
│5. Update DB     │ Mirror Clerk
└────────┬────────┘
         │ ✓
         ▼
┌─────────────────┐
│6. Audit Log     │ Record change
└─────────────────┘

IF DB Fails:
         │
         ▼
┌─────────────────┐
│7. Rollback      │ Revert Clerk to
│   Clerk         │ pre-update state
│   (3 retries)   │ (uses Clerk snapshot)
└─────────────────┘
```

**Key Features:**
- ✅ Metadata merging (preserves unrelated fields)
- ✅ Rollback uses Clerk state (not stale DB)
- ✅ Type-safe normalization
- ✅ Comprehensive audit trail

---

### 4. WebhookIdempotencyService

```
┌──────────────────────────────────────┐
│   Webhook arrives                    │
│   svix-id: evt_abc123                │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│   Try INSERT webhook_events          │
│   eventId = 'evt_abc123'             │
└────────────────┬─────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌───────────┐      ┌──────────────┐
│ Success   │      │ Duplicate    │
│ (new evt) │      │ (P2002)      │
└─────┬─────┘      └──────┬───────┘
      │                   │
      ▼                   ▼
 Process          Skip & Return 200
```

---

### 5. AuditService

```
┌─────────────────────────────────────┐
│        Audit Log Entry              │
├─────────────────────────────────────┤
│ userId:     "uuid-123"              │
│ action:     "PROFILE_UPDATED"       │
│ metadata:   {firstName: "Jane"}     │
│ ipAddress:  "192.168.1.1"           │
│ requestId:  "req_abc123"            │
│ timestamp:  2026-01-08T14:30:00Z    │
└─────────────────────────────────────┘
```

---

## Endpoints Guide

### 🔓 Public Endpoints

#### 1. `POST /api/v2/auth/webhook/clerk`

```
Clerk → [Webhook] → Your App

Verifies:
  ✓ Signature (svix)
  ✓ Idempotency (no duplicates)
  
Handles:
  • user.created
  • user.updated
  • user.deleted
```

---

#### 2. `POST /api/v2/auth/dev/generate-token` [DEV]

```
Input:
{
  "email": "student@test.com",
  "templateName": "api-testing"
}

Output:
{
  "token": "eyJhbGci...",
  "expiresAt": "2036-01-08T00:00:00Z"
}
```

---

#### 3. `POST /api/v2/auth/dev/create-super-admin` [DEV]

```
Input:
{
  "email": "admin@test.com",
  "password": "Admin123!",
  "firstName": "John",
  "lastName": "Doe"
}

Creates in:
  ✓ Clerk (with SUPER_ADMIN metadata)
  ✓ Database (role = SUPER_ADMIN)
```

---

### 🔒 Protected Endpoints

#### 4. `GET /api/v2/auth/me`

```
Request:
  GET /api/v2/auth/me
  Authorization: Bearer <token>

Response:
{
  "status": "success",
  "data": {
    "id": "uuid-123",
    "clerkId": "user_abc",
    "email": "student@test.com",
    "firstName": "John",
    "role": "STUDENT",
    ...
  }
}
```

---

#### 5. `PATCH /api/v2/auth/profile`

```
Request:
  PATCH /api/v2/auth/profile
  Authorization: Bearer <token>
  {
    "firstName": "Jane",
    "school": "New School",
    "bio": "Updated bio"
  }

Flow:
  1. Normalize input ✓
  2. Fetch Clerk + DB state ✓
  3. Merge with existing metadata ✓
  4. Update Clerk ✓
  5. Update DB ✓
  6. Audit log ✓

Response:
{
  "status": "success",
  "data": {...updated user...}
}
```

**Fields you can update:**

| Field | Stored In | Notes |
|-------|-----------|-------|
| `firstName` | Clerk + DB | Built-in Clerk field |
| `lastName` | Clerk + DB | Built-in Clerk field |
| `phoneNumber` | DB only | Not in Clerk |
| `school` | Clerk metadata + DB | Custom field |
| `grade` | Clerk metadata + DB | Custom field |
| `bio` | Clerk metadata + DB | Custom field |
| `dateOfBirth` | Clerk metadata + DB | ISO string in Clerk |

---

#### 6. `DELETE /api/v2/auth/account`

```
Request:
  DELETE /api/v2/auth/account
  Authorization: Bearer <token>

Flow:
  1. Delete from Clerk ✓
  2. Clerk sends webhook
  3. Webhook soft-deletes DB

Response:
{
  "status": "success",
  "message": "Account deletion requested. Cleanup will complete shortly."
}
```

**Note:** Async cleanup via webhook (soft delete)

---

## Data Flow Diagrams

### Profile Update with Metadata Merge

```
┌────────────────────────────────────────────────────────┐
│         BEFORE UPDATE (Clerk State)                    │
├────────────────────────────────────────────────────────┤
│ firstName: "John"                                      │
│ publicMetadata: {                                      │
│   school: "Old School",                                │
│   grade: "Grade 10",                                   │
│   customField: "preserve-me"  ← Not in update         │
│ }                                                      │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│         UPDATE REQUEST                                 │
├────────────────────────────────────────────────────────┤
│ {                                                      │
│   firstName: "Jane",                                   │
│   school: "New School"                                 │
│ }                                                      │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│         MERGE LOGIC                                    │
├────────────────────────────────────────────────────────┤
│ 1. Start with existing metadata:                      │
│    {...existingMetadata}                              │
│                                                        │
│ 2. Overlay changed fields:                            │
│    school: "New School"                               │
│                                                        │
│ 3. Result:                                            │
│    {                                                   │
│      school: "New School",        ← Updated           │
│      grade: "Grade 10",           ← Preserved         │
│      customField: "preserve-me"   ← Preserved         │
│    }                                                   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│         AFTER UPDATE (Clerk State)                     │
├────────────────────────────────────────────────────────┤
│ firstName: "Jane"             ← Updated                │
│ publicMetadata: {                                      │
│   school: "New School",       ← Updated                │
│   grade: "Grade 10",          ← Preserved              │
│   customField: "preserve-me"  ← Preserved              │
│ }                                                      │
└────────────────────────────────────────────────────────┘
```

---

### Rollback Flow (Database Failure)

```
┌────────────────────────────────────────────────────────┐
│         1. INITIAL STATE                               │
├────────────────────────────────────────────────────────┤
│ Clerk:    firstName = "John"                           │
│ Database: firstName = "John"                           │
└────────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│         2. UPDATE CLERK ✓                              │
├────────────────────────────────────────────────────────┤
│ Clerk:    firstName = "Jane"   (UPDATED)               │
│ Database: firstName = "John"   (unchanged)             │
└────────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│         3. UPDATE DATABASE ❌                          │
├────────────────────────────────────────────────────────┤
│ Error: Connection timeout                              │
│ Systems now out of sync!                               │
└────────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│         4. ROLLBACK CLERK (3 retries)                  │
├────────────────────────────────────────────────────────┤
│ Read from: clerkUserBeforeUpdate                       │
│   firstName: "John"         ← Original Clerk state     │
│   publicMetadata: {...}     ← Original metadata        │
│                                                        │
│ Restore to Clerk ✓                                     │
└────────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│         5. FINAL STATE (Consistent)                    │
├────────────────────────────────────────────────────────┤
│ Clerk:    firstName = "John"   (REVERTED)              │
│ Database: firstName = "John"   (unchanged)             │
│                                                        │
│ ✓ Both systems in sync                                 │
└────────────────────────────────────────────────────────┘
```

**Key:** Rollback uses Clerk's pre-update snapshot, not DB state (which may be stale).

---

## Common Scenarios

### Scenario 1: "User profile not yet synchronized"

```
Timeline:
  t=0ms:   User signs up in Clerk ✓
  t=50ms:  User tries to login
  t=100ms: Error: "Profile not synchronized"
  t=200ms: Webhook arrives ✓
  t=250ms: User retries login ✓
```

**Solution:** User waits 2-3 seconds and retries.

---

### Scenario 2: Duplicate webhook

```
┌──────────────────────────────────────┐
│ Webhook #1: evt_abc123               │
│ → Process → Insert to DB ✓           │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Webhook #2: evt_abc123 (retry)       │
│ → Try Insert → Duplicate detected    │
│ → Skip processing ✓                  │
└──────────────────────────────────────┘
```

---

### Scenario 3: Profile update rollback

```
Update Request
  │
  ├─► Clerk Update ✓ (firstName = "Jane")
  │
  ├─► DB Update ❌ (timeout)
  │
  ├─► Rollback Initiated
  │   └─► Attempt 1: ✓ (Clerk reverted)
  │
  └─► Response: Error (consistent state maintained)
```

---

## Troubleshooting

### Problem: "Invalid or expired token"

**Causes:**
- Token expired (1 hour default)
- User deleted
- Clock skew

**Solutions:**
```
Frontend → Check token expiry → Refresh before 1 hour
User → Re-login if token expired
Server → Verify system time is accurate
```

---

### Problem: "Webhook signature failed"

**Check:**
1. `CLERK_WEBHOOK_SECRET` in `.env`
2. Webhook URL in Clerk dashboard
3. Raw body middleware (not parsed JSON)

---

### Problem: "Rollback failed"

**Log shows:**
```
❌ CRITICAL: Rollback failed for user clerk_123
Manual reconciliation required.
```

**Action:**
```
Wait → Periodic reconciliation runs every 10 min
Check → Audit logs for details
Manual → Update Clerk/DB to match
```

---

## Best Practices

### ✅ DO: Update Clerk First

```typescript
await clerkClient.users.updateUser(clerkId, updates);
await database.user.update({where: {clerkId}, data: updates});
```

### ❌ DON'T: Update DB First

```typescript
// WRONG - DB before Clerk
await database.user.update({where: {clerkId}, data: updates});
await clerkClient.users.updateUser(clerkId, updates);
```

---

### ✅ DO: Merge Metadata

```typescript
const metadataUpdates = {
  ...existingMetadata,  // Preserve
  school: "New School"   // Update
};
```

### ❌ DON'T: Replace Metadata

```typescript
// WRONG - Loses other fields
const metadataUpdates = {
  school: "New School"
};
```

---

### ✅ DO: Use Clerk State for Rollback

```typescript
rollbackUpdates.firstName = clerkUserBeforeUpdate.firstName;
rollbackUpdates.publicMetadata = {...clerkUserBeforeUpdate.publicMetadata};
```

### ❌ DON'T: Use DB State for Rollback

```typescript
// WRONG - DB may be stale
rollbackUpdates.firstName = dbUser.firstName;
```

---

## Summary

### Key Principles

```
┌──────────────────────────────────────┐
│ 1. Clerk = Source of Truth           │
│ 2. Database = Mirror                 │
│ 3. Webhooks = Sync Mechanism         │
│ 4. Always Update Clerk First         │
│ 5. Merge Metadata (Don't Replace)    │
│ 6. Rollback Uses Clerk State         │
│ 7. Audit Everything                  │
└──────────────────────────────────────┘
```

### System Guarantees

✅ **We guarantee:**
- Users can login if Clerk account exists
- Profile changes are audited
- Rollback attempts on DB failures
- Metadata preservation during updates

❌ **We cannot guarantee:**
- Zero-latency sync (webhooks take ~100ms)
- 100% rollback success (network issues)
- Perfect consistency (eventual consistency model)

---

**End of Documentation**