/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as applicationService from "../services/applicationService";
import { ApplicationStatus } from "@prisma/client";

export async function getApplications(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" },
      });
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
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch applications",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function createApplication(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" },
      });
      return;
    }
    const body = req.body as {
      propertyId: string;
      moveInDate?: string;
      message?: string;
      documents?: object[];
    };
    const application = await applicationService.createApplication({
      propertyId: body.propertyId,
      tenantId: authReq.user.id,
      moveInDate: body.moveInDate ? new Date(body.moveInDate) : undefined,
      message: body.message,
      documents: body.documents,
    });
    res.status(201).json({ success: true, application });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create application",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function updateApplicationStatus(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" },
      });
      return;
    }
    const body = req.body as { status: "approved" | "rejected"; message?: string };
    if (!body.status || !["approved", "rejected"].includes(body.status)) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "status must be 'approved' or 'rejected'" },
      });
      return;
    }
    const applicationId = Array.isArray(req.params.applicationId) ? req.params.applicationId[0] : req.params.applicationId;
    const application = await applicationService.updateApplicationStatus(
      applicationId as string,
      body.status as ApplicationStatus,
      body.message
    );
    res.status(200).json({ success: true, application });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update application status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
