/* eslint-disable */
import { prisma } from "../config/prisma";
import { publishChatEvent } from "./chatEvents";
import * as chatFirestore from "./chatFirestoreService";
import { toIso } from "../utils/chatTimestamps";

export interface ListConversationFilters {
  page?: number;
  limit?: number;
}

export interface ListMessagesFilters {
  page?: number;
  limit?: number;
  after?: string;
  before?: string;
  order?: "asc" | "desc";
}

function withMessageTimestamps<T extends {
  createdAt: Date;
  updatedAt: Date;
  readAt: Date | null;
}>(message: T) {
  return {
    ...message,
    sentAt: toIso(message.createdAt),
    createdAt: toIso(message.createdAt),
    updatedAt: toIso(message.updatedAt),
    readAt: toIso(message.readAt),
  };
}

function withConversationTimestamps<T extends {
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
}>(conversation: T) {
  return {
    ...conversation,
    createdAt: toIso(conversation.createdAt),
    updatedAt: toIso(conversation.updatedAt),
    lastMessageAt: toIso(conversation.lastMessageAt),
  };
}

async function hydrateUsers(userIds: number[]) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    return new Map<number, { id: number; name: string; surname: string; email: string; appRole: string | null }>();
  }

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, surname: true, email: true, appRole: true },
  });

  return new Map(users.map((u) => [u.id, u]));
}

async function hydrateConversation(conversation: chatFirestore.SerializedConversation) {
  const [property, application, users, lastMessage] = await Promise.all([
    prisma.property.findUnique({ where: { id: conversation.propertyId } }),
    conversation.applicationId
      ? prisma.application.findUnique({ where: { id: conversation.applicationId } })
      : Promise.resolve(null),
    hydrateUsers([conversation.tenantId, conversation.landlordId]),
    chatFirestore.getLastMessage(conversation.id),
  ]);

  const tenant = users.get(conversation.tenantId) ?? null;
  const landlord = users.get(conversation.landlordId) ?? null;

  let messages: ReturnType<typeof withMessageTimestamps>[] = [];
  if (lastMessage) {
    const sender = users.get(lastMessage.senderId);
    messages = [
      withMessageTimestamps({
        ...lastMessage,
        sender: sender
          ? { id: sender.id, name: sender.name, surname: sender.surname, email: sender.email }
          : null,
      }),
    ];
  }

  return {
    ...withConversationTimestamps(conversation),
    property,
    application,
    tenant,
    landlord,
    messages,
    firestore: chatFirestore.getFirestoreRealtimePaths(conversation.id),
  };
}

async function hydrateMessages(
  conversationId: string,
  messages: chatFirestore.SerializedMessage[]
) {
  const senderIds = messages.map((m) => m.senderId);
  const users = await hydrateUsers(senderIds);

  return messages.map((message) =>
    withMessageTimestamps({
      ...message,
      sender: users.get(message.senderId) ?? null,
    })
  );
}

function assertParticipant(conversation: chatFirestore.SerializedConversation, userId: number) {
  if (!conversation.participantIds.includes(userId)) {
    throw new Error("Only the tenant or landlord can access this conversation");
  }
}

function parseTimestampQuery(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp; use ISO 8601 format");
  }
  return date;
}

export async function getTenantConversationForProperty(propertyId: string, tenantId: number) {
  const conversation = await chatFirestore.getConversationForPropertyTenant(propertyId, tenantId);
  if (!conversation) return null;
  return hydrateConversation(conversation);
}

export async function getConversationForUser(conversationId: string, userId: number) {
  const conversation = await chatFirestore.getConversationById(conversationId);
  if (!conversation) return null;
  assertParticipant(conversation, userId);
  return hydrateConversation(conversation);
}

export async function listConversationsForUser(userId: number, filters: ListConversationFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const { conversations, total } = await chatFirestore.listConversationsForParticipant(userId, {
    limit,
    offset,
  });

  const hydrated = await Promise.all(conversations.map((c) => hydrateConversation(c)));

  return {
    conversations: hydrated,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createOrGetConversation(data: {
  userId: number;
  propertyId?: string;
  applicationId?: string;
  tenantId?: number;
}) {
  if (!data.propertyId && !data.applicationId) {
    throw new Error("propertyId or applicationId is required");
  }

  const application = data.applicationId
    ? await prisma.application.findUnique({
        where: { id: data.applicationId },
        include: { property: true },
      })
    : null;

  if (data.applicationId && !application) {
    throw new Error("Application not found");
  }

  const propertyId = application?.propertyId ?? data.propertyId;
  if (!propertyId) {
    throw new Error("propertyId is required");
  }

  const property = application?.property ?? (await prisma.property.findUnique({ where: { id: propertyId } }));
  if (!property) {
    throw new Error("Property not found");
  }

  const landlordId = property.landlordId;

  if (!application && data.userId === landlordId && !data.tenantId) {
    throw new Error("Landlords cannot start a tenant chat without tenantId; use POST /api/chats with tenantId");
  }

  let tenantId: number;

  if (application) {
    tenantId = application.tenantId;
  } else if (data.userId === landlordId) {
    if (!data.tenantId) {
      throw new Error("tenantId is required when opening a conversation as the landlord");
    }
    tenantId = data.tenantId;
  } else {
    tenantId = data.userId;
  }

  const isParticipant = data.userId === tenantId || data.userId === landlordId;
  if (!isParticipant) {
    throw new Error("Only the tenant or landlord can open this conversation");
  }

  if (tenantId === landlordId) {
    throw new Error("Tenant and landlord must be different users");
  }

  const tenantUser = await prisma.user.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenantUser) {
    throw new Error("Tenant not found");
  }

  const conversation = await chatFirestore.upsertConversation({
    propertyId,
    tenantId,
    landlordId,
    applicationId: application?.id ?? null,
  });

  return hydrateConversation(conversation);
}

export async function getChatHistory(
  conversationId: string,
  userId: number,
  filters: ListMessagesFilters = {}
) {
  const conversation = await chatFirestore.getConversationById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }
  assertParticipant(conversation, userId);

  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const after = parseTimestampQuery(filters.after);
  const before = parseTimestampQuery(filters.before);
  const order = filters.order === "desc" ? "desc" : "asc";

  if (after || before) {
    const result = await chatFirestore.listMessageHistory(conversationId, {
      limit,
      after,
      before,
      order,
    });
    const history = await hydrateMessages(conversationId, result.messages);

    return {
      history,
      messages: history,
      meta: {
        total: result.total,
        count: history.length,
        oldestAt: toIso(result.oldestAt),
        newestAt: toIso(result.newestAt),
        hasMore: result.hasMore,
        order,
      },
      conversation: withConversationTimestamps(conversation),
      firestore: chatFirestore.getFirestoreRealtimePaths(conversationId),
    };
  }

  const page = Math.max(1, filters.page ?? 1);
  const skip = (page - 1) * limit;

  const result = await chatFirestore.listMessageHistory(conversationId, {
    limit,
    skip,
    order,
  });
  const history = await hydrateMessages(conversationId, result.messages);

  return {
    history,
    messages: history,
    meta: {
      total: result.total,
      count: history.length,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      oldestAt: toIso(result.oldestAt),
      newestAt: toIso(result.newestAt),
      hasMore: result.hasMore || page * limit < result.total,
      order,
    },
    conversation: withConversationTimestamps(conversation),
    firestore: chatFirestore.getFirestoreRealtimePaths(conversationId),
  };
}

export async function listMessages(conversationId: string, userId: number, filters: ListMessagesFilters = {}) {
  return getChatHistory(conversationId, userId, filters);
}

export async function sendMessage(data: {
  conversationId: string;
  senderId: number;
  body: string;
  attachments?: unknown;
}) {
  const body = data.body?.trim();
  if (!body && !data.attachments) {
    throw new Error("Message body or attachments are required");
  }

  const conversation = await chatFirestore.getConversationById(data.conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }
  assertParticipant(conversation, data.senderId);

  const message = await chatFirestore.createMessage({
    conversationId: data.conversationId,
    senderId: data.senderId,
    body: body ?? "",
    attachments: data.attachments,
  });

  const [hydrated] = await hydrateMessages(data.conversationId, [message]);
  publishChatEvent(data.conversationId, "message", hydrated);
  return hydrated;
}

export async function markConversationRead(conversationId: string, userId: number) {
  const conversation = await chatFirestore.getConversationById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }
  assertParticipant(conversation, userId);

  const count = await chatFirestore.markMessagesRead(conversationId, userId);
  publishChatEvent(conversationId, "read", {
    conversationId,
    userId,
    count,
    readAt: new Date().toISOString(),
  });
  return { count, readAt: new Date().toISOString() };
}

export function getConversationRealtimePaths(conversationId: string) {
  return chatFirestore.getFirestoreRealtimePaths(conversationId);
}
