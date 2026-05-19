/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as chatService from "../services/chatService";
import { addChatClient } from "../services/chatEvents";

function conversationIdParam(req: Request): string {
  const id = req.params.conversationId;
  return Array.isArray(id) ? id[0] : String(id ?? "");
}

function propertyIdParam(req: Request): string {
  const id = req.params.propertyId;
  return Array.isArray(id) ? id[0] : String(id ?? "");
}

function requireUser(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    res.status(401).json({
      success: false,
      error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" },
    });
    return null;
  }
  return authReq.user;
}

function errorResponse(res: Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message.includes("not found") || message.includes("Not found")
      ? 404
      : message.includes("required") || message.includes("must")
        ? 400
        : message.includes("Only")
          ? 403
          : 500;

  res.status(status).json({
    success: false,
    error: {
      code:
        status === 404
          ? "RESOURCE_NOT_FOUND"
          : status === 403
            ? "INSUFFICIENT_PERMISSIONS"
            : status === 400
              ? "VALIDATION_ERROR"
              : "INTERNAL_SERVER_ERROR",
      message,
    },
  });
}

export async function listConversations(req: Request, res: Response): Promise<void> {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const result = await chatService.listConversationsForUser(user.id, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    errorResponse(res, error, "Failed to fetch conversations");
  }
}

/** Tenant: open or resume chat with the landlord for a property (Message landlord). */
export async function startTenantPropertyChat(req: Request, res: Response): Promise<void> {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const propertyId = propertyIdParam(req);
    const conversation = await chatService.createOrGetConversation({
      userId: user.id,
      propertyId,
    });

    res.status(201).json({ success: true, conversation });
  } catch (error) {
    errorResponse(res, error, "Failed to start conversation with landlord");
  }
}

/** Tenant: fetch existing chat for a property, if any. */
export async function getTenantPropertyChat(req: Request, res: Response): Promise<void> {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const propertyId = propertyIdParam(req);
    const conversation = await chatService.getTenantConversationForProperty(propertyId, user.id);
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "No conversation yet for this property",
          hint: "POST /api/properties/:propertyId/chats to message the landlord",
        },
      });
      return;
    }

    res.status(200).json({ success: true, conversation });
  } catch (error) {
    errorResponse(res, error, "Failed to fetch conversation");
  }
}

export async function createConversation(req: Request, res: Response): Promise<void> {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const body = req.body as { propertyId?: string; applicationId?: string; tenantId?: number };
    const conversation = await chatService.createOrGetConversation({
      userId: user.id,
      propertyId: body.propertyId,
      applicationId: body.applicationId,
      tenantId: body.tenantId != null ? Number(body.tenantId) : undefined,
    });

    res.status(201).json({ success: true, conversation });
  } catch (error) {
    errorResponse(res, error, "Failed to create conversation");
  }
}

export async function getConversation(req: Request, res: Response): Promise<void> {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const conversation = await chatService.getConversationForUser(conversationIdParam(req), user.id);
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: "RESOURCE_NOT_FOUND", message: "Conversation not found" },
      });
      return;
    }

    res.status(200).json({ success: true, conversation });
  } catch (error) {
    errorResponse(res, error, "Failed to fetch conversation");
  }
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const result = await chatService.getChatHistory(conversationIdParam(req), user.id, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      after: req.query.after as string | undefined,
      before: req.query.before as string | undefined,
      order: req.query.order === "desc" ? "desc" : "asc",
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    errorResponse(res, error, "Failed to fetch messages");
  }
}

/** Full timestamped chat history for a conversation. */
export async function getChatHistory(req: Request, res: Response): Promise<void> {
  return listMessages(req, res);
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const body = req.body as { body?: string; attachments?: unknown };
    const message = await chatService.sendMessage({
      conversationId: conversationIdParam(req),
      senderId: user.id,
      body: body.body ?? "",
      attachments: body.attachments,
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    errorResponse(res, error, "Failed to send message");
  }
}

export async function markRead(req: Request, res: Response): Promise<void> {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const result = await chatService.markConversationRead(conversationIdParam(req), user.id);
    res.status(200).json({ success: true, updated: result.count });
  } catch (error) {
    errorResponse(res, error, "Failed to mark conversation as read");
  }
}

export async function streamConversation(req: Request, res: Response): Promise<void> {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const conversation = await chatService.getConversationForUser(conversationIdParam(req), user.id);
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: "RESOURCE_NOT_FOUND", message: "Conversation not found" },
      });
      return;
    }

    addChatClient(user.id, conversationIdParam(req), res);
  } catch (error) {
    errorResponse(res, error, "Failed to stream conversation");
  }
}
