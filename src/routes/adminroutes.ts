/* eslint-disable */

import express from "express";
import {
  deleteAdmin,
  getAdminProfile,
  getDashboard,
  getPropertyAnalytics,
} from "../controllers/adminController";
import {
  adminGetProperty,
  adminListProperties,
  adminModerateProperty,
  adminUpdateAvailability,
} from "../controllers/adminPropertyController";
import { createAdminUser, createSupportAgent } from "../controllers/adminUserManagementController";
import {
  adminLogin,
  adminLoginPrisma,
  enableTwoFA,
  enable2faPrisma,
  forgotPassword,
  getAllAdmins,
  initTwoFA,
  init2faPrisma,
  verifyTwoFA,
} from "../controllers/authcontroller";
import { firebaseAuth, backendAuth, appAuth } from "../middleware/auth.middleware";
import { requireAdmin, requireSuperAdmin } from "../middleware/role.middleware";
import { requireOtp } from "../middleware/otp.middleware";
import { settingsRouter } from "./settingsRoutes";

const adminRouter = express.Router();

// LeaseSpaces: Protected admin routes (Firebase JWT + Prisma appRole admin)
adminRouter.get("/dashboard", firebaseAuth({ syncUser: true }), requireAdmin, getDashboard);
adminRouter.get("/properties/analytics", firebaseAuth({ syncUser: true }), requireAdmin, getPropertyAnalytics);

// High-security: require OTP (body: { otp }) in addition to auth + admin
adminRouter.delete("/delete-admin", firebaseAuth({ syncUser: true }), requireAdmin, requireOtp, deleteAdmin);

// Admin profile (protected)
adminRouter.get("/admin-profile", firebaseAuth({ syncUser: true }), requireAdmin, getAdminProfile);

// LeaseSpaces: Admin login — username (email) + password only; no Google signup
adminRouter.post("/login", adminLoginPrisma);

// LeaseSpaces: Admin properties (UI-driven)
// Use appAuth so admin UI can send either backend JWT (from /api/admin/login) or Firebase ID token (from /api/auth/sync).
adminRouter.get("/properties", appAuth({ syncUser: true }), requireAdmin, adminListProperties);
adminRouter.get("/properties/:propertyId", appAuth({ syncUser: true }), requireAdmin, adminGetProperty);
adminRouter.patch("/properties/:propertyId/moderation", appAuth({ syncUser: true }), requireAdmin, adminModerateProperty);
adminRouter.patch("/properties/:propertyId/availability", appAuth({ syncUser: true }), requireAdmin, adminUpdateAvailability);

// Super admin only: create admin users and support agents
adminRouter.post("/users/admins", appAuth({ syncUser: true }), requireAdmin, requireSuperAdmin, createAdminUser);
adminRouter.post("/support/agents", appAuth({ syncUser: true }), requireAdmin, requireSuperAdmin, createSupportAgent);

// LeaseSpaces: Admin 2FA (Prisma) — use backend JWT from POST /api/admin/login
adminRouter.post("/2fa/init", backendAuth, requireAdmin, init2faPrisma);
adminRouter.post("/2fa/enable", backendAuth, requireAdmin, enable2faPrisma);

// Legacy auth routes (Firestore admins)
adminRouter.post("/admin-login", adminLogin);
adminRouter.post("/init-2fa", initTwoFA);
adminRouter.post("/enable-2fa", enableTwoFA);
adminRouter.post("/verify-otp", verifyTwoFA);
adminRouter.get("/all", getAllAdmins);
adminRouter.post("/forgot-password", forgotPassword);

// Settings routes
adminRouter.use("/settings", settingsRouter);

export { adminRouter };
