/* eslint-disable */
import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import config from "../config";

const JWT_SECRET = config.jwtSecret;

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    if (!decoded || !decoded.userId) {
      res
        .status(401)
        .json({ message: "Invalid token payload: missing userId" });
      return;
    }
    req.userId = decoded?.userId;

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token or expired token" });
  }
};
