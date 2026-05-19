/* eslint-disable */
import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { firebaseAdmin } from "../config/firebase-admin";
import { prisma } from "../config/prisma";
import { verifyToken } from "../utils/jwt";

export interface FirebaseDecodedToken {
  uid: string;
  email?: string;
  name?: string;
}

export interface AuthRequest extends Request {
  firebaseUid?: string;
  firebaseDecoded?: FirebaseDecodedToken;
  user?: {
    id: number;
    email: string;
    name: string;
    surname: string;
    appRole: string | null;
    roleId: number;
    socialUserId: string;
    twofa_enabled: boolean;
    isSuperAdmin?: boolean;
  };
}

/**
 * Decode and verify Firebase JWT from Authorization: Bearer <id_token>.
 * Optionally sync user to Neon (Prisma) and attach req.user.
 */
export const firebaseAuth = (options?: { syncUser?: boolean }) => {
  const syncUser = options?.syncUser ?? true;

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentication token is required",
          details: "Please provide a valid Bearer token",
        },
      });
      return;
    }

    const idToken = authHeader.split(" ")[1];

    try {
      const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
      req.firebaseUid = decoded.uid;
      req.firebaseDecoded = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
      };

      if (syncUser) {
        let user = await prisma.user.findUnique({
          where: { socialUserId: decoded.uid },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              name: decoded.name ?? "",
              surname: "",
              email: decoded.email ?? "",
              password: null,
              roleId: 1,
              registrationType: "GOOGLE",
              socialUserId: decoded.uid,
              appRole: UserRole.tenant,
            },
          });
        }

        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
          appRole: user.appRole ?? null,
          roleId: user.roleId,
          socialUserId: user.socialUserId,
          twofa_enabled: user.twofa_enabled,
          isSuperAdmin: (user as any).isSuperAdmin ?? false,
        };
      }

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid token or expired token",
          details: error instanceof Error ? error.message : "Token verification failed",
        },
      });
    }
  };
};

/**
 * App/mobile auth: accepts either backend JWT or Firebase ID token.
 * Tries backend JWT first; if that fails, tries Firebase. Use for property, application, etc.
 */
export const appAuth = (options?: { syncUser?: boolean }) => {
  const syncUser = options?.syncUser ?? true;
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Bearer token required (backend JWT or Firebase ID token)",
        },
      });
      return;
    }
    const token = authHeader.split(" ")[1];
    try {
      const { userId } = verifyToken(token);
      const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
          appRole: user.appRole ?? null,
          roleId: user.roleId,
          socialUserId: user.socialUserId,
          twofa_enabled: user.twofa_enabled,
          isSuperAdmin: (user as any).isSuperAdmin ?? false,
        };
        next();
        return;
      }
    } catch {
      /* not a backend JWT, try Firebase below */
    }
    try {
      const decoded = await firebaseAdmin.auth().verifyIdToken(token);
      req.firebaseUid = decoded.uid;
      req.firebaseDecoded = { uid: decoded.uid, email: decoded.email, name: decoded.name };
      if (syncUser) {
        let user = await prisma.user.findUnique({ where: { socialUserId: decoded.uid } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              name: decoded.name ?? "",
              surname: "",
              email: decoded.email ?? "",
              password: null,
              roleId: 1,
              registrationType: "GOOGLE",
              socialUserId: decoded.uid,
              appRole: UserRole.tenant,
            },
          });
        }
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
          appRole: user.appRole ?? null,
          roleId: user.roleId,
          socialUserId: user.socialUserId,
          twofa_enabled: user.twofa_enabled,
          isSuperAdmin: (user as any).isSuperAdmin ?? false,
        };
      }
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid or expired token",
          details: error instanceof Error ? error.message : "Token verification failed",
          hint:
            "Admin panel: use the token from POST /api/admin/login in Authorization: Bearer <token>. " +
            "Do not use temporaryToken from the 2FA step until OTP is verified.",
        },
      });
    }
  };
};

/**
 * Verify backend JWT (from sync) and set req.user from Prisma.
 * Use for admin 2FA init/enable and other endpoints that use backend token after login.
 */
export const backendAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Bearer token required",
        details: "Use the token returned from POST /api/auth/sync",
      },
    });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const { userId } = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      surname: user.surname,
      appRole: user.appRole ?? null,
      roleId: user.roleId,
      socialUserId: user.socialUserId,
      twofa_enabled: user.twofa_enabled,
      isSuperAdmin: (user as any).isSuperAdmin ?? false,
    };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
        details: error instanceof Error ? error.message : "Token verification failed",
        hint: "Use the backend JWT from POST /api/admin/login (not a Firebase ID token unless using Google sign-in).",
      },
    });
  }
};
