import { Request, Response } from "express";
import { authService } from "../services/socialAuth";
import { buildPostLoginResponse } from "../services/authLoginService";

const authController = {
  /** GET /api/auth — health check; confirms auth API is up */
  health: (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Auth API (LeaseSpaces)",
      endpoints: {
        "POST /api/auth/firebase": "Body: { idToken, registrationType }. Returns { success, user, token } or requires2fa + temporaryToken",
        "POST /api/auth/sync": "Header: Authorization: Bearer <firebase_id_token>. Returns { success, user, token } or requires2fa + temporaryToken",
        "POST /api/auth/2fa/verify-login": "Body: { temporaryToken, otp }. Completes login when 2FA is enabled",
      },
    });
  },

  /** POST /api/auth/firebase — verify Firebase ID token from body, sync user to Neon, return backend JWT.
   * Mobile signup: optional appRole ("tenant" | "landlord") for new users. */
  firebaseAuth: async (req: Request, res: Response): Promise<void> => {
    try {
      const { idToken, registrationType, appRole } = req.body;
      if (!idToken) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "idToken is required" },
        });
        return;
      }
      const { user } = await authService.handleFirebaseAuth(idToken, registrationType, appRole);
      res.status(200).json(buildPostLoginResponse(user));
    } catch (err: unknown) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: err instanceof Error ? err.message : "Authentication failed",
        },
      });
    }
  },
};

export default authController;