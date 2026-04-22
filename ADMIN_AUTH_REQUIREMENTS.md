# Admin Panel Auth Requirements (LeaseSpaces Backend)

This document describes how the admin panel must integrate with the backend for authentication. **Admin users are created only via the backend (e.g. seed or internal tool)** — there is **no Google signup** for admin. Login is **username and password**, then the backend returns a token (or a 2FA step).

---

## Overview

- **No Google signup for admin**: Admin accounts are created only by you (backend/seed). The admin panel does **not** use Firebase or Google sign-in for admin.
- **Login**: Admin enters **username** (email) and **password**. The panel calls **POST /api/admin/login** with these. The backend returns either a **backend JWT** (if 2FA is off) or **requires2fa + temporaryToken** (if 2FA is on).
- **First-time 2FA**: After login, admin can call **POST /api/admin/2fa/init** (with backend JWT), get a **QR code (base64)** and secret, scan it in an authenticator app, then call **POST /api/admin/2fa/enable** with the secret and OTP. After that, all future logins require 2FA.
- **Token expiry**: Admin tokens expire in **24 hours**. The panel should call **POST /api/auth/refresh** with the current token to get a new one before expiry (token changes timeously).

---

## 1. Admin login flow (username + password)

| Step | Panel action | Backend endpoint | Request | Response |
|------|--------------|------------------|---------|----------|
| 1 | User enters username (email) and password | **POST /api/admin/login** | Body: `{ "username": "admin@example.com", "password": "***" }` | See below |
| 2a | If `requires2fa === true` | — | — | Show OTP input; use `temporaryToken` in step 3 |
| 2b | If `token` is present | — | — | Store `token` and `user`; admin is logged in |
| 3 | User enters OTP (when 2FA required) | **POST /api/auth/2fa/verify-login** | Body: `{ "temporaryToken": "<from login>", "otp": "123456" }` | `{ success, user, token }` — store token and user |

**POST /api/admin/login** response shapes:

- **Admin without 2FA**: `{ success: true, user: {...}, token: "<backend_jwt>" }`
- **Admin with 2FA**: `{ success: true, requires2fa: true, temporaryToken: "<short_lived>", user: {...} }` (no `token` until verify-login)

On invalid credentials the backend returns **401** with `{ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password" } }`.

The panel must treat `requires2fa === true` as “show OTP step and call verify-login with temporaryToken and otp”.

---

## 2. First-time 2FA setup (QR code)

Only for admins who do **not** have 2FA enabled yet. After login (with backend JWT), the panel can offer “Enable 2FA”.

| Step | Panel action | Backend endpoint | Request | Response |
|------|--------------|------------------|---------|----------|
| 1 | User clicks “Enable 2FA” | **POST /api/admin/2fa/init** | `Authorization: Bearer <backend_jwt>` | `{ success: true, secret, qrCodeBase64 }` |
| 2 | Show QR image: `data:image/png;base64,<qrCodeBase64>`; user scans with authenticator app | — | — | — |
| 3 | User enters 6-digit OTP from app | **POST /api/admin/2fa/enable** | `Authorization: Bearer <backend_jwt>`<br>Body: `{ "secret": "<from init>", "otp": "123456" }` | `{ success: true, message: "2FA enabled successfully" }` |

- **Init** and **enable** use the **backend JWT** from **POST /api/admin/login** (or from **POST /api/auth/2fa/verify-login** after the 2FA step).
- If 2FA is already enabled, **POST /api/admin/2fa/init** returns `2FA_ALREADY_ENABLED`.

---

## 3. Token lifecycle (timeous refresh)

- **Admin token expiry**: **24 hours**.
- **Temporary token** (for 2FA step only): **2 minutes**.
- To keep the session alive and “change token timeously”, the panel should:
  - Call **POST /api/auth/refresh** with the current backend JWT before it expires (e.g. when remaining time &lt; 1 hour, or on a timer).
  - Request: `Authorization: Bearer <current_backend_jwt>`.
  - Response: `{ success: true, token: "<new_backend_jwt>" }`.
  - Replace the stored token with the new one.

All protected admin API calls must use the latest backend JWT: `Authorization: Bearer <backend_jwt>`.

---

## 4. Endpoints summary

| Method | Path | Auth | Purpose |
|--------|------|------|--------|
| POST | /api/admin/login | — (body: username, password) | Admin login; returns token or requires2fa + temporaryToken |
| POST | /api/auth/2fa/verify-login | — (body: temporaryToken + otp) | Complete admin 2FA login; returns backend JWT |
| POST | /api/auth/refresh | Backend JWT (Bearer) | Get new backend JWT (same expiry from now) |
| POST | /api/admin/2fa/init | Backend JWT (Bearer) | Get QR code + secret for first-time 2FA |
| POST | /api/admin/2fa/enable | Backend JWT (Bearer) | Confirm 2FA with secret + OTP, enable 2FA |

Other admin routes (e.g. dashboard, settings) may use **backend JWT** (via `backendAuth`) so the panel can use a single token after login.

---

## 5. Creating admin users (backend only)

Admin users are **not** created via the admin panel or Google. They are created only by you, for example:

- **Database seed**: Insert a `User` with `appRole: "admin"`, `email` (used as username), and `password` set using the same hashing used by the backend (see `src/utils/password.ts`: `hashPassword(plainPassword)`). Also set `name`, `surname`, `roleId`, `registrationType`, and `socialUserId` (e.g. `"local-admin"` or `"admin-<id>"`) to satisfy the schema.
- **Internal script or one-off endpoint**: Same as above — hash the password with `hashPassword()` and create the User with `appRole: "admin"`.

The admin panel only **logs in** with username (email) and password; it does not create admin accounts.

---

## 6. Requirements checklist for admin panel

- [ ] **Do not** use Google or Firebase sign-in for admin. Use only username (email) + password.
- [ ] Call **POST /api/admin/login** with body `{ "username": "<email>", "password": "***" }`.
- [ ] If response has `requires2fa: true`, show OTP input and call **POST /api/auth/2fa/verify-login** with `temporaryToken` and `otp`; then store returned `token` and `user`.
- [ ] If response has `token`, store `token` and `user` and consider admin logged in.
- [ ] For first-time 2FA: call **POST /api/admin/2fa/init** with backend JWT; display QR from `qrCodeBase64`; call **POST /api/admin/2fa/enable** with `secret` and user-entered `otp`.
- [ ] Use backend JWT for **POST /api/auth/refresh** and replace stored token with the new one (e.g. before expiry).
- [ ] Use the current backend JWT for all protected admin API requests (`Authorization: Bearer <backend_jwt>`).

---

## 7. Error handling

- **401**: Invalid credentials or wrong OTP — re-prompt login or OTP.
- **403**: Not admin — show “Access denied”.
- **400**: Missing fields, 2FA already enabled, or invalid body — show message from `error.message` or `error.code`.

Response shape for errors: `{ success: false, error: { code, message, details? } }`.
