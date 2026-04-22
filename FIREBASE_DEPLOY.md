# Deploying LeaseSpaces Backend to Firebase Functions

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

Optional (for Firebase Admin / app config):

- `API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`

Firebase Admin SDK auto-initializes with default credentials when running on Firebase.

## Deploy

```bash
cd c:\Users\Programm3r\Desktop\backend
npm install
firebase deploy --only functions
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
