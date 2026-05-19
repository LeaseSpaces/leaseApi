/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as applicationService from "../services/applicationService";
import { ApplicationDecisionException } from "../services/applicationService";
import { ApplicationStatus, DocumentsVerificationStatus } from "@prisma/client";

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

function paramId(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** GET /api/admin/applications */
export async function listApplications(req: Request, res: Response): Promise<void> {
  try {
    const status = req.query.status as ApplicationStatus | undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId : undefined;
    const landlordId = req.query.landlordId ? Number(req.query.landlordId) : undefined;
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const sortBy = req.query.sortBy as "createdAt" | "updatedAt" | "status" | undefined;
    const sortOrder = req.query.sortOrder as "asc" | "desc" | undefined;
    const includeDrafts = req.query.includeDrafts === "true";

    const result = await applicationService.listApplicationsForAdmin({
      status,
      page,
      limit,
      propertyId,
      landlordId,
      tenantId,
      search,
      sortBy,
      sortOrder,
      includeDrafts,
    });

    res.status(200).json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to list applications");
  }
}

/** GET /api/admin/applications/:applicationId */
export async function getApplication(req: Request, res: Response): Promise<void> {
  try {
    const application = await applicationService.getApplicationForAdmin(paramId(req, "applicationId"));
    if (!application) {
      sendError(res, 404, "NOT_FOUND", "Application not found");
      return;
    }
    res.status(200).json({ success: true, application });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to fetch application");
  }
}

/** PATCH /api/admin/applications/:applicationId/decision */
export async function decideApplication(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }

    const body = req.body as { decision?: string; status?: string; reviewNotes?: string; message?: string };
    const decision = (body.decision ?? body.status) as "approved" | "rejected" | undefined;

    if (!decision || !["approved", "rejected"].includes(decision)) {
      sendError(res, 400, "VALIDATION_ERROR", "decision must be 'approved' or 'rejected'");
      return;
    }

    const application = await applicationService.reviewApplicationDecision(
      paramId(req, "applicationId"),
      { id: authReq.user.id, appRole: authReq.user.appRole },
      decision,
      body.reviewNotes ?? body.message
    );

    res.status(200).json({
      success: true,
      application,
      message:
        decision === "approved"
          ? "Application approved. The tenant will be notified."
          : "Application rejected. The tenant will be notified.",
    });
  } catch (e) {
    if (e instanceof ApplicationDecisionException) {
      const status = e.message.includes("not found") ? 404 : 403;
      sendError(res, status, status === 404 ? "NOT_FOUND" : "FORBIDDEN", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to update application");
  }
}

/** PATCH /api/admin/applications/:applicationId/documents-verification — vendor/admin workflow */
export async function updateDocumentsVerification(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as {
      status?: DocumentsVerificationStatus;
      notes?: string;
      documentUpdates?: Array<{ type: string; verificationStatus: string }>;
    };
    if (!body.status) {
      sendError(res, 400, "VALIDATION_ERROR", "status is required");
      return;
    }
    const application = await applicationService.updateDocumentsVerification(
      paramId(req, "applicationId"),
      {
        status: body.status,
        notes: body.notes,
        documentUpdates: body.documentUpdates as
          | Array<{ type: import("../interfaces/application").ApplicationDocument["type"]; verificationStatus: string }>
          | undefined,
      }
    );
    res.status(200).json({ success: true, application });
  } catch (e) {
    if (e instanceof ApplicationDecisionException) {
      sendError(res, 404, "NOT_FOUND", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to update verification");
  }
}
