/* eslint-disable */
import * as admin from "firebase-admin";
import config from "../config";

/**
 * Initialize Firebase Admin SDK once (LeaseSpaces project).
 * For local dev: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.
 */
function getFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: config.firebase.projectId,
    });
  }
  return admin;
}

export const firebaseAdmin = getFirebaseAdmin();
export default firebaseAdmin;
