# Auth Endpoints & 2FA Initialization

Base URL (local): `http://localhost:8080/api`  
Base URL (Firebase): `https://africa-south1-easespaces-7d30b.cloudfunctions.net/api` (or your Cloud Run URL)

---

## Auth endpoints (all)

| Method | Path | Auth | Body / Headers | Purpose |
|--------|------|------|----------------|--------|
| GET | `/auth` | — | — | Health check; list of auth endpoints |
| POST | `/admin/login` | — | `{ "username", "password" }` | Admin login (returns token or requires2fa + temporaryToken) |
| POST | `/auth/sync` | Bearer Firebase ID token | Optional body: `{ "appRole": "tenant" \| "landlord" }` | App/mobile: sync user, get backend JWT |
| POST | `/auth/firebase` | — | `{ "idToken", "registrationType?", "appRole?" }` | App/mobile: same as sync (body-based) |
| POST | `/auth/2fa/verify-login` | — | `{ "temporaryToken", "otp" }` | Complete admin 2FA login → returns full token |
| POST | `/auth/refresh` | Bearer backend JWT | — | Get new token (same expiry from now) |
| POST | `/admin/2fa/init` | Bearer backend JWT | — | **Initialize 2FA** → returns secret + QR (base64) |
| POST | `/admin/2fa/enable` | Bearer backend JWT | `{ "secret", "otp" }` | **Enable 2FA** after user scans QR and enters OTP |

---

## Initialize 2FA (first-time setup)

Use these **after** admin has logged in and has a **backend JWT**.

### Step 1: Get QR code and secret

```http
POST /api/admin/2fa/init
Authorization: Bearer <backend_jwt>
Content-Type: application/json
```

**Response (200):**
```json
{
  "success": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeBase64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

- If 2FA is already enabled: **400** with `error.code: "2FA_ALREADY_ENABLED"`.
- If not admin or invalid token: **401** / **403**.

### Step 2: Show QR to user

- Image source: `data:image/png;base64,<qrCodeBase64>` (use the value from the response).
- User scans with Google Authenticator (or similar) and gets 6-digit codes.

### Step 3: Enable 2FA with one OTP

```http
POST /api/admin/2fa/enable
Authorization: Bearer <backend_jwt>
Content-Type: application/json

{
  "secret": "JBSWY3DPEHPK3PXP",
  "otp": "123456"
}
```

- Use the **same** `secret` from step 1.
- `otp` = current 6-digit code from the authenticator app.

**Response (200):**
```json
{
  "success": true,
  "message": "2FA enabled successfully"
}
```

- Invalid OTP: **401** with `error.code: "INVALID_OTP"`.

After this, all future admin logins will return `requires2fa: true` and `temporaryToken`; the client must call **POST /api/auth/2fa/verify-login** with that token and the user’s OTP to get the full backend JWT.

---

## Quick reference: admin auth flow

1. **Login:** `POST /api/admin/login` with `{ "username", "password" }` → get `token` or `requires2fa` + `temporaryToken`.
2. **If requires2fa:** `POST /api/auth/2fa/verify-login` with `{ "temporaryToken", "otp" }` → get `token`.
3. **First-time 2FA:** `POST /api/admin/2fa/init` (with token) → show QR; then `POST /api/admin/2fa/enable` with `{ "secret", "otp" }`.
4. **Refresh:** `POST /api/auth/refresh` with `Authorization: Bearer <token>` → get new `token`.
