/* eslint-disable */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestoreAdmin, chatCollections } from "../config/firestore-admin";
import { nowTimestamp, toDate } from "../utils/chatTimestamps";

export type ChatAttachment = unknown;

export interface FirestoreConversationRecord {
  propertyId: string;
  applicationId: string | null;
  tenantId: number;
  landlordId: number;
  participantIds: number[];
  lastMessageAt: Timestamp | null;
  lastMessageId: string | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: number | null;
  messageCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreMessageRecord {
  senderId: number;
  body: string;
  attachments: ChatAttachment | null;
  readAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SerializedMessage {
  id: string;
  conversationId: string;
  senderId: number;
  body: string;
  attachments: ChatAttachment | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedConversation {
  id: string;
  propertyId: string;
  applicationId: string | null;
  tenantId: number;
  landlordId: number;
  participantIds: number[];
  lastMessageAt: Date | null;
  lastMessageId: string | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: number | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageHistoryResult {
  messages: SerializedMessage[];
  total: number;
  oldestAt: Date | null;
  newestAt: Date | null;
  hasMore: boolean;
}

function conversationsRef() {
  return firestoreAdmin.collection(chatCollections.conversations);
}

function messagesRef(conversationId: string) {
  return conversationsRef().doc(conversationId).collection(chatCollections.messages);
}

export function buildConversationId(propertyId: string, tenantId: number): string {
  return `${propertyId}_${tenantId}`;
}

function requireDate(value: unknown, fieldName: string): Date {
  const date = toDate(value);
  if (!date) {
    throw new Error(`Missing or invalid timestamp: ${fieldName}`);
  }
  return date;
}

function serializeMessage(conversationId: string, id: string, data: FirestoreMessageRecord): SerializedMessage {
  return {
    id,
    conversationId,
    senderId: data.senderId,
    body: data.body,
    attachments: data.attachments,
    readAt: toDate(data.readAt),
    createdAt: requireDate(data.createdAt, "message.createdAt"),
    updatedAt: requireDate(data.updatedAt, "message.updatedAt"),
  };
}

function serializeConversation(id: string, data: FirestoreConversationRecord): SerializedConversation {
  return {
    id,
    propertyId: data.propertyId,
    applicationId: data.applicationId,
    tenantId: data.tenantId,
    landlordId: data.landlordId,
    participantIds: data.participantIds ?? [data.tenantId, data.landlordId],
    lastMessageAt: toDate(data.lastMessageAt),
    lastMessageId: data.lastMessageId ?? null,
    lastMessagePreview: data.lastMessagePreview ?? null,
    lastMessageSenderId: data.lastMessageSenderId ?? null,
    messageCount: data.messageCount ?? 0,
    createdAt: requireDate(data.createdAt, "conversation.createdAt"),
    updatedAt: requireDate(data.updatedAt, "conversation.updatedAt"),
  };
}

export async function getConversationById(conversationId: string): Promise<SerializedConversation | null> {
  const snap = await conversationsRef().doc(conversationId).get();
  if (!snap.exists) return null;
  return serializeConversation(snap.id, snap.data() as FirestoreConversationRecord);
}

export async function getConversationForPropertyTenant(
  propertyId: string,
  tenantId: number
): Promise<SerializedConversation | null> {
  return getConversationById(buildConversationId(propertyId, tenantId));
}

export async function getLastMessage(conversationId: string): Promise<SerializedMessage | null> {
  const snap = await messagesRef(conversationId).orderBy("createdAt", "desc").limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return serializeMessage(conversationId, doc.id, doc.data() as FirestoreMessageRecord);
}

export async function upsertConversation(data: {
  propertyId: string;
  tenantId: number;
  landlordId: number;
  applicationId?: string | null;
}): Promise<SerializedConversation> {
  const id = buildConversationId(data.propertyId, data.tenantId);
  const ref = conversationsRef().doc(id);
  const existing = await ref.get();
  const now = nowTimestamp();

  const payload: Record<string, unknown> = {
    propertyId: data.propertyId,
    tenantId: data.tenantId,
    landlordId: data.landlordId,
    participantIds: [data.tenantId, data.landlordId],
    applicationId: data.applicationId ?? null,
    updatedAt: now,
  };

  if (!existing.exists) {
    payload.createdAt = now;
    payload.lastMessageAt = now;
    payload.lastMessageId = null;
    payload.lastMessagePreview = null;
    payload.lastMessageSenderId = null;
    payload.messageCount = 0;
  }

  await ref.set(payload, { merge: true });
  const saved = await ref.get();
  return serializeConversation(saved.id, saved.data() as FirestoreConversationRecord);
}

export async function listConversationsForParticipant(
  userId: number,
  options: { limit: number; offset: number }
): Promise<{ conversations: SerializedConversation[]; total: number }> {
  const snapshot = await conversationsRef()
    .where("participantIds", "array-contains", userId)
    .orderBy("lastMessageAt", "desc")
    .get();

  const all = snapshot.docs.map((doc) =>
    serializeConversation(doc.id, doc.data() as FirestoreConversationRecord)
  );

  const total = all.length;
  const conversations = all.slice(options.offset, options.offset + options.limit);
  return { conversations, total };
}

export async function listMessageHistory(
  conversationId: string,
  options: {
    limit: number;
    before?: Date;
    after?: Date;
    skip?: number;
    order?: "asc" | "desc";
  }
): Promise<MessageHistoryResult> {
  const order = options.order ?? "asc";
  const limit = options.limit;

  let query = messagesRef(conversationId).orderBy("createdAt", order === "asc" ? "asc" : "desc");

  if (options.after) {
    query = messagesRef(conversationId)
      .orderBy("createdAt", "asc")
      .where("createdAt", ">", Timestamp.fromDate(options.after))
      .limit(limit);
  } else if (options.before) {
    query = messagesRef(conversationId)
      .orderBy("createdAt", "desc")
      .where("createdAt", "<", Timestamp.fromDate(options.before))
      .limit(limit);
  } else if (options.skip) {
    query = messagesRef(conversationId).orderBy("createdAt", "asc").offset(options.skip).limit(limit);
  } else {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  let messages = snapshot.docs.map((doc) =>
    serializeMessage(conversationId, doc.id, doc.data() as FirestoreMessageRecord)
  );

  if (options.before && order === "asc") {
    messages = messages.reverse();
  }
  if (!options.before && !options.after && order === "desc") {
    messages = messages.reverse();
  }

  const total = await countMessages(conversationId);
  const oldestAt = messages.length > 0 ? messages[0].createdAt : null;
  const newestAt = messages.length > 0 ? messages[messages.length - 1].createdAt : null;

  let hasMore = false;
  if (messages.length > 0 && messages.length === limit) {
    if (options.before) {
      hasMore = (await countMessagesBefore(conversationId, messages[0].createdAt)) > 0;
    } else if (options.after) {
      hasMore = total > (await countMessagesUpTo(conversationId, messages[messages.length - 1].createdAt));
    } else {
      hasMore = total > (options.skip ?? 0) + messages.length;
    }
  }

  return { messages, total, oldestAt, newestAt, hasMore };
}

async function countMessagesUpTo(conversationId: string, through: Date): Promise<number> {
  const snap = await messagesRef(conversationId)
    .where("createdAt", "<=", Timestamp.fromDate(through))
    .get();
  return snap.size;
}

async function countMessagesBefore(conversationId: string, before: Date): Promise<number> {
  const snap = await messagesRef(conversationId)
    .where("createdAt", "<", Timestamp.fromDate(before))
    .get();
  return snap.size;
}

export async function countMessages(conversationId: string): Promise<number> {
  const snap = await messagesRef(conversationId).get();
  return snap.size;
}

export async function createMessage(data: {
  conversationId: string;
  senderId: number;
  body: string;
  attachments?: ChatAttachment;
}): Promise<SerializedMessage> {
  const now = nowTimestamp();
  const messageRef = messagesRef(data.conversationId).doc();

  await firestoreAdmin.runTransaction(async (tx) => {
    const conversationRef = conversationsRef().doc(data.conversationId);
    const conversationSnap = await tx.get(conversationRef);
    const currentCount = conversationSnap.exists
      ? Number((conversationSnap.data() as FirestoreConversationRecord).messageCount ?? 0)
      : 0;

    tx.set(messageRef, {
      senderId: data.senderId,
      body: data.body,
      attachments: data.attachments ?? null,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    });

    tx.set(
      conversationRef,
      {
        lastMessageAt: now,
        lastMessageId: messageRef.id,
        lastMessagePreview: data.body.slice(0, 500),
        lastMessageSenderId: data.senderId,
        messageCount: currentCount + 1,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  const saved = await messageRef.get();
  return serializeMessage(data.conversationId, saved.id, saved.data() as FirestoreMessageRecord);
}

export async function markMessagesRead(conversationId: string, readerId: number): Promise<number> {
  const snapshot = await messagesRef(conversationId).where("readAt", "==", null).get();
  const unreadFromOthers = snapshot.docs.filter((doc) => doc.data().senderId !== readerId);

  if (unreadFromOthers.length === 0) return 0;

  const batch = firestoreAdmin.batch();
  const readAt = nowTimestamp();

  unreadFromOthers.forEach((doc) => {
    batch.update(doc.ref, { readAt, updatedAt: readAt });
  });

  await batch.commit();
  return unreadFromOthers.length;
}

export function getFirestoreRealtimePaths(conversationId: string) {
  return {
    conversationPath: `${chatCollections.conversations}/${conversationId}`,
    messagesPath: `${chatCollections.conversations}/${conversationId}/${chatCollections.messages}`,
  };
}
