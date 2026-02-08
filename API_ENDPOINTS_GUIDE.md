# API Endpoints Guide — App & Admin

Use this guide to connect the **main app** (tenant/landlord) and the **admin dashboard** to their dedicated API endpoints.

**Base URL:** `http://localhost:8080` (local) or your deployed API URL.  
All endpoints below are under **`/api/`** (e.g. `GET /api/auth` → `http://localhost:8080/api/auth`).

**Auth:** Protected routes use **`Authorization: Bearer <backend_jwt>`**. Get the backend JWT from **POST /api/auth/sync** (send Firebase ID token in the same header).

---

## 1. App (Tenant & Landlord) — Main frontend

Use these endpoints in the **main LeaseSpaces app** (browse properties, apply, manage listings).

### 1.1 Auth (shared with admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/auth` | None | Health check; list of auth endpoints |
| POST | `/api/auth/sync` | Firebase ID token in header | **Main login flow.** Send `Authorization: Bearer <firebase_id_token>`. Returns `{ success, user, token }`. Use `token` as backend JWT for all other requests. |
| POST | `/api/auth/firebase` | None | Same as sync; send `{ "idToken": "<firebase_id_token>", "registrationType": "GOOGLE" \| "EMAIL" \| "FACEBOOK" \| "APPLE" }` in body. Returns `{ success, user, token }`. |

**App flow:** Sign in with Firebase (e.g. Google/Email) → get Firebase ID token → **POST /api/auth/sync** with that token in header → store returned `token` (backend JWT) → use it in `Authorization: Bearer <token>` for all protected app requests.

---

### 1.2 Properties (browse, search, create, update, delete)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/properties` | None | List properties. Query: `page`, `limit`, `location`, `minPrice`, `maxPrice`, `propertyType`, `bedrooms`, `bathrooms`, `rentalType`, `amenities`, `sortBy`, `sortOrder`. |
| GET | `/api/properties/:propertyId` | None | Get one property by ID. |
| POST | `/api/properties/search` | None | Search. Body: `{ "query?", "filters?", "sortBy?", "sortOrder?" }`. |
| POST | `/api/properties` | Backend JWT | Create property (landlord). Body: `title`, `description`, `price`, `propertyType`, `rentalType`, `bedrooms`, `bathrooms`, `location`, etc. |
| PUT | `/api/properties/:propertyId` | Backend JWT | Update property (landlord). |
| DELETE | `/api/properties/:propertyId` | Backend JWT | Delete property (landlord). |

**App usage:** List/search with GET (no auth). Create/edit/delete with POST/PUT/DELETE + `Authorization: Bearer <backend_jwt>`.

---

### 1.3 Applications (tenant applications)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/applications` | Backend JWT | List current user’s applications. Query: `status`, `page`, `limit`. |
| POST | `/api/applications` | Backend JWT | Create application. Body: `{ "propertyId": "<uuid>", "moveInDate?", "message?", "documents?" }`. |
| PUT | `/api/applications/:applicationId/status` | Backend JWT | Update status. Body: `{ "status": "approved" \| "rejected", "message?" }`. |

**App usage:** Tenant: GET my applications, POST new application. Landlord: PUT to approve/reject (same token).

---

## 2. Admin — Admin dashboard

Use these endpoints in the **admin dashboard** (LeaseSpaces admin app).

### 2.1 Auth for admin

- Same as app: **POST /api/auth/sync** with Firebase ID token → get backend JWT.
- The user must have **`appRole: "admin"`** in the database to access admin-only routes below.
- Optional legacy: **POST /api/admin/admin-login** with `{ "email", "password" }` (Firestore admins) for legacy admin flows only.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/sync` | Firebase ID token | Use same as app; ensure user is admin in DB. |
| POST | `/api/admin/admin-login` | None | Legacy. Body: `{ "email", "password" }`. Returns `{ token, details }`. |

---

### 2.2 Admin-only routes (require backend JWT + appRole admin)

Send **`Authorization: Bearer <backend_jwt>`** for a user with `appRole: "admin"`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats (totalProperties, totalUsers, totalApplications, pendingApplications, revenue). |
| GET | `/api/admin/properties/analytics` | Property analytics. Query: `period=7d \| 30d \| 90d \| 1y`. |
| GET | `/api/admin/admin-profile` | Admin profile (current user). |
| DELETE | `/api/admin/delete-admin` | Delete current admin (high-security). Body: `{ "otp": "<totp_code>" }` when 2FA enabled. |

---

### 2.3 Admin settings (app config, SMTP, upload)

Still under admin; can be used with or without auth depending on your setup (see your routes). Typically use the same backend JWT for consistency.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/settings/app` | Get app settings. |
| POST | `/api/admin/settings/app` | Create app settings. |
| PUT | `/api/admin/settings/app` | Update app settings. |
| GET | `/api/admin/settings/smtp` | Get SMTP config. |
| POST | `/api/admin/settings/smtp` | Save SMTP config. |
| PUT | `/api/admin/settings/smtp` | Update SMTP config. |
| POST | `/api/admin/settings/smtp/test` | Test SMTP connection. Body: SMTP params. |
| POST | `/api/admin/settings/upload` | Upload file (multipart). |

---

### 2.4 Admin 2FA (legacy / Firestore)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/init-2fa` | None | Body: `{ "email" }`. Returns `{ secret, qrCodeBase64 }`. |
| POST | `/api/admin/enable-2fa` | None | Body: `{ "email", "secret_key" }`. |
| POST | `/api/admin/verify-otp` | None | Body: `{ "email", "token" }` (OTP code). |
| GET | `/api/admin/all` | None | List all admins (legacy). |
| POST | `/api/admin/forgot-password` | None | Body: `{ "email", "newPassword" }`. |

---

## 3. Quick reference by client

### Main app (tenant/landlord)

- **Base:** `{{baseUrl}}/api`
- **Login:** `POST /api/auth/sync` with `Authorization: Bearer <firebase_id_token>` → store `token`.
- **Then use:** `Authorization: Bearer {{token}}` for:
  - `GET/POST /api/properties` (list public, create as landlord)
  - `GET /api/properties/:id`, `POST /api/properties/search`
  - `PUT/DELETE /api/properties/:id`
  - `GET/POST /api/applications`, `PUT /api/applications/:id/status`

### Admin dashboard

- **Base:** `{{baseUrl}}/api`
- **Login:** Same as app — `POST /api/auth/sync` with Firebase ID token (user must have `appRole: "admin"` in DB). Or legacy: `POST /api/admin/admin-login` with email/password.
- **Then use:** `Authorization: Bearer {{token}}` for:
  - `GET /api/admin/dashboard`
  - `GET /api/admin/properties/analytics?period=30d`
  - `GET /api/admin/admin-profile`
  - `GET/POST/PUT /api/admin/settings/app`
  - `GET/POST/PUT /api/admin/settings/smtp`, `POST /api/admin/settings/smtp/test`
  - `POST /api/admin/settings/upload`
  - `DELETE /api/admin/delete-admin` (with body `{ "otp": "..." }` if 2FA enabled)

---

## 4. Environment variables for frontends

- **App:** `VITE_API_URL` or `REACT_APP_API_URL` = `http://localhost:8080` (or your API URL).
- **Admin:** Same API URL; only the user role (admin in DB) and which endpoints you call differ.

---

## 5. Error responses

All errors return JSON, e.g.:

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Authentication token is required",
    "details": "..."
  }
}
```

Common codes: `AUTHENTICATION_REQUIRED`, `INVALID_TOKEN`, `INSUFFICIENT_PERMISSIONS`, `RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_SERVER_ERROR`.
