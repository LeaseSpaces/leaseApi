import jwt from "jsonwebtoken";
import config from "../config";

const JWT_SECRET = config.jwtSecret;

/**
 * Generate a JWT for the given userId (default expiry: 7 days).
 * Use this token in the Authorization header: "Bearer <token>".
 */
export const generateToken = (userId: string, expiresIn: string = "7d"): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
};

/**
 * Generate a JWT with custom payload (e.g. role, email).
 * Payload must include userId for auth middleware.
 */
export const generateTokenWithPayload = (
  payload: { userId: string; [key: string]: unknown },
  expiresIn: string = "7d"
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

export const verifyToken = (token: string): { userId: string } => {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
};




