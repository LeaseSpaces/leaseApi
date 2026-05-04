# Mobile App Auth Guide (Tenant & Landlord Signup with Google)

This guide describes how the mobile app should implement signup and login for tenants and landlords using:
- Firebase social auth (Google, etc.)
- Manual email OTP auth

---

## Overview

- **Tenant** and **Landlord** sign up via Firebase Auth (e.g. Google Sign-In).
- The backend syncs users to Neon (Prisma) and returns a **backend JWT**.
- The app uses the backend JWT for all protected API calls.

---

## 1. Signup / Login Flow

### Step 1: Sign in with Google (client-side)

Use Firebase Auth in your mobile app:

**React Native (expo-auth-session or react-native-google-signin)**:

```ts
// Example: Get Firebase ID token after Google sign-in
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';

const credential = GoogleAuthProvider.credential(idToken, accessToken);
const userCredential = await signInWithCredential(auth, credential);
const idToken = await userCredential.user.getIdToken();
```

### Step 2: Sync with backend and optionally set role

For **new users**, send the desired role (`tenant` or `landlord`).

**Option A: POST /api/auth/sync** (header-based)

```
POST /api/auth/sync
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
Body: { "appRole": "landlord" }   // optional, for new users only. "tenant" | "landlord"
```

**Option B: POST /api/auth/firebase** (body-based)

```
POST /api/auth/firebase
Content-Type: application/json
Body: {
  "idToken": "<firebase_id_token>",
  "registrationType": "GOOGLE",   // optional; inferred if omitted
  "appRole": "landlord"           // optional, for new users only. "tenant" | "landlord"
}
```

### Step 3: Store the backend token and user

Response:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "uid": "firebase_uid",
    "email": "user@example.com",
    "name": "John",
    "surname": "",
    "role": "landlord",
    "twofa_enabled": false,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Store `token` and `user` in secure storage. Use `token` for all subsequent API calls.

---

## 1B. Manual Email OTP Flow (Alternative)

Use this flow if your mobile app asks only for email and OTP.

### Step 1: Request OTP

```
POST /api/auth/otp/request
Content-Type: application/json
Body: { "email": "user@example.com" }
```

### Step 2: Verify OTP and receive backend token

```
POST /api/auth/otp/verify
Content-Type: application/json
Body: { "email": "user@example.com", "otp": "123456" }
```

Response includes:
- `token` (backend JWT)
- `onboardingRequired` flag
- `user`

### Step 3: Complete onboarding if needed

If `onboardingRequired: true`:

```
POST /api/auth/onboarding
Authorization: Bearer <backend_token>
Content-Type: application/json
Body: { "name": "Kgabo", "surname": "Baloyi", "role": "tenant" }
```

Then continue using returned backend token for protected API calls.

---

## 2. Using the Backend Token

For protected routes (properties, applications, etc.), send:

```
Authorization: Bearer <backend_token>
```

Example: Create an application

```
POST /api/applications
Authorization: Bearer <backend_token>
Content-Type: application/json
Body: { "propertyId": 1, "message": "..." }
```

---

## 3. Token Refresh

Tokens expire after 7 days (tenant/landlord). Refresh before expiry:

```
POST /api/auth/refresh
Authorization: Bearer <current_backend_token>
```

Response: `{ "success": true, "token": "<new_token>" }`

---

## 4. Endpoints Summary (Mobile)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/sync | Bearer (Firebase ID token) | Sync user, optional body `{ appRole }` for new users |
| POST | /api/auth/firebase | None | Body `{ idToken, registrationType?, appRole? }` |
| POST | /api/auth/otp/request | None | Body `{ email }` (send OTP) |
| POST | /api/auth/otp/verify | None | Body `{ email, otp }` (issue JWT) |
| POST | /api/auth/onboarding | Bearer (backend JWT) | Body `{ name, surname, role }` |
| POST | /api/auth/refresh | Bearer (backend JWT) | Get new token |
| GET | /api/properties | None | List properties |
| POST | /api/properties | Bearer | Create property (landlord) |
| GET | /api/applications | Bearer | List my applications |
| POST | /api/applications | Bearer | Create application (tenant) |

---

## 5. Role Selection UI (recommended)

On first signup, show a screen: **"Are you looking to rent or to list a property?"**

- **Looking to rent** → `appRole: "tenant"`
- **Listing a property** → `appRole: "landlord"`

Then call sync/firebase with that role in the body.

---

## 6. Registration Types

Supported `registrationType`: `GOOGLE`, `FACEBOOK`, `APPLE`, `EMAIL`.

If omitted, the backend infers from the Firebase token.
