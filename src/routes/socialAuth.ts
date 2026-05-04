import { Router } from "express";
import ctrl from "../controllers/socialAuthController";
import {
  syncAuth,
  verifyLogin2fa,
  refreshToken,
  requestEmailOtp,
  verifyEmailOtp,
  completeManualOnboarding,
} from "../controllers/authcontroller";
import { backendAuth } from "../middleware/auth.middleware";

const router = Router();

// GET /api/auth — health check (auth API up and endpoints list)
router.get("/", ctrl.health);

// POST /api/auth/firebase — body: { idToken, registrationType } (GOOGLE | FACEBOOK | APPLE | EMAIL)
router.post("/firebase", ctrl.firebaseAuth);

// POST /api/auth/sync — header: Authorization: Bearer <firebase_id_token>; syncs user to Neon, returns backend JWT (or requires2fa + temporaryToken)
router.post("/sync", syncAuth);

// POST /api/auth/2fa/verify-login — body: { temporaryToken, otp }. Returns full admin token (admin 2FA flow).
router.post("/2fa/verify-login", verifyLogin2fa);

// POST /api/auth/refresh — header: Authorization: Bearer <backend_jwt>. Returns new token (same expiry from now).
router.post("/refresh", refreshToken);

// POST /api/auth/otp/request — body: { email }. Sends 6-digit OTP (5-minute TTL).
router.post("/otp/request", requestEmailOtp);

// POST /api/auth/otp/verify — body: { email, otp }. Verifies OTP and returns JWT.
router.post("/otp/verify", verifyEmailOtp);

// POST /api/auth/onboarding — body: { name, surname, role }. Completes first-time onboarding.
router.post("/onboarding", backendAuth, completeManualOnboarding);

export { router as authRouter };