/* eslint-disable */
import express from "express";
import * as applicationController from "../controllers/applicationController";
import { firebaseAuth } from "../middleware/auth.middleware";

const applicationRouter = express.Router();

// All application routes require auth
applicationRouter.get("/", firebaseAuth({ syncUser: true }), applicationController.getApplications);
applicationRouter.post("/", firebaseAuth({ syncUser: true }), applicationController.createApplication);
applicationRouter.put(
  "/:applicationId/status",
  firebaseAuth({ syncUser: true }),
  applicationController.updateApplicationStatus
);

export { applicationRouter };
