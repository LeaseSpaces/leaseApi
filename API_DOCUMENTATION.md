# LeaseSpaces Backend API Documentation

## Overview

This Node.js/Express backend serves the LeaseSpaces property rental platform. It uses **Firebase** for authentication and **Neon (PostgreSQL)** via Prisma for data. Frontends connect via REST over HTTP.

---

## Base URL & Port

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:8080` |
| Production | Configure via deployment (e.g. `https://your-api-domain.com`) |

All API routes are prefixed with `/api/` unless noted.

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
| POST | `/api/auth/firebase` | None | Body: `{ idToken, registrationType }`. Verifies Firebase token, syncs user, returns `{ success, user, token }` |
| POST | `/api/auth/sync` | None | Header: `Authorization: Bearer <firebase_id_token>`. Same as above; returns `{ success, user, token }` |

**Registration types**: `GOOGLE`, `FACEBOOK`, `APPLE`, `EMAIL`.

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
| POST | `/api/properties` | Firebase JWT | Create property |
| PUT | `/api/properties/:propertyId` | Firebase JWT | Update property |
| DELETE | `/api/properties/:propertyId` | Firebase JWT | Delete property |

**Query params (GET /properties)**:
- `page`, `limit`, `location`, `minPrice`, `maxPrice`, `propertyType`, `bedrooms`, `bathrooms`, `rentalType`, `amenities`, `sortBy`, `sortOrder`

---

### Applications (`/api/applications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/applications` | Firebase JWT | List current user's applications |
| POST | `/api/applications` | Firebase JWT | Create application |
| PUT | `/api/applications/:applicationId/status` | Firebase JWT | Update status (body: `{ status: "approved" \| "rejected", message? }`) |

**Query params (GET)**: `status`, `page`, `limit`.

---

### Admin (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/dashboard` | Admin + Firebase JWT | Dashboard stats |
| GET | `/api/admin/properties/analytics` | Admin + Firebase JWT | Property analytics (query: `period=7d\|30d\|90d\|1y`) |
| GET | `/api/admin/admin-profile` | Admin + Firebase JWT | Admin profile |
| DELETE | `/api/admin/delete-admin` | Admin + Firebase JWT + OTP | Delete admin (body: `{ otp }`) |
| POST | `/api/admin/admin-login` | None | Legacy Firestore admin login |
| POST | `/api/admin/init-2fa` | None | Init 2FA (body: `{ email }`) |
| POST | `/api/admin/enable-2fa` | None | Enable 2FA |
| POST | `/api/admin/verify-otp` | None | Verify OTP |
| GET | `/api/admin/all` | None | List all admins |
| POST | `/api/admin/forgot-password` | None | Forgot password |

**Admin routes**: User must have `appRole: "admin"` in Prisma. `DELETE /delete-admin` also requires `otp` in body when 2FA is enabled.

---

### Mobile / Examples (`/api/examples`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/examples/register-user` | None | Legacy user registration |
| POST | `/api/examples/register-service-provider` | None | Legacy service provider registration |
| POST | `/api/examples/register-service-provider-business` | None | Legacy business service provider |
| POST | `/api/examples/login` | None | Legacy login |
| GET | `/api/examples/properties` | None | Same as GET /api/properties |
| GET | `/api/examples/properties/:propertyId` | None | Same as GET /api/properties/:id |
| POST | `/api/examples/properties/search` | None | Same as POST /api/properties/search |
| GET | `/api/examples/applications` | Firebase JWT | Same as GET /api/applications |
| POST | `/api/examples/properties` | Firebase JWT | Same as POST /api/applications |
| PUT | `/api/examples/applications/:applicationId/status` | Firebase JWT | Same as PUT /api/applications/:id/status |

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
| GET | `/api/mobile/all` | None | Example usage (mobile router) |

---

## What Is Missing (vs Spec)

Compared to the original LeaseSpaces API spec, the following are **not implemented**:

### Auth

| Endpoint | Status |
|----------|--------|
| POST `/auth/register` (email/password) | ❌ Missing – use Firebase Auth + `/auth/sync` instead |
| POST `/auth/login` (email/password) | ❌ Missing – use Firebase Auth + `/auth/sync` instead |
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
| `JWT_SECRETE` | Backend JWT signing secret |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (for token verification) |
| `API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID` | Firebase client config |
| `SMTP_SECRET_KEY`, `SMTP_SECRET_IV` | For settings (SMTP encryption) |

---

## Frontend Integration Example

```javascript
// 1. Sign in with Firebase
const userCredential = await signInWithPopup(auth, googleProvider);
const firebaseToken = await userCredential.user.getIdToken();

// 2. Sync with backend
const res = await fetch('http://localhost:8080/api/auth/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${firebaseToken}` },
});
const { user, token } = await res.json();

// 3. Store backend token
localStorage.setItem('token', token);

// 4. Call protected API
const listings = await fetch('http://localhost:8080/api/properties', {
  headers: { 'Authorization': `Bearer ${token}` },
});
```
