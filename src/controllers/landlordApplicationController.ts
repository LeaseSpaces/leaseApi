/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as applicationService from "../services/applicationService";
import { ApplicationDecisionException } from "../services/applicationService";
import { ApplicationStatus } from "@prisma/client";

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

function paramId(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** GET /api/applications/incoming — landlord: applications for my properties */
export async function listIncomingApplications(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }

    const status = req.query.status as ApplicationStatus | undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const result = await applicationService.listApplicationsForLandlord(authReq.user.id, {
      status,
      page,
      limit,
      propertyId,
      search,
    });

    res.status(200).json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to list applications");
  }
}

/** GET /api/applications/incoming/:applicationId */
export async function getIncomingApplication(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }

    const application = await applicationService.getApplicationForAdmin(paramId(req, "applicationId"));
    if (!application) {
      sendError(res, 404, "NOT_FOUND", "Application not found");
      return;
    }
    if (application.property.landlord.id !== authReq.user.id) {
      sendError(res, 403, "FORBIDDEN", "This application is not for your property");
      return;
    }

    res.status(200).json({ success: true, application });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to fetch application");
  }
}

/** PATCH /api/applications/incoming/:applicationId/decision */
export async function decideIncomingApplication(req: Request, res: Response): Promise<void> {
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

    res.status(200).json({ success: true, application });
  } catch (e) {
    if (e instanceof ApplicationDecisionException) {
      const status = e.message.includes("not found") ? 404 : 403;
      sendError(res, status, status === 404 ? "NOT_FOUND" : "FORBIDDEN", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to decide application");
  }
}
