# LeaseSpaces Backend API Documentation

## Overview

This Node.js/Express backend serves the LeaseSpaces property rental platform. It uses **Firebase** for authentication and **Neon (PostgreSQL)** via Prisma for data. Frontends connect via REST over HTTP.

---

## Base URL & Port

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:8080/api` (or set env **`PORT`**) |
| Production (recommended) | `https://api3-jfh4l76lzq-bq.a.run.app/api` |
| Production (legacy `api`) | `https://api-jfh4l76lzq-bq.a.run.app/api` |

See **API_ENDPOINTS_GUIDE.md** for the full endpoint list and **Latest endpoints** below for deployment details.

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
| GET | `/api/properties` | None | List properties (**approved + available** only for public browse) |
| GET | `/api/properties/:propertyId/lease` | `appAuth` | Active lease for tenant/landlord when occupied |
| GET | `/api/properties/:propertyId` | None | Get single property |
| POST | `/api/properties/search` | None | Body: `{ query?, filters?, sortBy?, sortOrder? }`. Search properties |
| POST | `/api/properties` | Backend JWT or Firebase ID token (`appAuth`) | Create property |
| PUT | `/api/properties/:propertyId` | Backend JWT or Firebase ID token (`appAuth`) | Update property |
| DELETE | `/api/properties/:propertyId` | Backend JWT or Firebase ID token (`appAuth`) | Delete property |
| GET | `/api/properties/:propertyId/chats` | Backend JWT or Firebase ID token (`appAuth`) | **Tenant:** get existing chat with landlord for this listing |
| POST | `/api/properties/:propertyId/chats` | Backend JWT or Firebase ID token (`appAuth`) | **Tenant:** start or resume chat (“Message landlord”) |

**Query params (GET /properties)**:
- `page`, `limit`, `location`, `minPrice`, `maxPrice`, `propertyType`, `bedrooms`, `bathrooms`, `rentalType`, `amenities`, `sortBy`, `sortOrder`

---

### Applications (`/api/applications`)

Multi-step **apply for rental** flow (draft → documents → submit → pending).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/properties/:propertyId/apply-form` | `appAuth` | Form schema + `existingDraft` |
| POST | `/api/applications` | `appAuth` | Create **draft** (step 1 personal info) |
| PATCH | `/api/applications/:applicationId` | `appAuth` | Update draft personal info |
| POST | `/api/applications/:applicationId/documents` | `appAuth` | Step 2: multipart (`governmentId`, `proofOfIncome`, `referenceLetters`) or JSON base64 |
| GET | `/api/applications/:applicationId` | `appAuth` | Review summary (step 3) |
| POST | `/api/applications/:applicationId/submit` | `appAuth` | Submit: `{ "termsAccepted": true }` → `pending` + chat |
| GET | `/api/applications` | `appAuth` | Tenant: my applications (excludes drafts) |
| GET | `/api/applications/incoming` | Landlord/admin | Incoming applications |
| GET | `/api/applications/incoming/:applicationId` | Landlord/admin | Detail + `documentsVerification` |
| PATCH | `/api/applications/incoming/:applicationId/decision` | Landlord/admin | `{ "decision": "approved" \| "rejected" }` — approve creates **lease** |
| PUT | `/api/applications/:applicationId/status` | `appAuth` | Legacy approve/reject alias |

**Document upload:** Use `multipart/form-data`; field names must be camelCase. Do not set `Content-Type` manually. Max 10MB per file. On Firebase/Cloud Run, uploads use `req.rawBody` (Busboy) — not Multer.

**`documentsVerification`** on application detail (landlord read-only until vendor updates):
```json
{
  "status": "pending",
  "verifiedAt": null,
  "notes": null,
  "allDocumentsVerified": false,
  "documents": [
    { "type": "government_id", "fileName": "id.jpg", "url": "...", "verificationStatus": "pending" }
  ]
}
```

Vendor/admin update: `PATCH /api/admin/applications/:id/documents-verification` with `{ "status": "verified", "notes?", "documentUpdates?": [...] }`.

---

### Chat (`/api/chats`)

Tenant ↔ landlord messaging. **Messages and conversations are stored in Firebase Firestore** (realtime). Postgres is used for user/property validation and profile hydration in API responses.

**Auth:** Backend JWT or Firebase ID token (`appAuth`, `syncUser: true`). User must be the **tenant** or **landlord** on the conversation.

**Conversation ID:** `{propertyId}_{tenantId}` (one thread per property per tenant).

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chats` | Inbox — list conversations for current user. Query: `page`, `limit` (max 50). |
| POST | `/api/chats` | Create or get conversation. Body: see below. |
| GET | `/api/chats/:conversationId` | Get one conversation (with last message preview). |
| GET | `/api/chats/:conversationId/history` | **Chat history** with timestamps. Same as `/messages`. |
| GET | `/api/chats/:conversationId/messages` | Chat history (alias). |
| POST | `/api/chats/:conversationId/messages` | Send message. Body: `{ "body": "...", "attachments?": null }`. |
| POST | `/api/chats/:conversationId/read` | Mark messages from the other party as read. |
| GET | `/api/chats/:conversationId/stream` | SSE stream (optional; clients may use Firestore listeners instead). |

**Mobile parity:** Same routes under `/api/mobile/chats`. Tenant property shortcuts under `/api/mobile/properties/:propertyId/chats`.

#### POST `/api/chats` — body

| Body | Who | Description |
|------|-----|-------------|
| `{ "propertyId": "<uuid>" }` | Tenant | Open chat on a listing (tenant inferred from token). |
| `{ "applicationId": "<uuid>" }` | Tenant or landlord | Open chat linked to an application. |
| `{ "propertyId": "<uuid>", "tenantId": 42 }` | Landlord | Open chat with a specific tenant. |

#### GET history — query params

| Param | Example | Description |
|--------|---------|-------------|
| `page` | `1` | Page number (default 1). |
| `limit` | `50` | Messages per page (max 100). |
| `order` | `asc` \| `desc` | Sort by `createdAt` (default `asc`). |
| `after` | `2026-05-15T14:00:00.000Z` | Messages **newer than** (ISO 8601). |
| `before` | `2026-05-15T14:00:00.000Z` | Messages **older than** (load previous page). |

#### Message object (response)

```json
{
  "id": "firestore-message-id",
  "conversationId": "property-uuid_42",
  "senderId": 42,
  "body": "Is this still available?",
  "attachments": null,
  "sentAt": "2026-05-15T14:30:00.000Z",
  "createdAt": "2026-05-15T14:30:00.000Z",
  "updatedAt": "2026-05-15T14:30:00.000Z",
  "readAt": null,
  "sender": {
    "id": 42,
    "name": "Jane",
    "surname": "Doe",
    "email": "jane@example.com"
  }
}
```

#### History response (excerpt)

```json
{
  "success": true,
  "history": [ /* messages, chronological when order=asc */ ],
  "messages": [ /* same as history */ ],
  "meta": {
    "total": 24,
    "count": 24,
    "page": 1,
    "limit": 50,
    "totalPages": 1,
    "oldestAt": "2026-05-10T09:00:00.000Z",
    "newestAt": "2026-05-15T14:30:00.000Z",
    "hasMore": false,
    "order": "asc"
  },
  "conversation": { "id": "...", "messageCount": 24, "lastMessageAt": "..." },
  "firestore": {
    "conversationPath": "conversations/property-uuid_42",
    "messagesPath": "conversations/property-uuid_42/messages"
  }
}
```

#### Firestore structure (for realtime clients)

```
conversations/{propertyId}_{tenantId}
  propertyId, tenantId, landlordId, applicationId?, participantIds[]
  lastMessageAt, lastMessagePreview, lastMessageSenderId, messageCount
  createdAt, updatedAt

conversations/{id}/messages/{messageId}
  senderId, body, attachments, readAt, createdAt, updatedAt
```

Direct client writes to Firestore are blocked by default (`firestore.rules`); use the REST API unless you add read rules for authenticated participants.

#### Typical tenant flow

1. `POST /api/properties/:propertyId/chats` → get `conversation.id`
2. `GET /api/chats/:id/history?limit=50&order=asc` → render thread
3. `POST /api/chats/:id/messages` → send
4. `POST /api/chats/:id/read` when viewing thread
5. Optional: `GET /api/chats/:id/stream` for SSE

---

### Admin (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/dashboard` | Admin + `appAuth` (backend JWT or Firebase ID token) | Dashboard stats |
| GET | `/api/admin/properties/analytics` | Admin + `appAuth` | Property analytics (query: `period=7d\|30d\|90d\|1y`) |
| GET | `/api/admin/admin-profile` | Admin + `appAuth` | Admin profile |
| DELETE | `/api/admin/delete-admin` | Admin + `appAuth` + OTP | Delete admin (body: `{ otp }`) |
| POST | `/api/admin/login` | None | **Prisma admin login.** Body: `{ username, password }`. Returns JWT or `requires2fa` + `temporaryToken`. |
| POST | `/api/admin/users/admins` | **Super admin only** | Create admin user (Prisma). Body: `{ name, surname, email, password, isSuperAdmin? }` |
| POST | `/api/admin/support/agents` | **Super admin only** | Create support agent. Body: `{ name, email, role?, maxTickets?, isActive? }` |
| POST | `/api/admin/users/:userId/2fa/init` | **Super admin** | Start 2FA setup for a user. Returns `{ secret, qrCodeBase64 }`. |
| POST | `/api/admin/users/:userId/2fa/enable` | **Super admin** | Enable 2FA after OTP verification. Body: `{ "secret", "otp" }`. |
| POST | `/api/admin/users/:userId/2fa/disable` | **Super admin** | Disable 2FA for a user (clears secret). |
| GET | `/api/admin/locations` | Admin + `appAuth` | List locations from **Firestore** (optional `?userId=`). |
| PUT | `/api/admin/locations/:locationId` | Admin + `appAuth` | Update a location document. |
| GET | `/api/admin/applications` | Admin + `appAuth` | List applications (see rental applications in guide). |
| GET | `/api/admin/applications/:applicationId` | Admin + `appAuth` | Application detail incl. `documentsVerification`. |
| PATCH | `/api/admin/applications/:applicationId/decision` | Admin + `appAuth` | Approve/reject pending application. |
| PATCH | `/api/admin/applications/:applicationId/documents-verification` | Admin + `appAuth` | Vendor workflow: update document verification status. |
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

**Admin auth (important):**

1. **Login:** `POST /api/admin/login` with `{ "username": "<email>", "password": "..." }`.
2. **Use** response field **`token`** (not `temporaryToken` unless completing 2FA).
3. **Header:** `Authorization: Bearer <token>` on all `/api/admin/*` routes except login.

All admin routes listed above use **`appAuth`** — they accept the **backend JWT** from admin login **or** a Firebase ID token. Dashboard, profile, settings, and locations no longer require Firebase-only tokens.

**401 `INVALID_TOKEN`:** Wrong token type, expired JWT, or using `temporaryToken` before 2FA completes. Response may include `error.hint`.

**Admin routes**: User must have `appRole: "admin"` in Prisma. `DELETE /delete-admin` also requires `otp` in body when 2FA is enabled.

**Test:** `npm run test:admin` (production smoke test for login, settings, locations, dashboard).

---

### Landlord (`/api/landlord`)

Requires `appRole: landlord` or `admin`. Same `appAuth` token as the main app.

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/landlord/properties` | List / create my listings |
| PUT/DELETE | `/api/landlord/properties/:propertyId` | Update / delete (ownership enforced) |
| GET | `/api/landlord/applications` | Incoming applications |
| GET | `/api/landlord/applications/:applicationId` | Detail + documents + `documentsVerification` |
| PATCH | `/api/landlord/applications/:applicationId/decision` | Approve / reject |
| GET | `/api/landlord/leases` | My leases |
| GET/PATCH | `/api/landlord/maintenance` | Maintenance queue / update status |

Alias: `/api/applications/incoming/*` — same as landlord application routes.

---

### Leases (`/api/leases`)

Created automatically when an application is **approved**. Property `availabilityStatus` becomes `occupied`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/leases/me` | Tenant or landlord | List my leases |
| GET | `/api/leases/:leaseId` | Tenant or landlord | Lease detail (`agreementUrl`, rent, dates) |
| GET | `/api/properties/:propertyId/lease` | Tenant or landlord | Active lease for occupied property |

---

### Maintenance (`/api/maintenance`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/maintenance` | Tenant | Report issue (requires active lease on `propertyId`) |
| GET | `/api/maintenance` | Tenant | My requests |
| GET | `/api/maintenance/:requestId` | Tenant | One request |
| GET | `/api/landlord/maintenance` | Landlord | Requests for my properties |
| PATCH | `/api/landlord/maintenance/:requestId` | Landlord | Body: `{ "status": "open" \| "in_progress" \| "resolved" \| "closed" }` |

---

### Settings

#### Public read-only (`/api/settings`)

No auth required for GET (app branding and legal pages in the main app).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings/app` | App settings (name, colors, etc.) |
| GET | `/api/settings/about` | About page HTML/content |
| GET | `/api/settings/privacy-policy` | Privacy policy content |
| GET | `/api/settings/terms-and-conditions` | Terms & conditions content |

Returns `404` when content is not configured (empty).

#### Admin (`/api/admin/settings`)

Requires **`Authorization: Bearer <token>`** and **`appRole: admin`** (`appAuth` + `requireAdmin`).

- **Without a token:** `GET /api/admin/settings/app` returns **401** `AUTHENTICATION_REQUIRED`.
- **Public reads** (mobile app): use **`GET /api/settings/app`** (and `/about`, `/privacy-policy`, `/terms-and-conditions`) — no auth.
- **Writes** (POST/PUT/DELETE, SMTP, upload): **`/api/admin/settings/*` only**.

| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT | `/api/admin/settings/app` | App settings CRUD |
| GET/POST/PUT/DELETE | `/api/admin/settings/about` | About page |
| GET/POST/PUT/DELETE | `/api/admin/settings/privacy-policy` | Privacy policy |
| GET/POST/PUT/DELETE | `/api/admin/settings/terms-and-conditions` | Terms & conditions |
| GET/POST/PUT | `/api/admin/settings/smtp` | SMTP config |
| POST | `/api/admin/settings/smtp/test` | Test SMTP connection |
| POST | `/api/admin/settings/upload` | Upload file (multipart) |

#### SMTP Configuration Details

**Request Body for POST/PUT `/api/admin/settings/smtp`:**

```json
{
  "host": "smtp.gmail.com",
  "port": 465,
  "username": "your-email@gmail.com",
  "password": "your-app-password",
  "useSsl": true,
  "useStartTls": false,
  "timeout": 20000,
  "fromEmail": "noreply@yourapp.com",
  "fromName": "Your App Name",
  "isActive": true
}
```

**Response for GET `/api/admin/settings/smtp`:**

```json
{
  "host": "smtp.gmail.com",
  "port": 465,
  "username": "your-email@gmail.com",
  "password": "encrypted-password-hash",
  "useSsl": true,
  "useStartTls": false,
  "timeout": 20000,
  "fromEmail": "noreply@yourapp.com",
  "fromName": "Your App Name",
  "isActive": true,
  "createdAt": "2026-05-05T10:00:00.000Z",
  "updatedAt": "2026-05-05T10:00:00.000Z"
}
```

**SMTP Test Request Body for POST `/api/admin/settings/smtp/test`:**

```json
{
  "host": "smtp.gmail.com",
  "port": 465,
  "username": "your-email@gmail.com",
  "password": "your-app-password",
  "useSsl": true,
  "useStartTls": false,
  "timeout": 20000,
  "fromEmail": "noreply@yourapp.com",
  "fromName": "Your App Name"
}
```

**SMTP Test Response:**

```json
{
  "success": true,
  "message": "SMTP connection successful"
}
```

**SMTP Field Descriptions:**
- `host`: SMTP server hostname (e.g., "smtp.gmail.com", "smtp.office365.com")
- `port`: SMTP server port (e.g., 465 for SSL, 587 for STARTTLS, 25 for plain)
- `username`: SMTP authentication username (usually your email)
- `password`: SMTP authentication password (app password for Gmail)
- `useSsl`: Enable SSL encryption (typically for port 465)
- `useStartTls`: Enable STARTTLS upgrade (typically for port 587)
- `timeout`: Connection timeout in milliseconds (default: 20000)
- `fromEmail`: Email address used as sender
- `fromName`: Display name for the sender
- `isActive`: Whether SMTP is enabled for sending emails

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
| POST `/applications/:applicationId/documents` | ✅ Multipart + JSON base64 |
| Document verification (vendor) | ✅ Admin PATCH `documents-verification`; landlord read-only |

### Notifications

| Endpoint | Status |
|----------|--------|
| GET `/notifications` | ❌ Missing |
| PUT `/notifications/:notificationId/read` | ❌ Missing |

### Locations

| Endpoint | Status |
|----------|--------|
| GET `/api/mobile/user-locations` | ✅ Implemented |
| PUT `/api/mobile/update-location/:locationId` | ✅ Implemented |
| GET `/api/admin/locations` | ✅ Implemented |
| PUT `/api/admin/locations/:locationId` | ✅ Implemented |

> Admin GET `/api/admin/locations` optionally accepts `?userId=<userId>` to filter locations for a specific user.

### Upload

| Endpoint | Status |
|----------|--------|
| POST `/upload` (root, with type: avatar \| property_image \| document) | ⚠️ Only under `/api/admin/settings/upload`; general upload not exposed |

### General

| Item | Status |
|------|--------|
| WebSocket support (`property_updated`, `application_status_changed`, etc.) | ❌ Not implemented |
| Chat (tenant ↔ landlord) | ✅ Firestore + REST | Client Firestore read rules optional |
| Firestore (chat storage) | ✅ | Locations/notifications may use client SDK separately |
| Firebase Storage integration for images | ❌ Not implemented |

---

## Summary Checklist

| Area | Implemented | Missing |
|------|-------------|---------|
| Auth (Firebase + sync) | ✅ | Password reset, email verification |
| Properties CRUD | ✅ | Property images upload |
| Applications (multi-step + documents) | ✅ | - |
| Chat (Firestore + REST) | ✅ | Client-side Firestore listeners need rules |
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
| Landlord portal (`/api/landlord`) | ✅ | - |
| Leases + occupied agreement | ✅ | - |
| Tenant maintenance | ✅ | - |
| Locations (admin Firestore) | ✅ | - |
| General upload | ⚠️ Partial |  |
| WebSockets | ❌ |  |

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Backend JWT signing secret (ensure this matches your app config; some envs may use alternate names) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase service account JSON (auth + Firestore chat writes) |
| `USE_FIRESTORE_EMULATOR`, `FIRESTORE_EMULATOR_HOST` | Local chat testing without production Firestore |
| `API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID` | Firebase client config |
| `SMTP_SECRET_KEY`, `SMTP_SECRET_IV` | For settings (SMTP password encryption) |

**Note:** SMTP is configured via `/api/admin/settings/smtp`. OTP email uses active DB SMTP first, then falls back to `.env` (`EMAIL_USER`, `EMAIL_PASS`, `SMTP_SERVER`, etc.) if DB SMTP is inactive.

**Chat / Firestore:** Set `GOOGLE_APPLICATION_CREDENTIALS` for production. Local testing: `USE_FIRESTORE_EMULATOR=true`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`, `npm run emulator:firestore`.

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

// Admin dashboard login (username = email)
const adminRes = await fetch(`${API}/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin@leasespaces.local', password: '...' }),
});
const { token: adminToken } = await adminRes.json();
const settings = await fetch(`${API}/admin/settings/app`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});
```

---

## Latest endpoints

Reference for recently added or extended areas: deployment URLs, mobile auth, super admin, admin properties (moderation / list shape), mobile parity routes, and tickets.

### Deployment & base URLs (Firebase / local)

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:<PORT>` — default port **8080**; override with env `PORT` (e.g. `PORT=8081`) |
| Firebase Functions (project `easespaces-7d30b`) | **Recommended (api3):** `https://api3-jfh4l76lzq-bq.a.run.app/api` |
| Legacy `api` function | `https://api-jfh4l76lzq-bq.a.run.app/api` (same Express app) |
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
| GET | `/api/mobile/properties/:propertyId/apply-form` | `appAuth` | Apply form |
| PATCH | `/api/mobile/applications/:applicationId` | `appAuth` | Update draft |
| POST | `/api/mobile/applications/:applicationId/documents` | `appAuth` | Upload documents |
| POST | `/api/mobile/applications/:applicationId/submit` | `appAuth` | Submit application |
| PUT | `/api/mobile/applications/:applicationId/status` | `appAuth` | Legacy status update |

### Admin smoke test

```bash
npm run test:admin
# Env: PROD_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD
```

Verifies: login, settings auth, locations, dashboard, profile.

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
