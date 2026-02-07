/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as propertyService from "../services/propertyService";

export async function getProperties(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      location: req.query.location as string | undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      propertyType: req.query.propertyType as string | undefined,
      bedrooms: req.query.bedrooms ? Number(req.query.bedrooms) : undefined,
      bathrooms: req.query.bathrooms ? Number(req.query.bathrooms) : undefined,
      rentalType: req.query.rentalType as string | undefined,
      amenities: req.query.amenities
        ? (Array.isArray(req.query.amenities) ? req.query.amenities : [req.query.amenities]).map(String)
        : undefined,
      sortBy: req.query.sortBy as "price" | "date" | "location" | undefined,
      sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
    };
    const result = await propertyService.getProperties(filters);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch properties",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function getPropertyById(req: Request, res: Response): Promise<void> {
  try {
    const property = await propertyService.getPropertyById(req.params.propertyId);
    if (!property) {
      res.status(404).json({
        success: false,
        error: { code: "RESOURCE_NOT_FOUND", message: "Property not found" },
      });
      return;
    }
    res.status(200).json({ success: true, property });
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

export async function createProperty(req: Request, res: Response): Promise<void> {
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
      availableDate?: string;
    };
    const property = await propertyService.createProperty({
      ...body,
      landlordId: authReq.user.id,
      availableDate: body.availableDate ? new Date(body.availableDate) : undefined,
    });
    res.status(201).json({ success: true, property });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create property",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function updateProperty(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" },
      });
      return;
    }
    const property = await propertyService.updateProperty(req.params.propertyId, req.body);
    res.status(200).json({ success: true, property });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update property",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function deleteProperty(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" },
      });
      return;
    }
    await propertyService.deleteProperty(req.params.propertyId);
    res.status(200).json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete property",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function searchProperties(req: Request, res: Response): Promise<void> {
  try {
    const result = await propertyService.searchProperties(req.body);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to search properties",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
