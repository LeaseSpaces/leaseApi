/* eslint-disable */
import { firebaseAdmin } from "./firebase-admin";

/** Server-side Firestore (realtime-friendly storage for chats). */
export const firestoreAdmin = firebaseAdmin.firestore();

export const chatCollections = {
  conversations: "conversations",
  messages: "messages",
} as const;
