# API Endpoints Guide — App & Admin

Use this guide to connect the **main app** (tenant/landlord) and the **admin dashboard** to their dedicated API endpoints.

**Base URL (local):** `http://localhost:8080` by default, or set env **`PORT`** (e.g. `8081`).  
**Base URL (production):** `https://api-jfh4l76lzq-bq.a.run.app/api`

- **Firebase Functions (recommended stable URL):** use the **Cloud Run** URL printed after `firebase deploy --only functions` (format `https://<id>.<region>.run.app/api`).
- **`cloudfunctions.net`:** `https://africa-south1-easespaces-7d30b.cloudfunctions.net/api` — call paths like **`/api/auth`**, **`/api/admin/properties`**, etc. (Do **not** double the host in the client; set `VITE_API_URL` to the base that already ends with `/api` or to the origin only, never `cloudfunctions.net` + full URL again.)

All endpoints below are under **`/api/`** (e.g. `GET /api/auth` → `{base}/api/auth`).

**Auth:** Most protected app routes accept **backend JWT** or **Firebase ID token** where `appAuth` / `firebaseAuth` is used. Get a backend JWT from **POST /api/auth/sync** (Firebase ID token in `Authorization`) or **POST /api/admin/login** (Prisma admin username/password).

---

## 1. App (Tenant & Landlord) — Main frontend

Use these endpoints in the **main LeaseSpaces app** (browse properties, apply, manage listings).

### 1.1 Auth (shared with admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/auth` | None | Health check; list of auth endpoints |
| POST | `/api/auth/otp/request` | None | Manual auth: send OTP to email. Body: `{ "email": "user@example.com" }`. |
| POST | `/api/auth/otp/verify` | None | Manual auth: verify OTP + get backend JWT. Body: `{ "email": "user@example.com", "otp": "123456" }`. |
| POST | `/api/auth/onboarding` | Backend JWT | First-time profile setup. Body: `{ "name", "surname", "role": "tenant" \| "landlord" }`. |
| POST | `/api/auth/sync` | Firebase ID token in header | **Main login flow.** Send `Authorization: Bearer <firebase_id_token>`. Returns `{ success, user, token }`. Use `token` as backend JWT for all other requests. |
| POST | `/api/auth/firebase` | None | Same as sync; send `{ "idToken": "<firebase_id_token>", "registrationType": "GOOGLE" \| "EMAIL" \| "FACEBOOK" \| "APPLE" }` in body. Returns `{ success, user, token }`. |

**App flow (Firebase):** Sign in with Firebase (e.g. Google/Email) → get Firebase ID token → **POST /api/auth/sync** with that token in header → store returned `token` (backend JWT) → use it in `Authorization: Bearer <token>` for all protected app requests.

**App flow (Manual OTP):** **POST /api/auth/otp/request** → user enters OTP from email → **POST /api/auth/otp/verify** → if `onboardingRequired: true` call **POST /api/auth/onboarding**.

**Google / mobile:** Prefer **POST /api/auth/sync** or **POST /api/auth/firebase** with `registrationType: "GOOGLE"`; optional `appRole` for new users. Backend links existing users by **email** to the Firebase UID when needed.

---

### 1.2 Properties (browse, search, create, update, delete)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/properties` | None | List properties. Query: `page`, `limit`, `location`, `minPrice`, `maxPrice`, `propertyType`, `bedrooms`, `bathrooms`, `rentalType`, `amenities`, `sortBy`, `sortOrder`. |
| GET | `/api/properties/:propertyId` | None | Get one property by ID. |
| POST | `/api/properties/search` | None | Search. Body: `{ "query?", "filters?", "sortBy?", "sortOrder?" }`. |
| POST | `/api/properties` | Backend JWT or Firebase ID token | Create property (landlord). Body: `title`, `description`, `price`, `propertyType`, `rentalType`, `bedrooms`, `bathrooms`, `location`, etc. |
| PUT | `/api/properties/:propertyId` | Backend JWT or Firebase ID token | Update property (landlord). |
| DELETE | `/api/properties/:propertyId` | Backend JWT or Firebase ID token | Delete property (landlord). |

**App usage:** List/search with GET (no auth). Create/edit/delete with POST/PUT/DELETE + `Authorization: Bearer <backend_jwt>`.

---

### 1.3 Applications (tenant applications)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/applications` | Backend JWT or Firebase ID token | List current user’s applications. Query: `status`, `page`, `limit`. |
| POST | `/api/applications` | Backend JWT or Firebase ID token | Create application. Body: `{ "propertyId": "<uuid>", "moveInDate?", "message?", "documents?" }`. |
| PUT | `/api/applications/:applicationId/status` | Backend JWT or Firebase ID token | Update status. Body: `{ "status": "approved" \| "rejected", "message?" }`. |

**App usage:** Tenant: GET my applications, POST new application. Landlord: PUT to approve/reject (same token).

---

### 1.4 Mobile parity (`/api/mobile`)

Same as **`/api/properties`** and **`/api/applications`**, prefixed with `/mobile` (legacy register/login + browse + applications).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/login` | None | Legacy login |
| GET | `/api/mobile/properties` | None | List properties |
| GET | `/api/mobile/properties/:id` | None | Property detail |
| POST | `/api/mobile/properties/search` | None | Search |
| GET/POST | `/api/mobile/applications` | Backend JWT or Firebase ID token | Same as `/api/applications` |
| PUT | `/api/mobile/applications/:applicationId/status` | Backend JWT or Firebase ID token | Same as `/api/applications/.../status` |

### 1.5 Support tickets (`/api/tickets`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tickets` | None* | List tickets (query filters) |
| GET | `/api/tickets/:id` | None* | Ticket detail |
| POST | `/api/tickets` | None* | Create ticket |
| PUT | `/api/tickets/:id` | None* | Update |
| DELETE | `/api/tickets/:id` | None* | Delete |
| GET | `/api/tickets/statuses` | None* | Statuses |
| GET | `/api/tickets/priorities` | None* | Priorities |
| GET | `/api/tickets/categories` | None* | Categories |
| GET | `/api/tickets/agents` | None* | Agents |
| PUT | `/api/tickets/agents/:id/workload` | None* | Body: `{ maxTickets }` |
| GET | `/api/tickets/stats` | None* | Stats |
| GET/POST/PUT/DELETE | `/api/tickets/email-templates`… | None* | Email templates + send stub |

\* **Security:** These routes are currently **unauthenticated**. Restrict at the edge (e.g. admin-only) or add middleware before public exposure.

---

## 2. Admin — Admin dashboard

Use these endpoints in the **admin dashboard** (LeaseSpaces admin app).

### 2.1 Auth for admin

- Same as app: **POST /api/auth/sync** with Firebase ID token → get backend JWT.
- The user must have **`appRole: "admin"`** in the database to access admin-only routes below.
- **Prisma admin (username = email):** **POST /api/admin/login** with `{ "username", "password" }` → backend JWT (or 2FA flow).
- Optional legacy Firestore: **POST /api/admin/admin-login** with `{ "email", "password" }`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/sync` | Firebase ID token | Use same as app; ensure user is admin in DB. |
| POST | `/api/admin/login` | None | Prisma admin login. Body: `{ "username", "password" }`. |
| POST | `/api/admin/admin-login` | None | Legacy Firestore. Body: `{ "email", "password" }`. |

---

### 2.2 Admin-only routes (require backend JWT + appRole admin)

Send **`Authorization: Bearer <backend_jwt>`** or **Firebase ID token** where noted (`appAuth`); user must have `appRole: "admin"`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats (totalProperties, totalUsers, totalApplications, pendingApplications, revenue). |
| GET | `/api/admin/properties/analytics` | Property analytics. Query: `period=7d \| 30d \| 90d \| 1y`. |
| POST | `/api/admin/users/admins` | **Super admin only**: Create admin user. Body: `{ name, surname, email, password, isSuperAdmin? }`. |
| POST | `/api/admin/support/agents` | **Super admin only**: Create support agent. Body: `{ name, email, role?, maxTickets?, isActive? }`. |
| GET | `/api/admin/properties` | Admin property list (table). Query: `q`, `type`, `location`, `minPrice`, `maxPrice`, `moderationStatus`, `availabilityStatus`, `page`, `limit`, `sortBy`, `sortOrder`. |
| GET | `/api/admin/properties/:propertyId` | Admin property details (modal). |
| PATCH | `/api/admin/properties/:propertyId/moderation` | Moderate property. Body: `{ action: "approve"|"decline"|"flag_for_review"|"set_pending", notes? }` (notes required when flagging). |
| PATCH | `/api/admin/properties/:propertyId/availability` | Update availability. Body: `{ availabilityStatus: "available"|"unavailable"|"occupied" }`. |
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
- **Login:** `POST /api/auth/sync` (Firebase) **or** `POST /api/admin/login` (username/password). For super-admin-only actions, user needs `isSuperAdmin: true` (see `GET /api/admin/admin-profile`).
- **Then use:** `Authorization: Bearer {{token}}` for:
  - `GET /api/admin/dashboard`
  - `GET /api/admin/properties/analytics?period=30d`
  - `GET /api/admin/properties` (table), `GET /api/admin/properties/:id`, `PATCH .../moderation`, `PATCH .../availability`
  - `POST /api/admin/users/admins`, `POST /api/admin/support/agents` (super admin only)
  - `GET /api/admin/admin-profile`
  - `GET/POST/PUT /api/admin/settings/app`
  - `GET/POST/PUT /api/admin/settings/smtp`, `POST /api/admin/settings/smtp/test`
  - `POST /api/admin/settings/upload`
  - `DELETE /api/admin/delete-admin` (with body `{ "otp": "..." }` if 2FA enabled)

---

## 4. Environment variables for frontends

- **App:** `VITE_API_URL` or `REACT_APP_API_URL` = full API root including `/api`, e.g. `http://localhost:8080/api` or `https://<your-run-host>/api`. Then request paths are relative: `/auth`, `/properties`, not `/api/properties` again.
- **Admin:** Same base URL pattern as the app.

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
