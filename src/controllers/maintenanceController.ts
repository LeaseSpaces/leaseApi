/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as maintenanceService from "../services/maintenanceService";
import { MaintenanceValidationException } from "../services/maintenanceService";
import type { MaintenancePriority, MaintenanceStatus } from "@prisma/client";

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

function paramId(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** POST /api/maintenance — tenant reports issue */
export async function createMaintenance(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const body = req.body as {
      propertyId: string;
      title: string;
      description: string;
      priority?: MaintenancePriority;
      images?: string[];
    };
    const request = await maintenanceService.createMaintenanceRequest(authReq.user.id, body);
    res.status(201).json({ success: true, maintenance: request });
  } catch (e) {
    if (e instanceof MaintenanceValidationException) {
      sendError(res, 400, "VALIDATION_ERROR", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to create request");
  }
}

/** GET /api/maintenance — tenant: my requests */
export async function listMyMaintenance(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const status = req.query.status as MaintenanceStatus | undefined;
    const requests = await maintenanceService.listMaintenanceForTenant(authReq.user.id, { status });
    res.status(200).json({ success: true, maintenance: requests });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to list requests");
  }
}

/** GET /api/maintenance/:requestId */
export async function getMaintenance(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const row = await maintenanceService.getMaintenanceById(paramId(req, "requestId"));
    if (!row) {
      sendError(res, 404, "NOT_FOUND", "Maintenance request not found");
      return;
    }
    if (row.tenant?.id !== authReq.user.id) {
      sendError(res, 403, "FORBIDDEN", "Access denied");
      return;
    }
    res.status(200).json({ success: true, maintenance: row });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to fetch request");
  }
}

/** GET /api/landlord/maintenance */
export async function listLandlordMaintenance(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const status = req.query.status as MaintenanceStatus | undefined;
    const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId : undefined;
    const requests = await maintenanceService.listMaintenanceForLandlord(authReq.user.id, {
      status,
      propertyId,
    });
    res.status(200).json({ success: true, maintenance: requests });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to list requests");
  }
}

/** PATCH /api/landlord/maintenance/:requestId */
export async function updateLandlordMaintenance(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const status = (req.body as { status?: MaintenanceStatus }).status;
    if (!status || !["open", "in_progress", "resolved", "closed"].includes(status)) {
      sendError(res, 400, "VALIDATION_ERROR", "status must be open, in_progress, resolved, or closed");
      return;
    }
    const request = await maintenanceService.updateMaintenanceStatus(
      paramId(req, "requestId"),
      authReq.user.id,
      status
    );
    res.status(200).json({ success: true, maintenance: request });
  } catch (e) {
    if (e instanceof MaintenanceValidationException) {
      sendError(res, 404, "NOT_FOUND", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to update request");
  }
}
