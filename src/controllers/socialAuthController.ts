import { Request, Response } from "express";
import { authService } from "../services/socialAuth";

const authController = {
  /** GET /api/auth — health check; confirms auth API is up */
  health: (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Auth API (LeaseSpaces)",
      endpoints: {
        "POST /api/auth/firebase": "Body: { idToken, registrationType }. Returns { success, user, token }",
        "POST /api/auth/sync": "Header: Authorization: Bearer <firebase_id_token>. Returns { success, user, token }",
      },
    });
  },

  /** POST /api/auth/firebase — verify Firebase ID token from body, sync user to Neon, return backend JWT */
  firebaseAuth: async (req: Request, res: Response): Promise<void> => {
    try {
      const { idToken, registrationType } = req.body;
      if (!idToken || !registrationType) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "idToken and registrationType required" },
        });
        return;
      }
      const { user, token } = await authService.handleFirebaseAuth(idToken, registrationType);
      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          uid: user.socialUserId,
          email: user.email,
          name: user.name,
          surname: user.surname,
          role: user.appRole ?? "tenant",
          twofa_enabled: user.twofa_enabled,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        token,
      });
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