/* eslint-disable */

import express from "express";
import {
  deleteAdmin,
  getAdminProfile,
  getDashboard,
  getPropertyAnalytics,
} from "../controllers/adminController";
import {
  adminLogin,
  enableTwoFA,
  forgotPassword,
  getAllAdmins,
  initTwoFA,
  verifyTwoFA,
} from "../controllers/authcontroller";
import { firebaseAuth } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
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
