import { Router } from "express";
import ctrl from "../controllers/socialAuthController";
import { syncAuth } from "../controllers/authcontroller";

const router = Router();

// GET /api/auth — health check (auth API up and endpoints list)
router.get("/", ctrl.health);

// POST /api/auth/firebase — body: { idToken, registrationType } (GOOGLE | FACEBOOK | APPLE | EMAIL)
router.post("/firebase", ctrl.firebaseAuth);

// POST /api/auth/sync — header: Authorization: Bearer <firebase_id_token>; syncs user to Neon, returns backend JWT
router.post("/sync", syncAuth);

export { router as authRouter };