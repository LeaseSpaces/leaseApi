/* eslint-disable */
import express from "express";
import * as applicationController from "../controllers/applicationController";
import { appAuth } from "../middleware/auth.middleware";
import { parseApplicationDocuments } from "../middleware/applicationDocumentParser";
import * as landlordApplicationController from "../controllers/landlordApplicationController";
import { requireRole } from "../middleware/role.middleware";

const applicationRouter = express.Router();

applicationRouter.get(
  "/incoming",
  appAuth({ syncUser: true }),
  requireRole("landlord", "admin"),
  landlordApplicationController.listIncomingApplications
);
applicationRouter.get(
  "/incoming/:applicationId",
  appAuth({ syncUser: true }),
  requireRole("landlord", "admin"),
  landlordApplicationController.getIncomingApplication
);
applicationRouter.patch(
  "/incoming/:applicationId/decision",
  appAuth({ syncUser: true }),
  requireRole("landlord", "admin"),
  landlordApplicationController.decideIncomingApplication
);

applicationRouter.get("/", appAuth({ syncUser: true }), applicationController.getApplications);
applicationRouter.post("/", appAuth({ syncUser: true }), applicationController.createApplication);
applicationRouter.get(
  "/:applicationId",
  appAuth({ syncUser: true }),
  applicationController.getApplication
);
applicationRouter.patch(
  "/:applicationId",
  appAuth({ syncUser: true }),
  applicationController.updateApplicationPersonalInfo
);
applicationRouter.post(
  "/:applicationId/documents",
  appAuth({ syncUser: true }),
  parseApplicationDocuments,
  applicationController.uploadApplicationDocuments
);
applicationRouter.post(
  "/:applicationId/submit",
  appAuth({ syncUser: true }),
  applicationController.submitApplication
);
applicationRouter.put(
  "/:applicationId/status",
  appAuth({ syncUser: true }),
  applicationController.updateApplicationStatus
);

export { applicationRouter };
