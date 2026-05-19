# LeaseSpaces Backend

Node.js/Express API for the LeaseSpaces property rental platform. Uses **Firebase** for auth and **Neon (PostgreSQL)** via Prisma.

---

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start server
npm run dev
```

Server runs at **http://localhost:8080**. API routes are under `/api/`.

---

## Tech Stack

- **Node.js** · **Express.js** · **TypeScript**
- **Firebase Admin SDK** · **Prisma** · **Neon (PostgreSQL)**  
- **JWT** · **CORS** · **Multer** (uploads)

---

## API Documentation

| Document | Purpose |
|----------|---------|
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | Full reference (auth, properties, applications, **chat**, admin, settings) |
| [API_ENDPOINTS_GUIDE.md](./API_ENDPOINTS_GUIDE.md) | App vs admin endpoint guide |
| [AUTH_AND_2FA_ENDPOINTS.md](./AUTH_AND_2FA_ENDPOINTS.md) | Auth, OTP, 2FA flows |
| [POSTMAN_AUTH_TESTING.md](./POSTMAN_AUTH_TESTING.md) | Postman testing steps |

### Base URL & Port

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:8080` |
| Production | Configure via deployment |

All API routes are prefixed with `/api/` unless noted.

---

### How Frontends Connect

#### 1. CORS

CORS is enabled, so browsers can call the API from any origin. Configure allowed origins in `app.ts` for production.

#### 2. Request Format

- **Content-Type**: `application/json` for JSON bodies
- **Auth**: Protected routes use `Authorization: Bearer <token>` (backend JWT after sync)

#### 3. Auth Flow (LeaseSpaces)

```
1. User signs in on frontend (Firebase Auth – Google, Email, etc.)
2. Frontend receives Firebase ID token from signInWithCredential / getIdToken()
3. Frontend calls POST /api/auth/sync with header: Authorization: Bearer <firebase_id_token>
   OR POST /api/auth/firebase with body: { idToken, registrationType }
4. Backend verifies Firebase token, finds/creates user in Neon, returns { user, token } (backend JWT)
5. Frontend stores the backend token and uses it for all other protected API calls:
   Authorization: Bearer <backend_jwt>
```

#### 4. Protected vs Public Routes

- **Public**: No `Authorization` header (e.g. `GET /api/auth`, `GET /api/properties`)
- **Protected**: Require `Authorization: Bearer <backend_jwt>` (e.g. `POST /api/applications`, `GET /api/admin/dashboard`)
- **Admin-only**: Require `Authorization` and user with `appRole: "admin"`

#### 5. Error Response Format

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

### API Endpoints Reference

#### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth` | None | Health check; returns available auth endpoints |
| POST | `/api/auth/firebase` | None | Body: `{ idToken, registrationType }`. Verifies Firebase token, syncs user, returns `{ success, user, token }` |
| POST | `/api/auth/sync` | None | Header: `Authorization: Bearer <firebase_id_token>`. Same as above; returns `{ success, user, token }` |

**Registration types**: `GOOGLE`, `FACEBOOK`, `APPLE`, `EMAIL`.

#### Properties (`/api/properties`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/properties` | None | List properties with filters |
| GET | `/api/properties/:propertyId` | None | Get single property |
| POST | `/api/properties/search` | None | Body: `{ query?, filters?, sortBy?, sortOrder? }`. Search properties |
| POST | `/api/properties` | Firebase JWT | Create property |
| PUT | `/api/properties/:propertyId` | Firebase JWT | Update property |
| DELETE | `/api/properties/:propertyId` | Firebase JWT | Delete property |
| GET/POST | `/api/properties/:propertyId/chats` | Bearer | Tenant: get/start chat with landlord |

**Query params (GET /properties)**: `page`, `limit`, `location`, `minPrice`, `maxPrice`, `propertyType`, `bedrooms`, `bathrooms`, `rentalType`, `amenities`, `sortBy`, `sortOrder`

#### Applications (`/api/applications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/applications` | Firebase JWT | List current user's applications |
| POST | `/api/applications` | Firebase JWT | Create application (returns `conversation`) |
| PUT | `/api/applications/:applicationId/status` | Firebase JWT | Update status (body: `{ status: "approved" \| "rejected", message? }`) |

**Query params (GET)**: `status`, `page`, `limit`

#### Chat (`/api/chats`)

Tenant ↔ landlord messaging. Stored in **Firestore**; REST returns ISO timestamps.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chats` | Inbox |
| POST | `/api/chats` | Create/get thread (`propertyId`, `applicationId`, or `tenantId` for landlords) |
| GET | `/api/chats/:id/history` | Message history (`page`, `limit`, `before`, `after`, `order`) |
| POST | `/api/chats/:id/messages` | Send message |
| POST | `/api/chats/:id/read` | Mark read |

Full reference: **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** (Chat section) and **[API_ENDPOINTS_GUIDE.md](./API_ENDPOINTS_GUIDE.md)**.

**Firebase / Firestore (chat):**

| Goal | Setup |
|------|--------|
| Local → **real** Firebase | `GOOGLE_APPLICATION_CREDENTIALS` = service account JSON; **unset** `USE_FIRESTORE_EMULATOR` |
| Local → **emulator** | `USE_FIRESTORE_EMULATOR=true`, `npm run emulator:firestore`, then `npm run dev` |
| **Production** | `firebase deploy` — no emulator vars; ADC on Cloud Functions |

See **[FIREBASE_DEPLOY.md](./FIREBASE_DEPLOY.md)** for PowerShell examples and deploy steps.

**Local chat testing (emulator):** `npm run emulator:firestore` + `USE_FIRESTORE_EMULATOR=true` + `npm run test:chat`

#### Admin (`/api/admin`)

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

#### Settings

**Public reads:** `GET /api/settings/app`, `/about`, `/privacy-policy`, `/terms-and-conditions` (no auth).

**Admin writes:** `/api/admin/settings/*` (requires admin JWT).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/settings/app` | Admin | Get app settings |
| POST | `/api/admin/settings/app` | None | Save app settings |
| PUT | `/api/admin/settings/app` | None | Update app settings |
| GET | `/api/admin/settings/about` | None | Get About page content |
| POST | `/api/admin/settings/about` | None | Save About page content |
| PUT | `/api/admin/settings/about` | None | Update About page content |
| DELETE | `/api/admin/settings/about` | None | Delete About page content |
| GET | `/api/admin/settings/privacy-policy` | None | Get Privacy Policy content |
| POST | `/api/admin/settings/privacy-policy` | None | Save Privacy Policy content |
| PUT | `/api/admin/settings/privacy-policy` | None | Update Privacy Policy content |
| DELETE | `/api/admin/settings/privacy-policy` | None | Delete Privacy Policy content |
| GET | `/api/admin/settings/terms-and-conditions` | None | Get Terms & Conditions content |
| POST | `/api/admin/settings/terms-and-conditions` | None | Save Terms & Conditions content |
| PUT | `/api/admin/settings/terms-and-conditions` | None | Update Terms & Conditions content |
| DELETE | `/api/admin/settings/terms-and-conditions` | None | Delete Terms & Conditions content |
| GET | `/api/admin/settings/smtp` | None | Get SMTP config |
| POST | `/api/admin/settings/smtp` | None | Save SMTP config |
| PUT | `/api/admin/settings/smtp` | None | Update SMTP config |
| POST | `/api/admin/settings/smtp/test` | None | Test SMTP connection |
| POST | `/api/admin/settings/upload` | None | Upload file |

---

### What Is Missing (vs Spec)

| Area | Status |
|------|--------|
| Auth: register, login, reset-password, verify-email | ❌ Missing |
| User: GET/PUT profile, avatar upload | ❌ Missing |
| Property images upload | ❌ Missing |
| Application documents upload | ❌ Missing |
| Notifications: GET list, PUT mark-as-read | ❌ Missing |
| Locations: cities, provinces, geocode | ❌ Missing |
| General upload (avatar, property_image, document) | ⚠️ Partial |
| WebSockets | ❌ Not implemented |

---

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRETE` | Backend JWT signing secret |
| `GOOGLE_APPLICATION_CREDENTIALS` | **Local only:** path to service account JSON (real Firebase). Not needed on deployed Functions. |
| `USE_FIRESTORE_EMULATOR` | Set to `true` only for local emulator; **omit** for real Firebase / production |
| `FIRESTORE_EMULATOR_HOST` | e.g. `127.0.0.1:8085` — only with emulator; **unset** for production |
| `API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID` | Firebase client config |
| `SMTP_SECRET_KEY`, `SMTP_SECRET_IV` | For settings (SMTP encryption) |

---

### Frontend Integration Example

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
#
