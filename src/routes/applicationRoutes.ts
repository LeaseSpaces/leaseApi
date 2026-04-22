/* eslint-disable */
import express from "express";
import * as applicationController from "../controllers/applicationController";
import { appAuth } from "../middleware/auth.middleware";

const applicationRouter = express.Router();

// All application routes require auth (backend JWT or Firebase ID token — mobile-friendly)
applicationRouter.get("/", appAuth({ syncUser: true }), applicationController.getApplications);
applicationRouter.post("/", appAuth({ syncUser: true }), applicationController.createApplication);
applicationRouter.put(
  "/:applicationId/status",
  appAuth({ syncUser: true }),
  applicationController.updateApplicationStatus
);

export { applicationRouter };
