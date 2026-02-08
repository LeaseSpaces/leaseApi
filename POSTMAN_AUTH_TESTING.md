# Postman Auth Testing Guide

Test **Admin**, **Tenant**, and **Landlord/Customer** auth in Postman.

---

## Base URL

Set a Postman variable (optional):

- **Variable**: `baseUrl`  
- **Value**: `http://localhost:8080`

Use `{{baseUrl}}` in request URLs.

---

## 1. Health check (no auth)

| Method | URL | Auth |
|--------|-----|------|
| GET | `http://localhost:8080/api/auth` | None |

**Expected**: `200` with `success: true` and an `endpoints` object.

---

## 2. Tenant & Landlord (Firebase → Sync → Backend JWT)

Tenants and landlords use the same flow: get a **Firebase ID token**, then call **POST /api/auth/sync** to get a **backend JWT**. The role is determined by the user’s `appRole` in the database (set on first sync or by you in Prisma).

### Step A: Get a Firebase ID token (all from Postman)

You can **create the user and get the token** in Postman — no need to create users in Firebase Console.

1. **Get your Web API Key** (one-time): Firebase Console → Project settings → General → Your apps → **Web API Key**. Copy it.

2. **In the Postman collection**, open **1. Get Firebase ID token**:
   - **A. Sign up (create user)** — Creates a new user. In the request URL, replace `YOUR_FIREBASE_WEB_API_KEY` with your key. Set body `email` and `password` (e.g. `tenant@example.com`, `password123`). **Send**. The response contains **`idToken`** — that’s your Firebase ID token. (If you get `EMAIL_EXISTS`, the user already exists; use **B. Sign in** instead.)
   - **B. Sign in (existing user)** — Same URL (with your key) and body. Use for users you already created. **Send** and copy **`idToken`** from the response.

3. **Save the token**: In the collection (or environment), set variable **`firebaseIdToken`** = the `idToken` value from the response.

4. Use **`{{firebaseIdToken}}`** in **POST /api/auth/sync** as `Authorization: Bearer {{firebaseIdToken}}`.

### Step B: Sync and get backend JWT

**Request:**

- **Method**: POST  
- **URL**: `http://localhost:8080/api/auth/sync`  
- **Headers**:
  - `Authorization: Bearer <paste_idToken_here>`
  - `Content-Type: application/json`

**Expected**: `200` with:

```json
{
  "success": true,
  "user": { "id", "uid", "email", "name", "role": "tenant" or "landlord", ... },
  "token": "<backend_jwt>"
}
```

Copy `token` and use it as the **backend JWT** for all protected tenant/landlord requests.

### Step C: Use backend JWT as Tenant / Landlord

Use the same backend JWT for both tenant and landlord; the API differentiates by `user.role` and permissions.

**Examples:**

| Role     | Method | URL                                      | Header |
|----------|--------|------------------------------------------|--------|
| Tenant   | GET    | `http://localhost:8080/api/applications` | `Authorization: Bearer {{backendToken}}` |
| Tenant   | POST   | `http://localhost:8080/api/applications` | same   |
| Landlord | GET    | `http://localhost:8080/api/properties`   | same   |
| Landlord | POST   | `http://localhost:8080/api/properties`   | same   |

In Postman, set a variable **`backendToken`** to the `token` from the sync response and use `Authorization: Bearer {{backendToken}}`.

---

## 3. Admin (LeaseSpaces – Firebase + appRole admin)

Same as tenant/landlord, but the user must have **`appRole: "admin"`** in your Prisma `User` table.

### Step A: Get Firebase ID token

Same as **Step A** above, but sign in with an **admin user** (e.g. an email you created in Firebase Auth and then set to admin in the DB).

### Step B: Sync and get backend JWT

Same as **Step B**: **POST** `http://localhost:8080/api/auth/sync` with:

- **Header**: `Authorization: Bearer <firebase_idToken>`

You get back `user` (with `role: "admin"`) and `token` (backend JWT). Save the token as **`adminToken`** (or reuse `backendToken` for admin-only tests).

### Step C: Call admin-only routes

| Method | URL                                                | Header |
|--------|----------------------------------------------------|--------|
| GET    | `http://localhost:8080/api/admin/dashboard`        | `Authorization: Bearer {{adminToken}}` |
| GET    | `http://localhost:8080/api/admin/properties/analytics?period=30d` | same   |
| GET    | `http://localhost:8080/api/admin/admin-profile`    | same   |

**Expected**: `200` with JSON. If you get `403`, the user’s `appRole` in the DB is not `admin`.

**Making a user admin in Prisma:**

```sql
UPDATE "User" SET "appRole" = 'admin' WHERE email = 'your-admin@example.com';
```

Or use Prisma Studio / a seed script to set `appRole: "admin"` for that user.

---

## 4. Legacy admin (Firestore admins)

Uses **email + password** against the **Firestore `admins`** collection (no Firebase ID token).

**Request:**

- **Method**: POST  
- **URL**: `http://localhost:8080/api/admin/admin-login`  
- **Headers**: `Content-Type: application/json`  
- **Body (raw JSON)**:

```json
{
  "email": "admin@example.com",
  "password": "admin-password"
}
```

**Expected**: `200` with `token` and `details`. Use this `token` in **Authorization: Bearer \<token\>** for any route that accepts this legacy admin JWT (e.g. routes that use your JWT auth middleware with this token).

Note: LeaseSpaces protected admin routes (**/api/admin/dashboard**, etc.) expect the **Firebase sync** flow and a user with `appRole: "admin"`, not the legacy admin login. Use legacy admin only for routes that are explicitly built for it.

---

## 5. Postman collection summary

Import **`LeaseSpaces_Auth_Collection.postman_collection.json`** (in this repo). It includes:

- **Auth**: Health, Sync, Firebase (body)
- **Tenant**: Applications list/create (use token from sync)
- **Landlord**: Properties list (use token from sync)
- **Admin**: Dashboard, analytics (use token from sync for admin user)
- **Legacy Admin**: Admin login (email/password)

**Suggested flow:**

1. **Environment variables** (optional): `baseUrl` = `http://localhost:8080`, `firebaseIdToken`, `backendToken` (or `adminToken`).
2. Get **Firebase ID token** (Firebase REST or frontend) → set `firebaseIdToken`.
3. **POST** `/api/auth/sync` with `Authorization: Bearer {{firebaseIdToken}}` → copy `token` from response into `backendToken` (or `adminToken` for admin).
4. Call **GET /api/admin/dashboard** (admin), **GET /api/applications** (tenant), or **GET /api/properties** (any) with `Authorization: Bearer {{backendToken}}`.

---

## 6. Quick checklist

| Role            | How to get token                    | Where to use it                          |
|-----------------|-------------------------------------|------------------------------------------|
| Tenant          | Firebase sign-in → POST /auth/sync | GET/POST /api/applications, GET /properties |
| Landlord        | Firebase sign-in → POST /auth/sync | GET/POST /api/properties, GET /applications (own) |
| Admin           | Firebase sign-in (admin user) → POST /auth/sync | GET /api/admin/dashboard, analytics, admin-profile |
| Legacy admin    | POST /api/admin/admin-login (email/password) | Routes that accept legacy admin JWT       |

---

## 7. Firebase Web API Key

To get a Firebase ID token in Postman:

1. Firebase Console → your project (e.g. **easespaces-7d30b**) → Project settings (gear) → **General**.
2. Under **Your apps**, copy the **Web API Key**.
3. Use it in the Firebase Auth REST URL:  
   `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=YOUR_WEB_API_KEY`

Create a test user (email/password) in **Authentication → Users** if needed.
