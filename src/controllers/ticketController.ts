/* eslint-disable */

import { Response } from "express";
import * as ticketService from "../services/ticketService";
import type { AuthRequest } from "../middleware/auth.middleware";
import type { CreateTicketRequest, TicketFilters, UpdateTicketRequest } from "../interfaces/ticket";

function paramId(p: string | string[] | undefined): string {
  const v = Array.isArray(p) ? p[0] : p;
  return String(v ?? "");
}

function isTicketAdmin(req: AuthRequest): boolean {
  return req.user?.appRole === "admin";
}

function canAccessTicket(req: AuthRequest, ticket: { customerEmail?: string | null }): boolean {
  if (!req.user) return false;
  if (isTicketAdmin(req)) return true;
  const a = (ticket.customerEmail ?? "").trim().toLowerCase();
  const b = req.user.email.trim().toLowerCase();
  return a !== "" && a === b;
}

function parseCsv(v: unknown): string[] | undefined {
  if (v == null || v === "") return undefined;
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function err(res: Response, status: number, code: string, message: string, details?: string) {
  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}

// Support Email Templates
export const getSupportEmailTemplates = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await ticketService.getSupportEmailTemplates();
    res.status(200).json({ success: true, templates: data });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to load templates", e instanceof Error ? e.message : undefined);
  }
};

export const getSupportEmailTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const row = await ticketService.getSupportEmailTemplate(paramId(req.params.id));
    if (!row) {
      err(res, 404, "NOT_FOUND", "Template not found");
      return;
    }
    res.status(200).json({ success: true, template: row });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to load template", e instanceof Error ? e.message : undefined);
  }
};

export const createSupportEmailTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const created = await ticketService.createSupportEmailTemplate(req.body);
    res.status(201).json({ success: true, template: created });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to create template", e instanceof Error ? e.message : undefined);
  }
};

export const updateSupportEmailTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await ticketService.updateSupportEmailTemplate(paramId(req.params.id), req.body);
    if (!updated) {
      err(res, 404, "NOT_FOUND", "Template not found");
      return;
    }
    res.status(200).json({ success: true, template: updated });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to update template", e instanceof Error ? e.message : undefined);
  }
};

export const deleteSupportEmailTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ok = await ticketService.deleteSupportEmailTemplate(paramId(req.params.id));
    if (!ok) {
      err(res, 404, "NOT_FOUND", "Template not found");
      return;
    }
    res.status(200).json({ success: true, message: "Deleted" });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to delete template", e instanceof Error ? e.message : undefined);
  }
};

export const sendSupportEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await ticketService.sendSupportEmail(req.body);
    res.status(200).json({ success: true, email: result });
  } catch (e) {
    err(res, 400, "SEND_FAILED", e instanceof Error ? e.message : "Failed to send");
  }
};

// Stats
export const getTicketStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await ticketService.getTicketStatistics(req.query.dateRange as string | undefined);
    res.status(200).json({ success: true, stats });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to load stats", e instanceof Error ? e.message : undefined);
  }
};

// Agents
export const getSupportAgents = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const agents = await ticketService.getSupportAgents();
    res.status(200).json({ success: true, agents });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to load agents", e instanceof Error ? e.message : undefined);
  }
};

export const updateAgentWorkload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const maxTickets = Number(req.body?.maxTickets);
    if (Number.isNaN(maxTickets) || maxTickets < 0) {
      err(res, 400, "VALIDATION_ERROR", "maxTickets is required and must be a non-negative number");
      return;
    }
    const updated = await ticketService.updateAgentWorkload(paramId(req.params.id), maxTickets);
    if (!updated) {
      err(res, 404, "NOT_FOUND", "Agent not found");
      return;
    }
    res.status(200).json({ success: true, agent: updated });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to update agent", e instanceof Error ? e.message : undefined);
  }
};

// Config
export const getTicketStatuses = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const statuses = await ticketService.getTicketStatuses();
    res.status(200).json({ success: true, statuses });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to load statuses", e instanceof Error ? e.message : undefined);
  }
};

export const getTicketPriorities = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const priorities = await ticketService.getTicketPriorities();
    res.status(200).json({ success: true, priorities });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to load priorities", e instanceof Error ? e.message : undefined);
  }
};

export const getTicketCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await ticketService.getTicketCategories();
    res.status(200).json({ success: true, categories });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to load categories", e instanceof Error ? e.message : undefined);
  }
};

// Operations
export const escalateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) {
      err(res, 400, "VALIDATION_ERROR", "reason is required");
      return;
    }
    const ticket = await ticketService.escalateTicket(paramId(req.params.id), reason);
    if (!ticket) {
      err(res, 404, "NOT_FOUND", "Ticket not found");
      return;
    }
    res.status(200).json({ success: true, ticket });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to escalate", e instanceof Error ? e.message : undefined);
  }
};

export const closeTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const resolution = String(req.body?.resolution ?? "").trim();
    const closedBy = String(req.body?.closedBy ?? "system").trim();
    if (!resolution) {
      err(res, 400, "VALIDATION_ERROR", "resolution is required");
      return;
    }
    const ticket = await ticketService.closeTicket(paramId(req.params.id), resolution, closedBy);
    if (!ticket) {
      err(res, 404, "NOT_FOUND", "Ticket not found");
      return;
    }
    res.status(200).json({ success: true, ticket });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to close ticket", e instanceof Error ? e.message : undefined);
  }
};

export const reopenTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) {
      err(res, 400, "VALIDATION_ERROR", "reason is required");
      return;
    }
    const ticket = await ticketService.reopenTicket(paramId(req.params.id), reason);
    if (!ticket) {
      err(res, 404, "NOT_FOUND", "Ticket not found");
      return;
    }
    res.status(200).json({ success: true, ticket });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to reopen ticket", e instanceof Error ? e.message : undefined);
  }
};

// Messages
export const getTicketMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      err(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const ticket = await ticketService.getTicket(paramId(req.params.id));
    if (!ticket) {
      err(res, 404, "NOT_FOUND", "Ticket not found");
      return;
    }
    if (!canAccessTicket(req, ticket)) {
      err(res, 403, "INSUFFICIENT_PERMISSIONS", "You cannot access this ticket");
      return;
    }
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const includeInternal = isTicketAdmin(req) && req.query.includeInternal === "true";
    const result = await ticketService.getTicketMessages(paramId(req.params.id), page, limit, includeInternal);
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to load messages", e instanceof Error ? e.message : undefined);
  }
};

export const addMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      err(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const ticketId = paramId(req.params.id);
    const ticket = await ticketService.getTicket(ticketId);
    if (!ticket) {
      err(res, 404, "NOT_FOUND", "Ticket not found");
      return;
    }
    if (!canAccessTicket(req, ticket)) {
      err(res, 403, "INSUFFICIENT_PERMISSIONS", "You cannot access this ticket");
      return;
    }
    const admin = isTicketAdmin(req);
    const isInternal = admin && Boolean(req.body?.isInternal);
    const authorId = admin
      ? (String(req.body?.authorId ?? "").trim() || String(req.user.id))
      : String(req.user.id);
    const defaultAgentName = `${req.user.name} ${req.user.surname}`.trim() || "Agent";
    const authorName = admin
      ? (String(req.body?.authorName ?? "").trim() || defaultAgentName)
      : [req.user.name, req.user.surname].filter(Boolean).join(" ").trim() || req.user.email;
    const message = await ticketService.addMessage(
      ticketId,
      { ...req.body, isInternal },
      authorId,
      authorName,
      admin ? "agent" : "customer"
    );
    res.status(201).json({ success: true, message });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to add message", e instanceof Error ? e.message : undefined);
  }
};

// CRUD
export const getTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      err(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const filters: TicketFilters = {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      status: parseCsv(req.query.status),
      priority: parseCsv(req.query.priority),
      category: parseCsv(req.query.category),
      assignedTo: parseCsv(req.query.assignedTo),
      search: (req.query.search as string) || undefined,
      dateRange: (req.query.dateRange as string) || undefined,
      sortBy: (req.query.sortBy as string) || undefined,
      sortOrder: (req.query.sortOrder as "asc" | "desc") || undefined,
    };
    if (!isTicketAdmin(req)) {
      filters.customerEmail = req.user.email;
    }
    const result = await ticketService.getTickets(filters);
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to list tickets", e instanceof Error ? e.message : undefined);
  }
};

export const getTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      err(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const ticket = await ticketService.getTicket(paramId(req.params.id));
    if (!ticket) {
      err(res, 404, "NOT_FOUND", "Ticket not found");
      return;
    }
    if (!canAccessTicket(req, ticket)) {
      err(res, 403, "INSUFFICIENT_PERMISSIONS", "You cannot access this ticket");
      return;
    }
    res.status(200).json({ success: true, ticket });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to load ticket", e instanceof Error ? e.message : undefined);
  }
};

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      err(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const body = req.body as CreateTicketRequest;
    if (!body?.subject || !body?.description || !body?.category || !body?.priority) {
      err(res, 400, "VALIDATION_ERROR", "subject, description, category, priority are required");
      return;
    }
    const admin = isTicketAdmin(req);
    let customerEmail = (body.customerEmail ?? "").trim() || req.user.email;
    let customerName =
      (body.customerName ?? "").trim() ||
      [req.user.name, req.user.surname].filter(Boolean).join(" ").trim() ||
      req.user.email;
    if (!admin) {
      customerEmail = req.user.email;
      customerName =
        [req.user.name, req.user.surname].filter(Boolean).join(" ").trim() || req.user.email;
    }
    const ticket = await ticketService.createTicket({
      ...body,
      customerEmail,
      customerName,
      customerId: String(req.user.id),
    });
    res.status(201).json({ success: true, ticket });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to create ticket", e instanceof Error ? e.message : undefined);
  }
};

export const updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await ticketService.updateTicket(paramId(req.params.id), req.body as UpdateTicketRequest);
    if (!ticket) {
      err(res, 404, "NOT_FOUND", "Ticket not found");
      return;
    }
    res.status(200).json({ success: true, ticket });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to update ticket", e instanceof Error ? e.message : undefined);
  }
};

export const deleteTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ok = await ticketService.deleteTicket(paramId(req.params.id));
    if (!ok) {
      err(res, 404, "NOT_FOUND", "Ticket not found");
      return;
    }
    res.status(200).json({ success: true, message: "Ticket deleted" });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", "Failed to delete ticket", e instanceof Error ? e.message : undefined);
  }
};
