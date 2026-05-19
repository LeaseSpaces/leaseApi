# Deploying LeaseSpaces Backend to Firebase Functions

## Firebase: emulator vs real project

| Mode | Where | Firestore | Credentials |
|------|--------|-----------|-------------|
| **Production** | `firebase deploy --only functions` | Real Firestore in `easespaces-7d30b` | Automatic (Cloud Run / Functions ADC) |
| **Local → real Firebase** | `npm run dev` on your PC | Real Firestore | `GOOGLE_APPLICATION_CREDENTIALS` → service account JSON |
| **Local → emulator** | `npm run dev` + emulator | Local only | `USE_FIRESTORE_EMULATOR=true` (no JSON required for chat) |

### Local dev against **real** Firebase (recommended before deploy)

PowerShell (current session):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\easespaces-service-account.json"
Remove-Item Env:USE_FIRESTORE_EMULATOR -ErrorAction SilentlyContinue
Remove-Item Env:FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue
npm run dev
```

On startup you should see: `[firebase-admin] Real Firebase (project: easespaces-7d30b, credentials: service account file)`.

Also deploy Firestore rules (chat security) once per project:

```bash
firebase deploy --only firestore:rules
```

### Local dev with **Firestore emulator** (chat tests only)

Terminal 1: `npm run emulator:firestore`  
Terminal 2:

```powershell
$env:USE_FIRESTORE_EMULATOR="true"
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8085"
Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue
npm run dev
```

Startup log: `[firebase-admin] Firestore EMULATOR at 127.0.0.1:8085`.

---

## Prerequisites

- Firebase CLI: `npm install -g firebase-tools`
- Logged in: `firebase login`
- Project linked: `firebase use easespaces-7d30b` (or your project ID)

## Environment Variables (Required)

Set these in **Firebase Console** → **Functions** → **api** (or your function) → **Environment variables**:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon Postgres connection string (use the **pooled** URL ending in `-pooler`) |
| `JWT_SECRET` | Your JWT signing secret (32+ chars) |

Also set in Firebase Console (or `.env` locally):

- `PROJECT_ID` = `easespaces-7d30b` (must match Firestore rules project)
- `API_KEY`, `AUTH_DOMAIN`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`

**Do not** set `USE_FIRESTORE_EMULATOR` or `FIRESTORE_EMULATOR_HOST` on Cloud Functions.

Firebase Admin uses **application default credentials** in production — you do **not** upload `GOOGLE_APPLICATION_CREDENTIALS` to Functions.

**Support emails:** configure SMTP in admin (`POST /api/admin/settings/smtp`) or set `EMAIL_USER` / `EMAIL_PASS` env vars on the function.

## Deploy

```bash
cd c:\Users\Programm3r\Desktop\backend
npm install
npm run build
firebase deploy --only functions,firestore:rules
```

### After deploy — smoke tests

```bash
# Public support (no auth)
curl https://api-jfh4l76lzq-bq.a.run.app/api/support/form

# Chat messages (needs deploy + JWT_SECRET match)
npm run test:chat:prod

# SMTP from Neon DB
npm run test:smtp
```

## Post-Deploy URL

After deploy, the CLI prints a **Cloud Run** URL for the `api` function (recommended for frontends):

```
https://<id>-<region>.a.run.app/api
```

You can also use the **cloudfunctions.net** host (same function):

```
https://africa-south1-easespaces-7d30b.cloudfunctions.net/api
```

**Frontend:** Set your env base to **one** origin that already includes `/api` (e.g. `https://...run.app/api`), then call relative paths like `/auth`, `/admin/properties`. Do not concatenate the full host twice.

Example: Admin login

```
POST https://africa-south1-easespaces-7d30b.cloudfunctions.net/api/admin/login
Content-Type: application/json
Body: {"username":"admin@leasespaces.local","password":"ChangeMeInProduction!"}
```

## Local Emulator (Optional)

```bash
# Set env vars for emulator (create .env.local or use export)
firebase emulators:start --only functions
```

The emulator reads from `.env` if present.

## Notes

- **Prisma**: Uses the pooled Neon connection string for serverless. Ensure `DATABASE_URL` uses the `-pooler` host.
- **Admin auth**: Works with username/password (Prisma); no Firebase client SDK needed for the main flow.
- **Cold starts**: First request may be slower; consider increasing memory if needed (currently 512MiB).
