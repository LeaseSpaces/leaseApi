/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as applicationService from "../services/applicationService";
import { ApplicationValidationException } from "../services/applicationService";
import * as chatService from "../services/chatService";
import { ApplicationStatus } from "@prisma/client";
import { ApplicationDecisionException } from "../services/applicationService";
import { buildApplicationDocumentUrl } from "../middleware/applicationDocumentParser";
import type { ApplicationPersonalInfoInput } from "../interfaces/application";
import { parseReferences } from "../services/applicationService";

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  errors?: { field: string; message: string }[]
) {
  res.status(status).json({
    success: false,
    error: { code, message, ...(errors?.length ? { errors } : {}) },
  });
}

function paramId(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** GET /api/properties/:propertyId/apply-form */
export async function getPropertyApplyForm(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const propertyId = paramId(req, "propertyId");
    const form = await applicationService.getPropertyApplyForm(propertyId, authReq.user.id);
    res.status(200).json({ success: true, ...form });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load apply form";
    const status = message.includes("not found") || message.includes("not available") ? 404 : 500;
    sendError(res, status, status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message);
  }
}

export async function getApplications(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const status = req.query.status as ApplicationStatus | undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await applicationService.getApplicationsByUser(authReq.user.id, {
      status,
      page,
      limit,
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to fetch applications"
    );
  }
}

/** GET /api/applications/:applicationId */
export async function getApplication(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const applicationId = paramId(req, "applicationId");
    const application = await applicationService.getApplicationForTenant(
      applicationId,
      authReq.user.id
    );
    if (!application) {
      sendError(res, 404, "NOT_FOUND", "Application not found");
      return;
    }
    res.status(200).json({ success: true, application });
  } catch (error) {
    sendError(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to fetch application"
    );
  }
}

/** POST /api/applications — create draft (step 1) or legacy one-shot if termsAccepted */
export async function createApplication(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const body = req.body as ApplicationPersonalInfoInput & {
      propertyId: string;
      termsAccepted?: boolean;
      documents?: object[];
    };

    if (!body.propertyId) {
      sendError(res, 400, "VALIDATION_ERROR", "propertyId is required");
      return;
    }

    let application;

    if (body.termsAccepted) {
      application = await applicationService.createApplication({
        propertyId: body.propertyId,
        tenantId: authReq.user.id,
        moveInDate: body.moveInDate ? new Date(body.moveInDate) : undefined,
        annualIncome: body.annualIncome != null ? Number(body.annualIncome) : undefined,
        currentEmployment: body.currentEmployment,
        references: parseReferences(body),
        message: body.message,
        documents: body.documents,
        termsAccepted: true,
      });
    } else {
      application = await applicationService.createApplicationDraft({
        propertyId: body.propertyId,
        tenantId: authReq.user.id,
        moveInDate: body.moveInDate,
        annualIncome: body.annualIncome != null ? Number(body.annualIncome) : undefined,
        currentEmployment: body.currentEmployment,
        reference1: body.reference1,
        reference2: body.reference2,
        references: body.references,
        message: body.message,
      });
    }

    const summary = applicationService.shapeApplicationSummary({
      ...application,
      termsAcceptedAt: application.termsAcceptedAt ?? null,
      references: application.references,
      documents: application.documents,
    });

    let conversation = null;
    if (application.status === "pending") {
      try {
        conversation = await chatService.createOrGetConversation({
          userId: authReq.user.id,
          applicationId: application.id,
        });
      } catch (chatError) {
        console.error("Failed to create conversation for application:", chatError);
      }
    }

    res.status(201).json({
      success: true,
      application: summary,
      conversation,
      nextStep: application.status === "draft" ? "documents" : null,
    });
  } catch (e) {
    if (e instanceof ApplicationValidationException) {
      sendError(res, 400, "VALIDATION_ERROR", e.message, e.errors);
      return;
    }
    sendError(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      e instanceof Error ? e.message : "Failed to create application"
    );
  }
}

/** PATCH /api/applications/:applicationId — update personal info (step 1) */
export async function updateApplicationPersonalInfo(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const applicationId = paramId(req, "applicationId");
    const body = req.body as ApplicationPersonalInfoInput;
    const updated = await applicationService.updateApplicationPersonalInfo(
      applicationId,
      authReq.user.id,
      body
    );
    res.status(200).json({
      success: true,
      application: applicationService.shapeApplicationSummary({
        ...updated,
        termsAcceptedAt: updated.termsAcceptedAt ?? null,
        references: updated.references,
        documents: updated.documents,
      }),
      nextStep: "documents",
    });
  } catch (e) {
    if (e instanceof ApplicationValidationException) {
      sendError(res, 400, "VALIDATION_ERROR", e.message, e.errors);
      return;
    }
    sendError(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      e instanceof Error ? e.message : "Failed to update application"
    );
  }
}

/** POST /api/applications/:applicationId/documents — step 2 (multipart) */
export async function uploadApplicationDocuments(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const applicationId = paramId(req, "applicationId");
    const parsed = req.applicationDocumentUploads;
    if (!parsed?.length) {
      sendError(res, 400, "VALIDATION_ERROR", "At least one document file is required");
      return;
    }

    const uploads = parsed.map((file) => ({
      field: file.field,
      fileName: file.fileName,
      url: buildApplicationDocumentUrl(req, file.storedFilename),
      mimeType: file.mimeType,
    }));

    const updated = await applicationService.attachApplicationDocuments(
      applicationId,
      authReq.user.id,
      uploads
    );

    res.status(200).json({
      success: true,
      application: applicationService.shapeApplicationSummary({
        ...updated,
        termsAcceptedAt: updated.termsAcceptedAt ?? null,
        references: updated.references,
        documents: updated.documents,
      }),
      nextStep: "review",
    });
  } catch (e) {
    if (e instanceof ApplicationValidationException) {
      sendError(res, 400, "VALIDATION_ERROR", e.message, e.errors);
      return;
    }
    sendError(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      e instanceof Error ? e.message : "Failed to upload documents"
    );
  }
}

/** POST /api/applications/:applicationId/submit — step 3 */
export async function submitApplication(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const applicationId = paramId(req, "applicationId");
    const termsAccepted = Boolean(req.body?.termsAccepted);
    const application = await applicationService.submitApplication(
      applicationId,
      authReq.user.id,
      termsAccepted
    );

    let conversation = null;
    try {
      conversation = await chatService.createOrGetConversation({
        userId: authReq.user.id,
        applicationId: application.id,
      });
    } catch (chatError) {
      console.error("Failed to create conversation for application:", chatError);
    }

    res.status(200).json({
      success: true,
      application: applicationService.shapeApplicationSummary({
        ...application,
        termsAcceptedAt: application.termsAcceptedAt ?? null,
        references: application.references,
        documents: application.documents,
      }),
      conversation,
      message: "Your application has been submitted. The landlord will review it within 2-3 business days.",
    });
  } catch (e) {
    if (e instanceof ApplicationValidationException) {
      sendError(res, 400, "VALIDATION_ERROR", e.message, e.errors);
      return;
    }
    sendError(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      e instanceof Error ? e.message : "Failed to submit application"
    );
  }
}

/** PUT /api/applications/:applicationId/status — landlord or admin approve/reject */
export async function updateApplicationStatus(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const body = req.body as {
      status?: "approved" | "rejected";
      decision?: "approved" | "rejected";
      reviewNotes?: string;
      message?: string;
    };
    const decision = (body.decision ?? body.status) as "approved" | "rejected" | undefined;
    if (!decision || !["approved", "rejected"].includes(decision)) {
      sendError(res, 400, "VALIDATION_ERROR", "status/decision must be 'approved' or 'rejected'");
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
    sendError(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      e instanceof Error ? e.message : "Failed to update application status"
    );
  }
}
