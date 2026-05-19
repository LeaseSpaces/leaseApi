/* eslint-disable */
import { Response } from "express";

type ChatClient = {
  userId: number;
  conversationId: string;
  res: Response;
};

const clients = new Map<string, ChatClient>();

function writeEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function addChatClient(userId: number, conversationId: string, res: Response): string {
  const clientId = `${conversationId}:${userId}:${Date.now()}:${Math.random()}`;
  clients.set(clientId, { userId, conversationId, res });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  writeEvent(res, "connected", {
    conversationId,
    firestore: {
      conversationPath: `conversations/${conversationId}`,
      messagesPath: `conversations/${conversationId}/messages`,
    },
  });

  const heartbeat = setInterval(() => {
    if (!res.destroyed) {
      writeEvent(res, "heartbeat", { at: new Date().toISOString() });
    }
  }, 25000);

  res.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });

  return clientId;
}

export function publishChatEvent(conversationId: string, event: string, data: unknown) {
  for (const client of clients.values()) {
    if (client.conversationId === conversationId && !client.res.destroyed) {
      writeEvent(client.res, event, data);
    }
  }
}
