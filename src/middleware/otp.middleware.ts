/* eslint-disable */
import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { TwoFAService } from "../services/twofa";
import { prisma } from "../config/prisma";

/**
 * Require a valid OTP in body (otp) for high-security admin actions.
 * User must be authenticated (req.user) and have twofa_enabled; their twofa_secret is used to verify.
 */
export const requireOtp = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const otp = req.body?.otp as string | undefined;

  if (!otp || typeof otp !== "string") {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "OTP required",
        details: "Provide 'otp' in request body for this action",
      },
    });
    return;
  }

  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
        details: "User not found. Use firebaseAuth middleware first.",
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { twofa_enabled: true, twofa_secret: true, email: true },
  });

  if (!user?.twofa_enabled || !user.twofa_secret) {
    res.status(403).json({
      success: false,
      error: {
        code: "INSUFFICIENT_PERMISSIONS",
        message: "2FA required",
        details: "Two-factor authentication must be enabled for this action",
      },
    });
    return;
  }

  const valid = TwoFAService.verifyOtp(otp, user.twofa_secret);
  if (!valid) {
    res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired OTP",
        details: "The provided OTP is invalid or has expired",
      },
    });
    return;
  }

  next();
};
