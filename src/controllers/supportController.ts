/* eslint-disable */
import { Request, Response } from "express";
import * as supportTicketService from "../services/supportTicketService";
import { SupportTicketValidationException } from "../services/supportTicketService";

function err(res: Response, status: number, code: string, message: string, errors?: { field: string; message: string }[]) {
  res.status(status).json({ success: false, error: { code, message, ...(errors?.length ? { errors } : {}) } });
}

export async function getSupportForm(_req: Request, res: Response): Promise<void> {
  try {
    const form = await supportTicketService.getSupportFormOptions();
    res.status(200).json({ success: true, ...form });
  } catch (e) {
    err(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to load form");
  }
}

export async function getSupportCategories(_req: Request, res: Response): Promise<void> {
  return getSupportForm(_req, res);
}

export async function submitSupportTicket(req: Request, res: Response): Promise<void> {
  try {
    const result = await supportTicketService.createPublicSupportTicket(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (e) {
    if (e instanceof SupportTicketValidationException) {
      err(res, 400, "VALIDATION_ERROR", e.message, e.errors);
      return;
    }
    err(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to submit ticket");
  }
}
