import jwt from "jsonwebtoken";
import config from "../config";

const JWT_SECRET = config.jwtSecret;

/**
 * Generate a JWT for the given userId (default expiry: 7 days).
 * Use this token in the Authorization header: "Bearer <token>".
 */
export const generateToken = (userId: string, expiresIn: string = "7d"): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn } as jwt.SignOptions);
};

/**
 * Generate a JWT with custom payload (e.g. role, email).
 * Payload must include userId for auth middleware.
 */
export const generateTokenWithPayload = (
  payload: { userId: string; [key: string]: unknown },
  expiresIn: string = "7d"
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string): { userId: string } => {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
};

/** Admin: short-lived token (e.g. 24h). Use for admin panel. */
export const ADMIN_TOKEN_EXPIRY = "24h";

/** Temporary token for 2FA login step (2 min). */
export const TEMP_TOKEN_EXPIRY = "2m";

export const generateAdminToken = (userId: string): string => {
  return generateToken(userId, ADMIN_TOKEN_EXPIRY);
};

/** For 2FA login flow: issue temp token until OTP is verified. */
export const generateTempToken = (userId: string): string => {
  return jwt.sign(
    { userId, purpose: "2fa_login" },
    JWT_SECRET,
    { expiresIn: TEMP_TOKEN_EXPIRY } as jwt.SignOptions
  );
};

export const verifyTempToken = (token: string): { userId: string } => {
  const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; purpose?: string };
  if (decoded.purpose !== "2fa_login") throw new Error("Invalid token purpose");
  return { userId: decoded.userId };
};




