/* eslint-disable */
import * as admin from "firebase-admin";
import config from "../config";

/** Only the string "true" enables the Firestore emulator. Anything else = real Firebase. */
const useFirestoreEmulator = process.env.USE_FIRESTORE_EMULATOR === "true";

if (useFirestoreEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085";
} else {
  // Prevent stale shell/.env vars from silently routing chat writes to localhost.
  delete process.env.FIRESTORE_EMULATOR_HOST;
}

/**
 * Initialize Firebase Admin SDK once (LeaseSpaces project).
 *
 * - **Production (Firebase Functions):** applicationDefault() — no JSON path needed.
 * - **Local + real Firestore:** set GOOGLE_APPLICATION_CREDENTIALS; do not set USE_FIRESTORE_EMULATOR.
 * - **Local + emulator:** USE_FIRESTORE_EMULATOR=true and npm run emulator:firestore.
 */
function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const projectId = config.firebase.projectId || process.env.GCLOUD_PROJECT || "easespaces-7d30b";

    if (useFirestoreEmulator) {
      admin.initializeApp({ projectId });
      if (process.env.NODE_ENV !== "production") {
        console.info(
          `[firebase-admin] Firestore EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST} (project: ${projectId})`
        );
      }
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
      if (process.env.NODE_ENV !== "production" && process.env.FUNCTIONS_EMULATOR !== "true") {
        const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS ? "service account file" : "ADC";
        console.info(`[firebase-admin] Real Firebase (project: ${projectId}, credentials: ${creds})`);
      }
    }
  }
  return admin;
}

export const firebaseAdmin = getFirebaseAdmin();
export default firebaseAdmin;
