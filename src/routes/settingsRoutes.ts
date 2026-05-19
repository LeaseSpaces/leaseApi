/* eslint-disable */

import express from "express";
import {
  getAppSettingsController,
  saveAppSettingsController,
  updateAppSettingsController,
  getAboutController,
  saveAboutController,
  updateAboutController,
  deleteAboutController,
  getPrivacyPolicyController,
  savePrivacyPolicyController,
  updatePrivacyPolicyController,
  deletePrivacyPolicyController,
  getTermsController,
  saveTermsController,
  updateTermsController,
  deleteTermsController,
  getSMTPConfigController,
  saveSMTPConfigController,
  updateSMTPConfigController,
  testSMTPConnectionController,
  uploadMiddleware,
  uploadFileController,
} from "../controllers/settingsController";

/** Public read-only (mobile app branding / legal pages). */
const settingsPublicRouter = express.Router();
settingsPublicRouter.get("/app", getAppSettingsController);
settingsPublicRouter.get("/about", getAboutController);
settingsPublicRouter.get("/privacy-policy", getPrivacyPolicyController);
settingsPublicRouter.get("/terms-and-conditions", getTermsController);

/** Full CRUD — mount under /api/admin/settings with appAuth + requireAdmin. */
const settingsAdminRouter = express.Router();
settingsAdminRouter.get("/app", getAppSettingsController);
settingsAdminRouter.post("/app", saveAppSettingsController);
settingsAdminRouter.put("/app", updateAppSettingsController);

settingsAdminRouter.get("/about", getAboutController);
settingsAdminRouter.post("/about", saveAboutController);
settingsAdminRouter.put("/about", updateAboutController);
settingsAdminRouter.delete("/about", deleteAboutController);

settingsAdminRouter.get("/privacy-policy", getPrivacyPolicyController);
settingsAdminRouter.post("/privacy-policy", savePrivacyPolicyController);
settingsAdminRouter.put("/privacy-policy", updatePrivacyPolicyController);
settingsAdminRouter.delete("/privacy-policy", deletePrivacyPolicyController);

settingsAdminRouter.get("/terms-and-conditions", getTermsController);
settingsAdminRouter.post("/terms-and-conditions", saveTermsController);
settingsAdminRouter.put("/terms-and-conditions", updateTermsController);
settingsAdminRouter.delete("/terms-and-conditions", deleteTermsController);

settingsAdminRouter.get("/smtp", getSMTPConfigController);
settingsAdminRouter.post("/smtp", saveSMTPConfigController);
settingsAdminRouter.put("/smtp", updateSMTPConfigController);
settingsAdminRouter.post("/smtp/test", testSMTPConnectionController);

settingsAdminRouter.post("/upload", uploadMiddleware, uploadFileController);

/** @deprecated Use settingsPublicRouter or settingsAdminRouter */
const settingsRouter = settingsAdminRouter;

export { settingsPublicRouter, settingsAdminRouter, settingsRouter };
