# LeaseSpaces Backend API Documentation

## Overview

This Node.js/Express backend serves the LeaseSpaces property rental platform. It uses **Firebase** for authentication and **Neon (PostgreSQL)** via Prisma for data. Frontends connect via REST over HTTP.

---

## Base URL & Port

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:8080` (or set env **`PORT`** for another port) |
| Production | Your deployed API host — Firebase URLs, Cloud Run, and client `baseURL` rules are documented in **Latest endpoints** (at the end of this file). |

JSON APIs are under **`/api/...`**. See **Latest endpoints** for Firebase path quirks and avoiding double `/api` in clients.

---

## How Frontends Connect

### 1. CORS

- CORS is enabled (`app.use(cors())`), so browsers can call the API from any origin.
- For production, configure allowed origins in `app.ts` if needed.

### 2. Request Format

- **Content-Type**: `application/json` for JSON bodies.
- **Auth**: Protected routes use `Authorization: Bearer <token>` where `<token>` is the **backend JWT** (not the Firebase ID token) after sync.

### 3. Auth Flow (LeaseSpaces)

```
1. User signs in on frontend (Firebase Auth – Google, Email, etc.).
2. Frontend receives Firebase ID token from signInWithCredential / getIdToken().
3. Frontend calls POST /api/auth/sync with header: Authorization: Bearer <firebase_id_token>
   OR POST /api/auth/firebase with body: { idToken, registrationType }.
4. Backend verifies Firebase token, finds/creates user in Neon, returns { user, token } (backend JWT).
5. Frontend stores the backend token and uses it for all other protected API calls:
   Authorization: Bearer <backend_jwt>
```

Mobile / Google behaviour and account linking are described under **Latest endpoints**.

### 4. Protected vs Public Routes

- **Public**: No `Authorization` header; e.g. `GET /api/auth`, `GET /api/properties` (list).
- **Protected**: Require `Authorization: Bearer <backend_jwt>`; e.g. `POST /api/applications`, `GET /api/admin/dashboard`.
- **Admin-only**: Require `Authorization` and a user with `appRole: "admin"`.

### 5. Error Response Format

All errors return JSON in this shape:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": "Optional extra info"
  }
}
```

**Common codes**: `AUTHENTICATION_REQUIRED`, `INVALID_TOKEN`, `INSUFFICIENT_PERMISSIONS`, `RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_SERVER_ERROR`.

---

## API Endpoints Reference

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth` | None | Health check; returns available auth endpoints |
| POST | `/api/auth/firebase` | None | Body: `{ idToken, registrationType?, appRole? }`. Verifies Firebase token, syncs user, returns `{ success, user, token }`. `appRole` ("tenant"\|"landlord") for new users. |
| POST | `/api/auth/sync` | None | Header: `Authorization: Bearer <firebase_id_token>`. Optional body: `{ appRole?: "tenant" \| "landlord" }` for new users. Returns `{ success, user, token }` |
| POST | `/api/auth/otp/request` | None | Body: `{ email }`. Sends a 6-digit OTP to email and stores a 5-minute OTP record. Creates user if missing. |
| POST | `/api/auth/otp/verify` | None | Body: `{ email, otp }`. Verifies OTP, issues backend JWT, returns `onboardingRequired`. |
| POST | `/api/auth/onboarding` | Bearer (backend JWT) | Body: `{ name, surname, role: "tenant"\|"landlord" }`. Completes first-time profile setup after OTP login. |
| POST | `/api/auth/refresh` | Bearer (backend JWT) | Returns new token. |
| POST | `/api/auth/2fa/verify-login` | None | Body: `{ temporaryToken, otp }`. Admin 2FA flow. |

**Registration types**: `GOOGLE`, `FACEBOOK`, `APPLE`, `EMAIL`. Infer from Firebase if omitted.

**Response (success)**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "uid": "firebase_uid",
    "email": "user@example.com",
    "name": "John",
    "surname": "Doe",
    "role": "tenant",
    "twofa_enabled": false,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "token": "backend_jwt_string"
}
```

---

### Properties (`/api/properties`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/properties` | None | List properties with filters |
| GET | `/api/properties/:propertyId` | None | Get single property |
| POST | `/api/properties/search` | None | Body: `{ query?, filters?, sortBy?, sortOrder? }`. Search properties |
| POST | `/api/properties` | Backend JWT or Firebase ID token (`appAuth`) | Create property |
| PUT | `/api/properties/:propertyId` | Backend JWT or Firebase ID token (`appAuth`) | Update property |
| DELETE | `/api/properties/:propertyId` | Backend JWT or Firebase ID token (`appAuth`) | Delete property |

**Query params (GET /properties)**:
- `page`, `limit`, `location`, `minPrice`, `maxPrice`, `propertyType`, `bedrooms`, `bathrooms`, `rentalType`, `amenities`, `sortBy`, `sortOrder`

---

### Applications (`/api/applications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/applications` | Backend JWT or Firebase ID token (`appAuth`) | List current user's applications |
| POST | `/api/applications` | Backend JWT or Firebase ID token (`appAuth`) | Create application |
| PUT | `/api/applications/:applicationId/status` | Backend JWT or Firebase ID token (`appAuth`) | Update status (body: `{ status: "approved" \| "rejected", message? }`) |

**Query params (GET)**: `status`, `page`, `limit`.

---

### Admin (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/dashboard` | Admin + Firebase ID token | Dashboard stats |
| GET | `/api/admin/properties/analytics` | Admin + Firebase ID token | Property analytics (query: `period=7d\|30d\|90d\|1y`) |
| GET | `/api/admin/admin-profile` | Admin + Firebase ID token | Admin profile |
| DELETE | `/api/admin/delete-admin` | Admin + Firebase ID token + OTP | Delete admin (body: `{ otp }`) |
| POST | `/api/admin/login` | None | **Prisma admin login.** Body: `{ username, password }`. Returns JWT or `requires2fa` + `temporaryToken`. |
| POST | `/api/admin/users/admins` | **Super admin only** | Create admin user (Prisma). Body: `{ name, surname, email, password, isSuperAdmin? }` |
| POST | `/api/admin/support/agents` | **Super admin only** | Create support agent. Body: `{ name, email, role?, maxTickets?, isActive? }` |
| GET | `/api/admin/properties` | Admin + backend JWT or Firebase ID token | **Admin properties list** (table view). Supports `q`, `type`, `location`, `minPrice`, `maxPrice`, `moderationStatus`, `availabilityStatus`, `page`, `limit`, `sortBy`, `sortOrder`. Returns UI-shaped rows + pagination. |
| GET | `/api/admin/properties/:propertyId` | Admin + backend JWT or Firebase ID token | **Admin property detail** (modal view). Returns UI-shaped property row. |
| PATCH | `/api/admin/properties/:propertyId/moderation` | Admin + backend JWT or Firebase ID token | **Moderate property**. Body: `{ action: "approve"|"decline"|"flag_for_review"|"set_pending", notes? }`. Notes required when flagging. |
| PATCH | `/api/admin/properties/:propertyId/availability` | Admin + backend JWT or Firebase ID token | **Update availability**. Body: `{ availabilityStatus: "available"|"unavailable"|"occupied" }`. |
| POST | `/api/admin/admin-login` | None | Legacy Firestore admin login |
| POST | `/api/admin/init-2fa` | None | Init 2FA (body: `{ email }`) |
| POST | `/api/admin/enable-2fa` | None | Enable 2FA |
| POST | `/api/admin/verify-otp` | None | Verify OTP |
| GET | `/api/admin/all` | None | List all admins |
| POST | `/api/admin/forgot-password` | None | Forgot password |

**Admin routes**: User must have `appRole: "admin"` in Prisma. `DELETE /delete-admin` also requires `otp` in body when 2FA is enabled. Extended docs for **super admin**, **admin properties (moderation / UI shape)**, **mobile parity**, and **tickets** are in **Latest endpoints** at the end of this file.

---

### Settings (`/api/admin/settings`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/settings/app` | None | Get app settings |
| POST | `/api/admin/settings/app` | None | Save app settings |
| PUT | `/api/admin/settings/app` | None | Update app settings |
| GET | `/api/admin/settings/smtp` | None | Get SMTP config |
| POST | `/api/admin/settings/smtp` | None | Save SMTP config |
| PUT | `/api/admin/settings/smtp` | None | Update SMTP config |
| POST | `/api/admin/settings/smtp/test` | None | Test SMTP connection |
| POST | `/api/admin/settings/upload` | None | Upload file |

---

### Other Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | None | Hello message |
| GET | `/hello` | None | Test route |
| GET | `/test` | None | Test route |
| GET | `/api/examples/all` | None | Example usage |

---

## What Is Missing (vs Spec)

Compared to the original LeaseSpaces API spec, the following are **not implemented**:

### Auth

| Endpoint | Status |
|----------|--------|
| POST `/auth/register` (email/password) | ⚠️ Replaced by manual OTP flow (`/auth/otp/request`, `/auth/otp/verify`, `/auth/onboarding`) |
| POST `/auth/login` (email/password) | ⚠️ Replaced by Firebase sync or manual OTP flow |
| POST `/auth/reset-password` | ❌ Missing |
| POST `/auth/verify-email` | ❌ Missing |

### User Management

| Endpoint | Status |
|----------|--------|
| GET `/users/:userId` | ❌ Missing |
| PUT `/users/:userId` | ❌ Missing |
| POST `/users/:userId/avatar` | ❌ Missing |

### Properties

| Endpoint | Status |
|----------|--------|
| POST `/properties/:propertyId/images` | ❌ Missing |
| Property upload via `/upload` with `propertyId` | ❌ Not wired |

### Applications

| Endpoint | Status |
|----------|--------|
| POST `/applications/:applicationId/documents` | ❌ Missing |
| Document upload for applications | ❌ Not implemented |

### Notifications

| Endpoint | Status |
|----------|--------|
| GET `/notifications` | ❌ Missing |
| PUT `/notifications/:notificationId/read` | ❌ Missing |

### Locations

| Endpoint | Status |
|----------|--------|
| GET `/locations/cities` | ❌ Missing |
| GET `/locations/provinces` | ❌ Missing |
| POST `/locations/geocode` | ❌ Missing |

### Upload

| Endpoint | Status |
|----------|--------|
| POST `/upload` (root, with type: avatar \| property_image \| document) | ⚠️ Only under `/api/admin/settings/upload`; general upload not exposed |

### General

| Item | Status |
|------|--------|
| WebSocket support (`property_updated`, `application_status_changed`, etc.) | ❌ Not implemented |
| Firestore rules (spec referenced Firestore) | N/A – backend uses Neon/Prisma |
| Firebase Storage integration for images | ❌ Not implemented |

---

## Summary Checklist

| Area | Implemented | Missing |
|------|-------------|---------|
| Auth (Firebase + sync) | ✅ | Password reset, email verification |
| Properties CRUD | ✅ | Property images upload |
| Applications CRUD | ✅ | Application documents upload |
| Admin dashboard | ✅ | - |
| Admin analytics | ✅ | - |
| Admin properties (moderation + availability) | ✅ | - |
| Super admin (create admins / support agents) | ✅ | - |
| Tickets API (`/api/tickets`) | ✅ | Auth hardening recommended |
| Mobile parity (`/api/mobile`) | ✅ | - |
| Admin 2FA (OTP) | ✅ | - |
| Admin settings | ✅ | - |
| User profile | ❌ |  |
| Notifications | ❌ |  |
| Locations | ❌ |  |
| General upload | ⚠️ Partial |  |
| WebSockets | ❌ |  |

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Backend JWT signing secret (ensure this matches your app config; some envs may use alternate names) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (for token verification) |
| `API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID` | Firebase client config |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_SENDER` | SMTP identity for OTP emails |
| `SMTP_SERVER`, `SMTP_PORT` | SMTP host/port for OTP delivery |
| `EMAIL_USE_SSL`, `EMAIL_USE_STARTTLS`, `EMAIL_TIMEOUT` | SMTP connection mode/timeouts for OTP email |
| `SMTP_SECRET_KEY`, `SMTP_SECRET_IV` | For settings (SMTP encryption) |

---

## Frontend Integration Example

```javascript
const API = 'http://localhost:8080/api'; // or production base ending in /api

// 1. Sign in with Firebase
const userCredential = await signInWithPopup(auth, googleProvider);
const firebaseToken = await userCredential.user.getIdToken();

// 2. Sync with backend
const res = await fetch(`${API}/auth/sync`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${firebaseToken}` },
});
const { user, token } = await res.json();

// 3. Store backend token
localStorage.setItem('token', token);

// 4. Call protected API (path is under /api — do not duplicate /api in base + path)
const listings = await fetch(`${API}/properties`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

---

## Latest endpoints

Reference for recently added or extended areas: deployment URLs, mobile auth, super admin, admin properties (moderation / list shape), mobile parity routes, and tickets.

### Deployment & base URLs (Firebase / local)

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:<PORT>` — default port **8080**; override with env `PORT` (e.g. `PORT=8081`) |
| Firebase Functions (project `easespaces-7d30b`) | **Recommended:** Cloud Run URL for the `api` function: `https://api-jfh4l76lzq-bq.a.run.app/api` |
| Firebase Functions (`cloudfunctions.net`) | `https://africa-south1-easespaces-7d30b.cloudfunctions.net/api` — paths are **`/api/...`** (e.g. `GET .../api/auth`). Legacy double prefix `.../api/api/...` still works for compatibility. |

All JSON API routes are mounted under **`/api/`** in Express. The app is also mounted at `/` for Firebase path quirks, so the same routes exist at `/admin/...` and `/api/admin/...`; **prefer `/api/...`** in clients. Set **`baseURL`** to a single value ending in `/api` and use **relative** paths (e.g. `/admin/properties`) so the client does not produce `.../api/api/...`.

### Mobile / Google sign-in (auth)

`POST /api/auth/firebase` accepts `registrationType` as `GOOGLE` (or infers from Firebase). For new users, optional `appRole`: `"tenant"` \| `"landlord"`. If a row exists by **email** but not yet linked to the Firebase UID, the backend updates `socialUserId` (account linking after reinstall / provider change).

### Super admin

Some admin-management endpoints are restricted to **super admins** only.

- A super admin is an admin user with `isSuperAdmin: true`.
- The seeded admin user is created with `isSuperAdmin: true` (see `prisma/seed.ts`).

#### POST `/api/admin/users/admins` (super admin only)

Create an admin user for the admin dashboard (username/password).

**Body:**

```json
{
  "name": "Jane",
  "surname": "Admin",
  "email": "jane.admin@example.com",
  "password": "StrongPassword123!",
  "isSuperAdmin": false
}
```

**Response (201):**

```json
{
  "success": true,
  "admin": {
    "id": 12,
    "name": "Jane",
    "surname": "Admin",
    "email": "jane.admin@example.com",
    "appRole": "admin",
    "isSuperAdmin": false,
    "createdAt": "2026-03-18T20:00:00.000Z"
  }
}
```

#### POST `/api/admin/support/agents` (super admin only)

Create a support agent (for the support/ticketing system).

**Body:**

```json
{
  "name": "Mike Johnson",
  "email": "mike.agent@example.com",
  "role": "agent",
  "maxTickets": 10,
  "isActive": true
}
```

### Admin properties – status model & list

Properties in the admin dashboard use **two independent status fields**:

- **Moderation** (`moderationStatus`): `pending_approval` \| `approved` \| `declined` \| `flagged_for_review`
  - If `flagged_for_review`, the API requires **`notes`** and stores it in `moderationNotes`.
- **Availability** (`availabilityStatus`): `available` \| `unavailable` \| `occupied`

#### GET `/api/admin/properties` (admin list)

**Query params:**

- `q`: text search across **title**, **owner name/surname**, **city**
- `type`: rental type (e.g. `short-term`, `long-term`)
- `location`: city (matches `location.city`)
- `minPrice`, `maxPrice`
- `moderationStatus`: one of `pending_approval|approved|declined|flagged_for_review`
- `availabilityStatus`: one of `available|unavailable|occupied`
- `page`, `limit`
- `sortBy`: `createdAt|price|moderationStatus|title`
- `sortOrder`: `asc|desc`

**Response (200):**

```json
{
  "success": true,
  "properties": [
    {
      "id": "3",
      "name": "Studio in Bryanston",
      "location": "Bryanston",
      "type": "Short-term",
      "price": 1200,
      "priceDisplay": "R1,200",
      "status": "approved",
      "availabilityStatus": "available",
      "owner": "Mike Johnson",
      "ownerId": 12,
      "images": [],
      "bedrooms": 1,
      "bathrooms": 1,
      "description": "Cozy studio apartment, perfect for single travelers",
      "submittedDate": "2024-01-10",
      "moderationNotes": null
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

#### PATCH `/api/admin/properties/:propertyId/moderation`

**Body:**

```json
{ "action": "flag_for_review", "notes": "Missing proof of ownership" }
```

**Body (approve/decline/pending):**

```json
{ "action": "approve" }
```

Returns `200` with `{ success: true, property: <UI row> }`.

### Mobile parity (`/api/mobile`)

Same behaviour as top-level **`/api/properties`** and **`/api/applications`**, under the `/mobile` prefix (for clients that namespace “app” routes).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/mobile/register-user` | None | Legacy user registration |
| POST | `/api/mobile/register-service-provider` | None | Legacy service provider registration |
| POST | `/api/mobile/register-service-provider-business` | None | Legacy business service provider |
| POST | `/api/mobile/login` | None | Legacy login |
| GET | `/api/mobile/properties` | None | List properties (same as `GET /api/properties`) |
| GET | `/api/mobile/properties/:propertyId` | None | Get one property |
| POST | `/api/mobile/properties/search` | None | Search (same as `POST /api/properties/search`) |
| GET | `/api/mobile/applications` | Backend JWT or Firebase ID token | List applications |
| POST | `/api/mobile/applications` | Backend JWT or Firebase ID token | Create application |
| PUT | `/api/mobile/applications/:applicationId/status` | Backend JWT or Firebase ID token | Update application status |

### Examples (`/api/examples`)

Thin demo router (not full mobile API).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/examples/all` | None | Example HTML / usage |

### Support tickets (`/api/tickets`)

**Auth:** Currently **none** on these routes — treat as internal/admin-only in production or add gateway auth before exposing publicly.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickets` | List tickets. Query: `page`, `limit`, `status`, `priority`, `category`, `assignedTo` (comma-separated), `search`, `dateRange`, `sortBy`, `sortOrder` |
| GET | `/api/tickets/:id` | Get one ticket |
| POST | `/api/tickets` | Create ticket. Body: `subject`, `description`, `category`, `priority`, `customerEmail`, `customerName`, `tags?` |
| PUT | `/api/tickets/:id` | Update ticket |
| DELETE | `/api/tickets/:id` | Delete ticket |
| GET | `/api/tickets/stats` | Statistics. Query: `dateRange?` (JSON string) |
| GET | `/api/tickets/statuses` | Ticket statuses |
| GET | `/api/tickets/priorities` | Priorities |
| GET | `/api/tickets/categories` | Categories |
| GET | `/api/tickets/agents` | Support agents |
| PUT | `/api/tickets/agents/:id/workload` | Body: `{ maxTickets }` |
| GET | `/api/tickets/email-templates` | Email templates |
| GET | `/api/tickets/email-templates/:id` | One template |
| POST | `/api/tickets/email-templates` | Create template |
| PUT | `/api/tickets/email-templates/:id` | Update template |
| DELETE | `/api/tickets/email-templates/:id` | Delete template |
| POST | `/api/tickets/email-templates/:id/send` | Send (stub) |
| POST | `/api/tickets/:id/escalate` | Body: `{ reason }` |
| POST | `/api/tickets/:id/close` | Body: `{ resolution, closedBy? }` |
| POST | `/api/tickets/:id/reopen` | Body: `{ reason }` |
| GET | `/api/tickets/:id/messages` | Messages. Query: `page`, `limit`, `includeInternal` |
| POST | `/api/tickets/:id/messages` | Add message. Body: `content`, `isInternal?`, `attachments?`, `authorId?`, `authorName?` |
