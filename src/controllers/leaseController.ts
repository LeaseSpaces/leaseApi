/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as leaseService from "../services/leaseService";
import type { LeaseStatus } from "@prisma/client";

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

function paramId(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** GET /api/leases/me — tenant or landlord: my leases */
export async function listMyLeases(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const status = req.query.status as LeaseStatus | undefined;
    const role = authReq.user.appRole ?? "tenant";
    const leases =
      role === "landlord"
        ? await leaseService.listLeasesForLandlord(authReq.user.id, status)
        : await leaseService.listLeasesForTenant(authReq.user.id, status);
    res.status(200).json({ success: true, leases });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to list leases");
  }
}

/** GET /api/leases/:leaseId */
export async function getLease(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const lease = await leaseService.getLeaseForUser(
      paramId(req, "leaseId"),
      authReq.user.id,
      authReq.user.appRole ?? "tenant"
    );
    if (!lease) {
      sendError(res, 404, "NOT_FOUND", "Lease not found");
      return;
    }
    res.status(200).json({ success: true, lease });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to fetch lease");
  }
}

/** GET /api/properties/:propertyId/lease — active lease for tenant/landlord when occupied */
export async function getPropertyLease(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const role = authReq.user.appRole ?? "tenant";
    if (role !== "tenant" && role !== "landlord" && role !== "admin") {
      sendError(res, 403, "FORBIDDEN", "Access denied");
      return;
    }
    const lease = await leaseService.getActiveLeaseForProperty(
      paramId(req, "propertyId"),
      authReq.user.id,
      role
    );
    if (!lease) {
      res.status(200).json({
        success: true,
        lease: null,
        message: "No active lease for this property",
      });
      return;
    }
    res.status(200).json({ success: true, lease });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to fetch lease");
  }
}
