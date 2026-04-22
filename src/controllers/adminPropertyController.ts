/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  PropertyAvailabilityStatus,
  PropertyModerationStatus,
} from "@prisma/client";
import * as propertyService from "../services/propertyService";

function toIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toTypeLabel(rentalType: string): string {
  const v = String(rentalType || "").trim().toLowerCase();
  if (!v) return "";
  // "short-term" -> "Short-term"
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function formatZar(price: number): string {
  const n = Number(price) || 0;
  const parts = Math.round(n).toString().split("");
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const idxFromEnd = parts.length - i;
    out += parts[i];
    if (idxFromEnd > 1 && idxFromEnd % 3 === 1) out += ",";
  }
  return `R${out}`;
}

function toUiRow(p: any) {
  const loc = (p.location ?? {}) as { city?: string };
  const owner = p.landlord ? `${p.landlord.name ?? ""} ${p.landlord.surname ?? ""}`.trim() : "";
  return {
    id: p.id,
    name: p.title,
    location: loc?.city ?? "Unknown",
    type: toTypeLabel(p.rentalType),
    price: p.price,
    priceDisplay: formatZar(p.price),
    status: p.moderationStatus,
    availabilityStatus: p.availabilityStatus,
    owner,
    ownerId: p.landlord?.id ?? null,
    images: p.images ?? [],
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    description: p.description ?? "",
    submittedDate: p.createdAt ? toIsoDateOnly(new Date(p.createdAt)) : null,
    moderationNotes: p.moderationNotes ?? null,
  };
}

export async function adminListProperties(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const rentalType = typeof req.query.type === "string" ? req.query.type : undefined;
    const location = typeof req.query.location === "string" ? req.query.location : undefined;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const moderationStatus = typeof req.query.moderationStatus === "string" ? req.query.moderationStatus : undefined;
    const availabilityStatus = typeof req.query.availabilityStatus === "string" ? req.query.availabilityStatus : undefined;
    const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : undefined;
    const sortOrder = typeof req.query.sortOrder === "string" ? req.query.sortOrder : undefined;

    const result = await propertyService.adminGetProperties({
      q,
      page,
      limit,
      rentalType,
      location,
      minPrice,
      maxPrice,
      moderationStatus: moderationStatus as PropertyModerationStatus | undefined,
      availabilityStatus: availabilityStatus as PropertyAvailabilityStatus | undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    res.status(200).json({
      success: true,
      properties: result.properties.map(toUiRow),
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch admin properties",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function adminGetProperty(req: Request, res: Response): Promise<void> {
  try {
    const propertyId = Array.isArray(req.params.propertyId) ? req.params.propertyId[0] : req.params.propertyId;
    const property = await propertyService.adminGetPropertyById(propertyId as string);
    if (!property) {
      res.status(404).json({
        success: false,
        error: { code: "RESOURCE_NOT_FOUND", message: "Property not found" },
      });
      return;
    }
    res.status(200).json({ success: true, property: toUiRow(property) });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch property",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

/**
 * PATCH /api/admin/properties/:propertyId/moderation
 * Body: { action: "approve" | "decline" | "flag_for_review" | "set_pending", notes? }
 */
export async function adminModerateProperty(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" },
      });
      return;
    }
    const propertyId = Array.isArray(req.params.propertyId) ? req.params.propertyId[0] : req.params.propertyId;
    const action = String(req.body?.action ?? "").trim();
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;

    let moderationStatus: PropertyModerationStatus;
    if (action === "approve") moderationStatus = "approved";
    else if (action === "decline") moderationStatus = "declined";
    else if (action === "flag_for_review") moderationStatus = "flagged_for_review";
    else if (action === "set_pending") moderationStatus = "pending_approval";
    else {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ACTION", message: "Invalid moderation action" },
      });
      return;
    }

    if (moderationStatus === "flagged_for_review" && !notes) {
      res.status(400).json({
        success: false,
        error: { code: "NOTES_REQUIRED", message: "Notes are required when flagging for review" },
      });
      return;
    }

    const updated = await propertyService.adminUpdateModeration(propertyId as string, {
      moderationStatus,
      moderationNotes:
        moderationStatus === "flagged_for_review" ? notes ?? "" : notes ?? null,
    });

    res.status(200).json({ success: true, property: toUiRow(updated) });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update moderation status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

/**
 * PATCH /api/admin/properties/:propertyId/availability
 * Body: { availabilityStatus: "available" | "unavailable" | "occupied" }
 */
export async function adminUpdateAvailability(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" },
      });
      return;
    }
    const propertyId = Array.isArray(req.params.propertyId) ? req.params.propertyId[0] : req.params.propertyId;
    const availabilityStatus = String(req.body?.availabilityStatus ?? "").trim() as PropertyAvailabilityStatus;
    if (
      availabilityStatus !== "available" &&
      availabilityStatus !== "unavailable" &&
      availabilityStatus !== "occupied"
    ) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_STATUS", message: "Invalid availabilityStatus" },
      });
      return;
    }
    const updated = await propertyService.adminUpdateAvailability(propertyId as string, availabilityStatus);
    res.status(200).json({ success: true, property: toUiRow(updated) });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update availability status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

