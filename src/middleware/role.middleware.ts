/* eslint-disable */
import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

/**
 * Restrict access to admin only (Prisma user appRole === 'admin').
 * Must be used after firebaseAuth({ syncUser: true }) so req.user is set.
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
        details: "User not found on request. Use firebaseAuth middleware first.",
      },
    });
    return;
  }

  if (req.user.appRole !== "admin") {
    res.status(403).json({
      success: false,
      error: {
        code: "INSUFFICIENT_PERMISSIONS",
        message: "Admin access required",
        details: "This endpoint is restricted to administrators.",
      },
    });
    return;
  }

  next();
};

/**
 * Restrict to specific roles. E.g. requireRole('admin', 'landlord').
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentication required",
          details: "User not found on request.",
        },
      });
      return;
    }

    const role = req.user.appRole ?? "";
    if (!allowedRoles.includes(role)) {
      res.status(403).json({
        success: false,
        error: {
          code: "INSUFFICIENT_PERMISSIONS",
          message: "Insufficient permissions",
          details: `Required role: one of ${allowedRoles.join(", ")}`,
        },
      });
      return;
    }

    next();
  };
};
