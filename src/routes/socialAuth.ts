import { Router } from "express";
import ctrl from "../controllers/socialAuthController";
import { syncAuth, verifyLogin2fa, refreshToken } from "../controllers/authcontroller";

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

export { router as authRouter };