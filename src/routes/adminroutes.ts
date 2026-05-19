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
import { createAdminUser, createSupportAgent, enableUserTwoFA, disableUserTwoFA } from "../controllers/adminUserManagementController";
import * as locationsController from "../controllers/locationsController";
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
import { backendAuth, appAuth } from "../middleware/auth.middleware";
import { requireAdmin, requireSuperAdmin } from "../middleware/role.middleware";
import { requireOtp } from "../middleware/otp.middleware";
import { settingsAdminRouter } from "./settingsRoutes";
import * as adminApplicationController from "../controllers/adminApplicationController";

const adminRouter = express.Router();

// LeaseSpaces: Protected admin routes (Firebase JWT + Prisma appRole admin)
// appAuth accepts backend JWT from POST /api/admin/login OR Firebase ID token
adminRouter.get("/dashboard", appAuth({ syncUser: true }), requireAdmin, getDashboard);
adminRouter.get("/properties/analytics", appAuth({ syncUser: true }), requireAdmin, getPropertyAnalytics);

// High-security: require OTP (body: { otp }) in addition to auth + admin
adminRouter.delete("/delete-admin", appAuth({ syncUser: true }), requireAdmin, requireOtp, deleteAdmin);

adminRouter.get("/admin-profile", appAuth({ syncUser: true }), requireAdmin, getAdminProfile);

// LeaseSpaces: Admin login — username (email) + password only; no Google signup
adminRouter.post("/login", adminLoginPrisma);

// LeaseSpaces: Admin properties (UI-driven)
// Use appAuth so admin UI can send either backend JWT (from /api/admin/login) or Firebase ID token (from /api/auth/sync).
adminRouter.get("/properties", appAuth({ syncUser: true }), requireAdmin, adminListProperties);
adminRouter.get("/properties/:propertyId", appAuth({ syncUser: true }), requireAdmin, adminGetProperty);
adminRouter.patch("/properties/:propertyId/moderation", appAuth({ syncUser: true }), requireAdmin, adminModerateProperty);
adminRouter.patch("/properties/:propertyId/availability", appAuth({ syncUser: true }), requireAdmin, adminUpdateAvailability);

// Rental applications — review, approve, reject
adminRouter.get("/applications", appAuth({ syncUser: true }), requireAdmin, adminApplicationController.listApplications);
adminRouter.get(
  "/applications/:applicationId",
  appAuth({ syncUser: true }),
  requireAdmin,
  adminApplicationController.getApplication
);
adminRouter.patch(
  "/applications/:applicationId/decision",
  appAuth({ syncUser: true }),
  requireAdmin,
  adminApplicationController.decideApplication
);
adminRouter.patch(
  "/applications/:applicationId/documents-verification",
  appAuth({ syncUser: true }),
  requireAdmin,
  adminApplicationController.updateDocumentsVerification
);

// Super admin only: create admin users and support agents
adminRouter.post("/users/admins", appAuth({ syncUser: true }), requireAdmin, requireSuperAdmin, createAdminUser);
adminRouter.post("/support/agents", appAuth({ syncUser: true }), requireAdmin, requireSuperAdmin, createSupportAgent);

// Admin location management
adminRouter.get("/locations", appAuth({ syncUser: true }), requireAdmin, locationsController.getAdminLocations);
adminRouter.put("/locations/:locationId", appAuth({ syncUser: true }), requireAdmin, locationsController.updateLocation);

// Admin 2FA management for users
adminRouter.post("/users/:userId/2fa/enable", appAuth({ syncUser: true }), requireAdmin, enableUserTwoFA);
adminRouter.post("/users/:userId/2fa/disable", appAuth({ syncUser: true }), requireAdmin, disableUserTwoFA);

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

// Admin settings — requires Bearer token from POST /api/admin/login (or Firebase ID token)
adminRouter.use("/settings", appAuth({ syncUser: true }), requireAdmin, settingsAdminRouter);

export { adminRouter };
