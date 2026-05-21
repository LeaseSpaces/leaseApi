/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as favoriteService from "../services/favoriteService";
import { FavoriteNotFoundException } from "../services/favoriteService";

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

function paramId(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : v;
}

function parsePropertyIds(query: unknown): string[] {
  if (typeof query === "string") {
    return query.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(query)) {
    return query.flatMap((q) => String(q).split(",")).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** GET /api/favorites */
export async function listFavorites(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await favoriteService.listFavorites(authReq.user.id, { page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to list favorites");
  }
}

/** GET /api/favorites/check?propertyIds= */
export async function checkFavorites(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const propertyIds = parsePropertyIds(req.query.propertyIds ?? req.query.propertyId);
    const result = await favoriteService.checkFavorites(authReq.user.id, propertyIds);
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to check favorites");
  }
}

/** GET /api/favorites/:propertyId/status */
export async function getFavoriteStatus(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const result = await favoriteService.getFavoriteStatus(authReq.user.id, paramId(req, "propertyId"));
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to get favorite status");
  }
}

/** POST /api/favorites — body: { propertyId } */
export async function addFavorite(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const propertyId = (req.body as { propertyId?: string })?.propertyId;
    if (!propertyId || typeof propertyId !== "string") {
      sendError(res, 400, "VALIDATION_ERROR", "propertyId is required");
      return;
    }
    const result = await favoriteService.addFavorite(authReq.user.id, propertyId);
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    if (e instanceof FavoriteNotFoundException) {
      sendError(res, 404, "NOT_FOUND", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to add favorite");
  }
}

/** POST /api/favorites/toggle — body: { propertyId } */
export async function toggleFavorite(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const propertyId = (req.body as { propertyId?: string })?.propertyId;
    if (!propertyId || typeof propertyId !== "string") {
      sendError(res, 400, "VALIDATION_ERROR", "propertyId is required");
      return;
    }
    const result = await favoriteService.toggleFavorite(authReq.user.id, propertyId);
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    if (e instanceof FavoriteNotFoundException) {
      sendError(res, 404, "NOT_FOUND", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to toggle favorite");
  }
}

/** DELETE /api/favorites/:propertyId */
export async function removeFavorite(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const result = await favoriteService.removeFavorite(authReq.user.id, paramId(req, "propertyId"));
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to remove favorite");
  }
}
