/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as propertyService from "../services/propertyService";

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

function paramId(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** GET /api/landlord/properties */
export async function listMyProperties(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await propertyService.getPropertiesForLandlord(authReq.user.id, { page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to list properties");
  }
}

/** POST /api/landlord/properties */
export async function createListing(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const body = req.body as {
      title: string;
      description?: string;
      price: number;
      currency?: string;
      propertyType: string;
      rentalType: string;
      rentalPeriod?: string;
      bedrooms: number;
      bathrooms: number;
      area?: number;
      location: object;
      amenities?: string[];
      images?: string[];
      availableDate?: string;
    };
    const property = await propertyService.createProperty({
      ...body,
      landlordId: authReq.user.id,
      images: body.images,
      availableDate: body.availableDate ? new Date(body.availableDate) : undefined,
    });
    res.status(201).json({
      success: true,
      property,
      message: "Listing submitted for approval. It will appear publicly once approved.",
    });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to create listing");
  }
}

/** PUT /api/landlord/properties/:propertyId */
export async function updateListing(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const property = await propertyService.updatePropertyAsLandlord(
      paramId(req, "propertyId"),
      authReq.user.id,
      req.body
    );
    res.status(200).json({ success: true, property });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update property";
    const status = msg.includes("not found") ? 404 : msg.includes("own") ? 403 : 500;
    sendError(res, status, status === 404 ? "NOT_FOUND" : status === 403 ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR", msg);
  }
}

/** DELETE /api/landlord/properties/:propertyId */
export async function deleteListing(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    await propertyService.deletePropertyAsLandlord(paramId(req, "propertyId"), authReq.user.id);
    res.status(200).json({ success: true, message: "Property deleted" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete property";
    const status = msg.includes("not found") ? 404 : msg.includes("own") ? 403 : 500;
    sendError(res, status, status === 404 ? "NOT_FOUND" : status === 403 ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR", msg);
  }
}
