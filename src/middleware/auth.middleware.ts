/* eslint-disable */
import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { firebaseAdmin } from "../config/firebase-admin";
import { prisma } from "../config/prisma";

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
