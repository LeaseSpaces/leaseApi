/* eslint-disable */
import express from "express";
import * as propertyController from "../controllers/propertyController";
import * as chatController from "../controllers/chatController";
import * as applicationController from "../controllers/applicationController";
import { appAuth } from "../middleware/auth.middleware";
import * as leaseController from "../controllers/leaseController";

const propertyRouter = express.Router();

// Public
propertyRouter.get("/", propertyController.getProperties);
propertyRouter.get(
  "/:propertyId/lease",
  appAuth({ syncUser: true }),
  leaseController.getPropertyLease
);
propertyRouter.get("/:propertyId", propertyController.getPropertyById);
propertyRouter.post("/search", propertyController.searchProperties);

// Apply for rental — form schema + existing draft (auth required)
propertyRouter.get(
  "/:propertyId/apply-form",
  appAuth({ syncUser: true }),
  applicationController.getPropertyApplyForm
);

// Tenant ↔ landlord chat for a listing (auth required)
propertyRouter.get("/:propertyId/chats", appAuth({ syncUser: true }), chatController.getTenantPropertyChat);
propertyRouter.post("/:propertyId/chats", appAuth({ syncUser: true }), chatController.startTenantPropertyChat);

// Protected (backend JWT or Firebase ID token — mobile-friendly)
propertyRouter.post("/", appAuth({ syncUser: true }), propertyController.createProperty);
propertyRouter.put("/:propertyId", appAuth({ syncUser: true }), propertyController.updateProperty);
propertyRouter.delete("/:propertyId", appAuth({ syncUser: true }), propertyController.deleteProperty);

export { propertyRouter };
