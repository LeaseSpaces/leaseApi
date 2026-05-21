# API Endpoints Guide — App & Admin

Use this guide to connect the **main app** (tenant/landlord) and the **admin dashboard** to their dedicated API endpoints.

**Base URL (local):** `http://localhost:8080` by default, or set env **`PORT`** (e.g. `8081`).  
**Base URL (production):** `https://api3-jfh4l76lzq-bq.a.run.app/api` (**api3**, recommended for new clients)

- **Legacy:** `https://api-jfh4l76lzq-bq.a.run.app/api` (**api** — same Express app)
- **Firebase Functions:** use the **Cloud Run** URL printed after `firebase deploy --only functions` (format `https://<id>.<region>.run.app/api`).
- **`cloudfunctions.net`:** `https://africa-south1-easespaces-7d30b.cloudfunctions.net/api` — call paths like **`/api/auth`**, **`/api/admin/properties`**, etc. (Do **not** double the host in the client; set `VITE_API_URL` to the base that already ends with `/api` or to the origin only, never `cloudfunctions.net` + full URL again.)

All endpoints below are under **`/api/`** (e.g. `GET /api/auth` → `{base}/api/auth`).

> **Legend:** Endpoints marked with **🆕** were added or significantly extended in the **May 2026** release (chat, multi-step applications, landlord portal, leases, maintenance, public support, admin application review).

---

## What's new (May 2026) — quick index

| Area | New paths (summary) |
|------|---------------------|
| **Apply for rental** | `GET .../apply-form`, `PATCH .../applications/:id`, `POST .../documents`, `POST .../submit`, `GET/PATCH .../incoming/*` |
| **Chat** | `GET/POST /api/chats/*`, `GET/POST /api/properties/:id/chats` |
| **Landlord portal** | `/api/landlord/properties`, `/applications`, `/leases`, `/maintenance` |
| **Leases** | `GET /api/leases/me`, `GET /api/leases/:id`, `GET /api/properties/:id/lease` |
| **Maintenance** | `POST/GET /api/maintenance`, landlord `GET/PATCH .../landlord/maintenance` |
| **Public support** | `GET /api/support/form`, `POST /api/support/tickets` |
| **Favourites** | `POST /api/favorites/toggle`, `GET /api/favorites`, `GET /api/favorites/check` |
| **Profile** | `GET/PATCH /api/profile`, `POST /api/profile/avatar`, `POST /api/profile/2fa/*`, `DELETE /api/profile` |
| **Admin** | `GET/PATCH /api/admin/applications/*`, `PATCH .../documents-verification` |

---

**Auth:** Protected routes use **`appAuth`** unless noted — accepts **either**:
- **Backend JWT** from `POST /api/admin/login` (admin panel) or `POST /api/auth/sync` / OTP verify (app)
- **Firebase ID token** from Google/email sign-in

Header: `Authorization: Bearer <token>`

**Admin panel:** Prefer **`POST /api/admin/login`** → use returned **`token`** (not `temporaryToken` from the 2FA step until OTP is verified).

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
| POST | `/api/auth/sync` | Firebase ID token in header | **Main login flow.** Returns `{ token }` or `{ requires2fa, temporaryToken }` if 2FA enabled. |
| POST | `/api/auth/firebase` | None | Same as sync; body: `{ idToken, registrationType?, appRole? }`. |
| POST | `/api/auth/2fa/verify-login` | None | **2FA step 2.** Body: `{ temporaryToken, otp }` → full `token`. |

**App flow (Firebase):** Sign in with Firebase (e.g. Google/Email) → get Firebase ID token → **POST /api/auth/sync** with that token in header → if `requires2fa: true`, show authenticator code screen → **POST /api/auth/2fa/verify-login** with `{ temporaryToken, otp }` → store final `token` → use `Authorization: Bearer <token>` on protected routes.

**App flow (Manual OTP):** **POST /api/auth/otp/request** → user enters email OTP → **POST /api/auth/otp/verify** → if `requires2fa: true`, complete **POST /api/auth/2fa/verify-login** → if `onboardingRequired: true` call **POST /api/auth/onboarding**.

**2FA on login (tenant, landlord, admin):** When `twofa_enabled` is true (e.g. enabled under **POST /api/profile/2fa/enable**), primary login returns `requires2fa: true` and `temporaryToken` (2 min) — **not** a session JWT. Do not call protected APIs until verify-login succeeds.

**Google / mobile:** Prefer **POST /api/auth/sync** or **POST /api/auth/firebase** with `registrationType: "GOOGLE"`; optional `appRole` for new users. Backend links existing users by **email** to the Firebase UID when needed.

---

### 1.2 Properties (browse, search, create, update, delete)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/properties` | None | List **approved + available** listings only (browse). Query: `page`, `limit`, `location`, `minPrice`, `maxPrice`, `propertyType`, `bedrooms`, `bathrooms`, `rentalType`, `amenities`, `sortBy`, `sortOrder`. |
| GET | `/api/properties/:propertyId` | None | Get one property by ID. |
| POST | `/api/properties/search` | None | Search. Body: `{ "query?", "filters?", "sortBy?", "sortOrder?" }`. |
| POST | `/api/properties` | Backend JWT or Firebase ID token | Create property (landlord). Body: `title`, `description`, `price`, `propertyType`, `rentalType`, `bedrooms`, `bathrooms`, `location`, etc. |
| PUT | `/api/properties/:propertyId` | Backend JWT or Firebase ID token | Update property (landlord). |
| DELETE | `/api/properties/:propertyId` | Backend JWT or Firebase ID token | Delete property (landlord). |

**App usage:** List/search with GET (no auth). Create/edit/delete with POST/PUT/DELETE + `Authorization: Bearer <backend_jwt>`.

---

### 1.3 Apply for rental (multi-step — matches mobile UI) — 🆕

**Auth:** Backend JWT (OTP token) or Firebase ID token.

#### Step 0 — Load form + property summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| 🆕 GET | `/api/properties/:propertyId/apply-form` | Property rent label, step field schema, `existingDraft` if any |
| 🆕 GET | `/api/mobile/properties/:propertyId/apply-form` | Same (mobile prefix) |

#### Step 1 — Personal info (create or update draft)

| Method | Endpoint | Body |
|--------|----------|------|
| 🆕 POST | `/api/applications` | Create **draft**. See body below. |
| 🆕 PATCH | `/api/applications/:applicationId` | Update personal info on draft |

```json
{
  "propertyId": "uuid",
  "moveInDate": "2026-06-01",
  "annualIncome": 75000,
  "currentEmployment": "Acme Corp — Developer",
  "reference1": "Jane Doe — jane@example.com",
  "reference2": "John Smith — 082 123 4567",
  "message": "Tell the landlord why you'd be a great tenant..."
}
```

#### Step 2 — Documents (multipart or JSON)

| Method | Endpoint | Body |
|--------|----------|------|
| 🆕 POST | `/api/applications/:applicationId/documents` | **Multipart** `multipart/form-data`: field names `governmentId`, `proofOfIncome`, `referenceLetters` (optional). PDF/JPG/PNG, max 10MB each. **Do not** set `Content-Type` manually (let the client add the boundary). |
| 🆕 POST | (same) | **JSON fallback:** `Content-Type: application/json` with `{ "governmentId": { "fileName", "mimeType", "data": "<base64>" }, ... }` |

Also: `/api/mobile/applications/:applicationId/documents`

#### Step 3 — Review & submit

| Method | Endpoint | Body |
|--------|----------|------|
| 🆕 GET | `/api/applications/:applicationId` | Summary for review screen |
| 🆕 POST | `/api/applications/:applicationId/submit` | `{ "termsAccepted": true }` — sets status `pending`, creates chat `conversation` |

**Submit response** includes `application` (summary), `conversation`, and `message` (“reviewed within 2–3 business days”).

#### Tenant — my applications

| Method | Endpoint | Description |
|--------|----------|-------------|
| 🆕 GET | `/api/applications` | List my submitted applications (excludes drafts). Query: `status`, `page`, `limit`. |

#### Landlord — review incoming (own properties)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| 🆕 GET | `/api/applications/incoming` | Landlord or admin JWT | Applications for properties you own. Query: `status`, `propertyId`, `search`, `page`, `limit`. |
| 🆕 GET | `/api/applications/incoming/:applicationId` | Landlord or admin | Full detail: tenant, documents, references, employment, income. |
| 🆕 PATCH | `/api/applications/incoming/:applicationId/decision` | Landlord or admin | Body: `{ "decision": "approved" \| "rejected", "reviewNotes?" }`. **Approve** creates an active **lease** and sets property `occupied`. |

**Document verification (vendor — read-only for landlord):** Application detail includes `documentsVerification`: `{ status, verifiedAt, notes, allDocumentsVerified, documents[] }` with per-doc `verificationStatus` (`pending` \| `in_review` \| `verified` \| `rejected`). Admin/vendor updates: **🆕** `PATCH /api/admin/applications/:id/documents-verification`.

Legacy alias: `PUT /api/applications/:applicationId/status` with `{ "status": "approved" \| "rejected" }`.

**Mobile parity:** `/api/mobile/applications/*` — same routes and bodies.

---

### 1.8 Landlord portal (`/api/landlord`) — 🆕

**Auth:** `appRole: landlord` or `admin`. Header: `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| 🆕 GET | `/api/landlord/properties` | My listings (all moderation/availability states) |
| 🆕 POST | `/api/landlord/properties` | Create listing → `moderationStatus: pending_approval` |
| 🆕 PUT | `/api/landlord/properties/:propertyId` | Update own listing (cannot change moderation/availability) |
| 🆕 DELETE | `/api/landlord/properties/:propertyId` | Delete own listing |
| 🆕 GET | `/api/landlord/applications` | Incoming applications (same as `/api/applications/incoming`) |
| 🆕 GET | `/api/landlord/applications/:applicationId` | Application detail + `documentsVerification` |
| 🆕 PATCH | `/api/landlord/applications/:applicationId/decision` | Approve / reject |
| 🆕 GET | `/api/landlord/leases` | My active/past leases |
| 🆕 GET | `/api/landlord/maintenance` | Maintenance requests for my properties. Query: `status`, `propertyId` |
| 🆕 PATCH | `/api/landlord/maintenance/:requestId` | Update status: `open` \| `in_progress` \| `resolved` \| `closed` |

**Alias:** `/api/applications/incoming/*` — same handlers as landlord applications.

---

### 1.9 Leases (occupied properties) — 🆕

When an application is **approved**, a **Lease** is created and the property becomes **`occupied`**. Both tenant and landlord can view the agreement.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| 🆕 GET | `/api/leases/me` | Tenant or landlord | List my leases. Query: `status` (`active` \| `ended` \| `cancelled`) |
| 🆕 GET | `/api/leases/:leaseId` | Tenant or landlord | Lease detail incl. `agreementUrl`, rent, dates |
| 🆕 GET | `/api/properties/:propertyId/lease` | Tenant or landlord | Active lease for this property (if you are the tenant or landlord) |

**Lease object (excerpt):**
```json
{
  "id": "uuid",
  "status": "active",
  "propertyTitle": "Luxury Apartment in Sandton",
  "startDate": "2026-07-01",
  "endDate": null,
  "monthlyRent": 2500,
  "monthlyRentLabel": "R2 500",
  "agreementUrl": "https://...",
  "agreementNotes": "Standard LeaseSpaces rental agreement..."
}
```

---

### 1.10 Maintenance (tenant reports, landlord manages) — 🆕

Tenants with an **active lease** on a property can report issues.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| 🆕 POST | `/api/maintenance` | Tenant | Body: `{ propertyId, title, description, priority?, images? }`. `priority`: `low` \| `medium` \| `high` \| `urgent` |
| 🆕 GET | `/api/maintenance` | Tenant | My requests. Query: `status` |
| 🆕 GET | `/api/maintenance/:requestId` | Tenant | One request |
| 🆕 GET | `/api/landlord/maintenance` | Landlord | Queue for my properties |
| 🆕 PATCH | `/api/landlord/maintenance/:requestId` | Landlord | Body: `{ "status": "in_progress" }` etc. |

---

### 1.4 Chat (tenant ↔ landlord) — 🆕

Messages are stored in **Firestore**; API returns ISO timestamps (`sentAt`, `createdAt`, `readAt`). Auth: backend JWT or Firebase ID token.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| 🆕 GET | `/api/properties/:propertyId/chats` | Bearer | Tenant: get chat for listing |
| 🆕 POST | `/api/properties/:propertyId/chats` | Bearer | Tenant: **Message landlord** (create/get thread) |
| 🆕 GET | `/api/chats` | Bearer | Inbox. Query: `page`, `limit` |
| 🆕 POST | `/api/chats` | Bearer | Create/get thread. Body: `propertyId` and/or `applicationId`; landlords add `tenantId` |
| 🆕 GET | `/api/chats/:conversationId` | Bearer | Conversation detail + last message |
| 🆕 GET | `/api/chats/:conversationId/history` | Bearer | **History** with timestamps. Query: `page`, `limit`, `order`, `after`, `before` |
| 🆕 GET | `/api/chats/:conversationId/messages` | Bearer | Same as `/history` |
| 🆕 POST | `/api/chats/:conversationId/messages` | Bearer | Send. Body: `{ "body": "..." }` |
| 🆕 POST | `/api/chats/:conversationId/read` | Bearer | Mark read |
| 🆕 GET | `/api/chats/:conversationId/stream` | Bearer | SSE (optional) |

**Conversation id:** `{propertyId}_{tenantId}`

**Tenant flow:** `POST .../properties/:id/chats` → `GET .../chats/:id/history` → `POST .../messages`

See **API_DOCUMENTATION.md** → Chat for full request/response examples.

---

### 1.5 Mobile parity (`/api/mobile`)

Legacy mobile API endpoints, mostly wrapping the same property/application flows plus user location support. Use these if your mobile client needs the older `/api/mobile` path prefix.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/login` | None | Legacy login |
| GET | `/api/mobile/properties` | None | List properties |
| GET | `/api/mobile/properties/:id` | None | Property detail |
| POST | `/api/mobile/properties/search` | None | Search |
| GET | `/api/mobile/user-locations` | Backend JWT or Firebase ID token | Get current user locations |
| PUT | `/api/mobile/update-location/:locationId` | Backend JWT or Firebase ID token | Update a user location |
| GET/POST | `/api/mobile/applications` | Backend JWT or Firebase ID token | Same as `/api/applications` |
| PUT | `/api/mobile/applications/:applicationId/status` | Backend JWT or Firebase ID token | Same as `/api/applications/.../status` |
| 🆕 GET/POST | `/api/mobile/properties/:propertyId/chats` | Firebase ID token | Tenant property chat shortcuts |
| 🆕 * | `/api/mobile/chats/*` | Backend JWT or Firebase (`appAuth`) | Same as `/api/chats/*` |

### 1.12 Profile & account settings (tenant & landlord) — 🆕

**Auth:** `appAuth` (backend JWT or Firebase ID token). Works for **tenant** and **landlord** (not admin — admins use `/api/admin/admin-profile` and `/api/admin/delete-admin`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| 🆕 GET | `/api/profile` | Current profile + settings flags (`canEnable2fa`, `hasPassword`, etc.) |
| 🆕 PATCH | `/api/profile` | Update `name`, `surname`, `email`, `phone` (alias: `cellphone`) |
| 🆕 POST | `/api/profile/avatar` | Upload profile image — **multipart**, field `avatar` or `image`. **Max 2MB.** JPEG/PNG/WebP |
| 🆕 POST | `/api/profile/2fa/init` | Start 2FA — returns `{ secret, qrCodeBase64 }` |
| 🆕 POST | `/api/profile/2fa/enable` | Body: `{ secret, otp }` |
| 🆕 POST | `/api/profile/2fa/disable` | Body: `{ otp }` |
| 🆕 DELETE | `/api/profile` | Delete account (permanent). Body below |

**2FA after enable:** Next login via `/api/auth/sync`, `/api/auth/firebase`, `/api/auth/otp/verify`, or admin `/api/admin/login` returns `requires2fa` + `temporaryToken`. Complete with **POST /api/auth/2fa/verify-login**.

**PATCH body (any fields):**
```json
{
  "name": "Jane",
  "surname": "Doe",
  "email": "jane@example.com",
  "phone": "+27821234567"
}
```

**POST avatar (multipart):**
- `Content-Type: multipart/form-data` — do **not** set the header manually (let the client add the boundary).
- Field: `avatar` or `image` (one file).
- Max size: **2MB**. Types: JPEG, PNG, WebP.
- Response includes `avatarUrl` and updated `profile`.

```http
POST /api/profile/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

avatar: <file>
```

**DELETE account body:**
```json
{
  "confirmEmail": "jane@example.com",
  "otp": "123456",
  "password": "optional-if-no-2fa"
}
```

- `confirmEmail` must match the signed-in user's email.
- If **2FA enabled**, `otp` is required.
- Else if the user has a **password**, `password` is required.
- Blocked with `409` if: active lease, property listings (landlord), or pending/draft applications.

**Mobile parity:** `/api/mobile/profile/*`

---

### 1.11 Favourites (tenant — saved listings / heart icon) — 🆕

**Auth:** Backend JWT or Firebase ID token (`appAuth`). Any signed-in user can save favourites (intended for tenants).

| Method | Endpoint | Description |
|--------|----------|-------------|
| 🆕 POST | `/api/favorites/toggle` | **Heart icon.** Body: `{ "propertyId": "uuid" }`. Returns `{ favorited: true \| false, propertyId, property?, favorite? }` |
| 🆕 POST | `/api/favorites` | Add favourite (idempotent). Body: `{ "propertyId": "uuid" }` |
| 🆕 DELETE | `/api/favorites/:propertyId` | Remove from favourites |
| 🆕 GET | `/api/favorites` | My saved properties (newest first). Query: `page`, `limit` |
| 🆕 GET | `/api/favorites/check` | Batch heart state for browse list. Query: `propertyIds=id1,id2` → `{ propertyIds, favorited: { "id1": true } }` |
| 🆕 GET | `/api/favorites/:propertyId/status` | Single property: `{ favorited, favoriteId, favoritedAt }` |

**Mobile parity:** `/api/mobile/favorites/*` — same routes and bodies.

**Frontend flow:**
1. Property list → `GET /api/favorites/check?propertyIds=...` to show filled/outline hearts.
2. Tap heart → `POST /api/favorites/toggle` with `{ propertyId }`.
3. Favourites tab → `GET /api/favorites`.

---

### 1.6 Public support (`/api/support`) — 🆕 no login

Use for the **“Create support ticket”** flow in the app or website.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| 🆕 GET | `/api/support/form` | None | Categories for the form + `defaultPriority` |
| 🆕 GET | `/api/support/categories` | None | Same as `/form` |
| 🆕 POST | `/api/support/tickets` | None | Submit ticket; confirmation email sent to submitter (`customerEmail`) |

**POST body:**
```json
{
  "category": "Account & Login",
  "description": "I cannot reset my password after multiple attempts...",
  "customerEmail": "user@example.com",
  "confirmEmail": "user@example.com",
  "customerName": "Jane Doe"
}
```

**POST response `201`:**
```json
{
  "success": true,
  "ticket": {
    "id": "...",
    "ticketNumber": "TKT-042",
    "category": "Account & Login",
    "status": "Sent",
    "createdAt": "..."
  },
  "emailSent": true,
  "confirmationEmailSentTo": "user@example.com",
  "message": "Your support ticket has been received. A confirmation email was sent to user@example.com..."
}
```

Confirmation is emailed to the submitter only, not to support agents.

---

### 1.7 Support tickets admin (`/api/tickets`)

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

### 2.0 Admin must wire (May 2026) — 🆕 new screens

These are the **new** backend routes the admin UI should integrate. All require `Authorization: Bearer <token>` from `POST /api/admin/login` (and `appRole: admin`).

| # | Screen / action | Method | Endpoint |
|---|-----------------|--------|----------|
| 1 | Applications list (table, filters, pagination) | 🆕 GET | `/api/admin/applications` |
| 2 | Application review (tenant, property, docs, references) | 🆕 GET | `/api/admin/applications/:applicationId` |
| 3 | Approve or reject application | 🆕 PATCH | `/api/admin/applications/:applicationId/decision` |
| 4 | Document verification (vendor workflow) | 🆕 PATCH | `/api/admin/applications/:applicationId/documents-verification` |

**List query params:** `status`, `propertyId`, `landlordId`, `tenantId`, `search`, `page`, `limit`, `sortBy` (`createdAt` \| `updatedAt` \| `status`), `sortOrder`, `includeDrafts=true` (default list excludes drafts).

**Approve / reject body:**
```json
{ "decision": "approved", "reviewNotes": "Optional note shown in audit trail." }
```
Only **`pending`** applications can be decided. **Approve** creates a **lease** and sets the property to **`occupied`** (same as landlord approve).

**Documents verification body:**
```json
{
  "status": "verified",
  "notes": "All IDs checked.",
  "documentUpdates": [
    { "type": "government_id", "verificationStatus": "verified" },
    { "type": "proof_of_income", "verificationStatus": "verified" }
  ]
}
```
`status`: `pending` \| `in_review` \| `verified` \| `partial` \| `rejected`. Detail responses include read-only `documentsVerification` until this PATCH is called.

**Not admin dashboard** (do not mount on admin app): `/api/landlord/*`, `/api/chats/*`, `/api/maintenance`, `POST /api/support/tickets` (public app flow). Admin may still use **`GET /api/tickets`** (see §1.7) for the support desk if you expose it behind your own auth.

---

### 2.1 Auth for admin

**Recommended (admin dashboard):**

```http
POST /api/admin/login
Content-Type: application/json

{ "username": "admin@leasespaces.local", "password": "..." }
```

**Response (no 2FA):**
```json
{ "success": true, "token": "eyJhbG...", "user": { "id": 1, "role": "admin", ... } }
```

Use **`token`** on every admin request: `Authorization: Bearer <token>`.

| Case | What to send |
|------|----------------|
| Normal login | `token` from response |
| 2FA enabled | `requires2fa: true` + `temporaryToken` → complete OTP → use **final** `token`, **not** `temporaryToken` |
| Google sign-in admin | Firebase ID token also works (`appAuth`) if user has `appRole: admin` |

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/login` | None | **Primary.** Body: `{ "username", "password" }` (username = email). |
| POST | `/api/auth/sync` | Firebase ID token | Alternative; user must be `appRole: admin` in DB. |
| POST | `/api/admin/admin-login` | None | Legacy Firestore admin. |

**401 `INVALID_TOKEN`?** Use `token` from `/api/admin/login`, not Firebase unless using Google sign-in. See `error.hint` in the JSON body.

---

### 2.2 Admin-only routes (`appAuth` + `appRole: admin`)

All routes below accept **`Authorization: Bearer <token>`** where `<token>` is the backend JWT from **`POST /api/admin/login`** **or** a Firebase ID token.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats (totalProperties, totalUsers, totalApplications, pendingApplications, revenue). |
| GET | `/api/admin/properties/analytics` | Property analytics. Query: `period=7d \| 30d \| 90d \| 1y`. |
| POST | `/api/admin/users/admins` | **Super admin only**: Create admin user. Body: `{ name, surname, email, password, isSuperAdmin? }`. |
| POST | `/api/admin/support/agents` | **Super admin only**: Create support agent. Body: `{ name, email, role?, maxTickets?, isActive? }`. |
| POST | `/api/admin/users/:userId/2fa/init` | **Super admin:** generate secret + QR for user. |
| POST | `/api/admin/users/:userId/2fa/enable` | **Super admin:** Body `{ "secret", "otp" }`. |
| POST | `/api/admin/users/:userId/2fa/disable` | **Super admin:** disable 2FA for user. |
| GET | `/api/admin/properties` | Admin property list (table). Query: `q`, `type`, `location`, `minPrice`, `maxPrice`, `moderationStatus`, `availabilityStatus`, `page`, `limit`, `sortBy`, `sortOrder`. |
| GET | `/api/admin/properties/:propertyId` | Admin property details (modal). |
| PATCH | `/api/admin/properties/:propertyId/moderation` | Moderate property. Body: `{ action: "approve"|"decline"|"flag_for_review"|"set_pending", notes? }` (notes required when flagging). |
| PATCH | `/api/admin/properties/:propertyId/availability` | Update availability. Body: `{ availabilityStatus: "available"|"unavailable"|"occupied" }`. |
| GET | `/api/admin/admin-profile` | Admin profile (current user). |
| DELETE | `/api/admin/delete-admin` | Delete current admin (high-security). Body: `{ "otp": "<totp_code>" }` when 2FA enabled. |

#### Rental applications (admin review) — 🆕

| Method | Endpoint | Description |
|--------|----------|-------------|
| 🆕 GET | `/api/admin/applications` | List all applications. Query: `status`, `propertyId`, `landlordId`, `tenantId`, `search`, `page`, `limit`, `sortBy`, `sortOrder`, `includeDrafts=true`. Default excludes drafts. |
| 🆕 GET | `/api/admin/applications/:applicationId` | Full application for review (tenant, property, landlord, documents, references). |
| 🆕 PATCH | `/api/admin/applications/:applicationId/decision` | Approve or reject. Body: `{ "decision": "approved" \| "rejected", "reviewNotes?" }`. Only **pending** applications. |
| 🆕 PATCH | `/api/admin/applications/:applicationId/documents-verification` | Vendor workflow: update document verification status. |

**Example approve:**
```json
PATCH /api/admin/applications/{id}/decision
{ "decision": "approved", "reviewNotes": "Strong application — approved." }
```

---

### 2.3 Settings (public + admin)

**Public (main app, no auth):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/app` | App branding/settings |
| GET | `/api/settings/about` | About page |
| GET | `/api/settings/privacy-policy` | Privacy policy |
| GET | `/api/settings/terms-and-conditions` | Terms & conditions |

**Admin (`/api/admin/settings/*`) — requires `Authorization: Bearer <token>` + `appRole: admin`. Returns `401` without a valid token.**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/settings/app` | Get app settings. |
| POST | `/api/admin/settings/app` | Create app settings. |
| PUT | `/api/admin/settings/app` | Update app settings. |
| GET | `/api/admin/settings/about` | Get About page content. |
| POST | `/api/admin/settings/about` | Save About page content. |
| PUT | `/api/admin/settings/about` | Update About page content. |
| DELETE | `/api/admin/settings/about` | Delete About page content. |
| GET | `/api/admin/settings/privacy-policy` | Get Privacy Policy content. |
| POST | `/api/admin/settings/privacy-policy` | Save Privacy Policy content. |
| PUT | `/api/admin/settings/privacy-policy` | Update Privacy Policy content. |
| DELETE | `/api/admin/settings/privacy-policy` | Delete Privacy Policy content. |
| GET | `/api/admin/settings/terms-and-conditions` | Get Terms & Conditions content. |
| POST | `/api/admin/settings/terms-and-conditions` | Save Terms & Conditions content. |
| PUT | `/api/admin/settings/terms-and-conditions` | Update Terms & Conditions content. |
| DELETE | `/api/admin/settings/terms-and-conditions` | Delete Terms & Conditions content. |
| GET | `/api/admin/settings/smtp` | Get SMTP config. |
| POST | `/api/admin/settings/smtp` | Save SMTP config. |
| PUT | `/api/admin/settings/smtp` | Update SMTP config. |
| POST | `/api/admin/settings/smtp/test` | Test SMTP connection. Body: SMTP params. |
| POST | `/api/admin/settings/upload` | Upload file (multipart). |

#### SMTP Configuration Details

**SMTP Settings Request Body (POST/PUT):**
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

**SMTP Test Request Body:**
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

**Common SMTP Configurations:**
- **Gmail**: `host: "smtp.gmail.com"`, `port: 465`, `useSsl: true`, `useStartTls: false` ✅ (currently configured)
- **Outlook/Office 365**: `host: "smtp.office365.com"`, `port: 587`, `useSsl: false`, `useStartTls: true`
- **Plain SMTP**: `host: "your-smtp-server.com"`, `port: 25`, `useSsl: false`, `useStartTls: false`

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
  - **🆕** Multi-step apply: `GET .../apply-form` → `POST/PATCH /api/applications` → `POST .../documents` → `POST .../submit`
  - **🆕** Landlord: `/api/landlord/*` or `/api/applications/incoming/*`
  - **🆕** Leases: `GET /api/leases/me`, `GET /api/properties/:id/lease`
  - **🆕** Maintenance: `POST/GET /api/maintenance`
  - **🆕** Chat: `POST /api/properties/:id/chats`, `GET/POST /api/chats/...`
  - **🆕** Support (no auth): `POST /api/support/tickets`
  - **🆕** Favourites: `POST /api/favorites/toggle`, `GET /api/favorites`, `GET /api/favorites/check`
  - **🆕** Profile: `GET/PATCH /api/profile`, `POST /api/profile/avatar`, `POST /api/profile/2fa/*`, `DELETE /api/profile`

### Admin dashboard

- **Base:** `https://api3-jfh4l76lzq-bq.a.run.app/api` (or local `http://localhost:8080/api`)
- **Login:** `POST /api/admin/login` → store **`token`**
- **Header:** `Authorization: Bearer {{token}}` on all admin routes
- **Smoke test:** `npm run test:admin`
- **Endpoints:** dashboard, profile, properties, applications, locations, settings (all under `/api/admin/...`)
- **Public reads (no auth):** `GET /api/settings/app`, `/about`, etc. — for mobile branding only
- **Super admin:** `isSuperAdmin: true` for `POST /api/admin/users/admins`, support agents, user 2FA management

### Landlord site

- **Login:** OTP or Firebase → `appRole: landlord`
- **Base paths:** `/api/landlord/properties`, `/api/landlord/applications`, `/api/landlord/leases`, `/api/landlord/maintenance`
- **Occupied unit:** `GET /api/properties/:id/lease` for lease agreement URL

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

### Prisma: column does not exist (production)

If the mobile app shows `Application.documentsVerificationStatus does not exist`, the **Neon database** was not migrated after deploying new API code. Fix: `npm run prisma:migrate:deploy` with production `DATABASE_URL` (see **FIREBASE_DEPLOY.md** → Database migrations).
