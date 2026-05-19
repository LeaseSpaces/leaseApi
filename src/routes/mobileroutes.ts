import express from "express";
import {
  registerUser,
  registerServiceProviderAsIndividual,
  registerServiceProviderAsBusiness,
  loginUser,
} from "../controllers/authcontroller";
import * as propertyController from "../controllers/propertyController";
import * as applicationController from "../controllers/applicationController";
import { parseApplicationDocuments } from "../middleware/applicationDocumentParser";
import * as locationsController from "../controllers/locationsController";
import { firebaseAuth, appAuth } from "../middleware/auth.middleware";
import { authenticate } from "../middleware/auth";

const mobileRouter = express.Router();

// Auth (legacy)
mobileRouter.post("/register-user", registerUser);
mobileRouter.post(
  "/register-service-provider",
  registerServiceProviderAsIndividual
);
mobileRouter.post("/register-service-provider-business", registerServiceProviderAsBusiness);
mobileRouter.post("/login", loginUser);

// Property browsing (LeaseSpaces docs: GET /properties, GET /properties/:id, POST /properties/search)
mobileRouter.get("/properties", propertyController.getProperties);
mobileRouter.get("/properties/:propertyId", propertyController.getPropertyById);
mobileRouter.post("/properties/search", propertyController.searchProperties);
mobileRouter.get(
  "/properties/:propertyId/apply-form",
  appAuth({ syncUser: true }),
  applicationController.getPropertyApplyForm
);

// User locations
mobileRouter.get("/user-locations", authenticate, locationsController.getAllLocations);
mobileRouter.put("/update-location/:locationId", authenticate, locationsController.updateLocation);

// User applications (LeaseSpaces docs: GET /applications, POST /applications, PUT /applications/:id/status)
mobileRouter.get("/applications", appAuth({ syncUser: true }), applicationController.getApplications);
mobileRouter.post("/applications", appAuth({ syncUser: true }), applicationController.createApplication);
mobileRouter.get(
  "/applications/:applicationId",
  appAuth({ syncUser: true }),
  applicationController.getApplication
);
mobileRouter.patch(
  "/applications/:applicationId",
  appAuth({ syncUser: true }),
  applicationController.updateApplicationPersonalInfo
);
mobileRouter.post(
  "/applications/:applicationId/documents",
  appAuth({ syncUser: true }),
  parseApplicationDocuments,
  applicationController.uploadApplicationDocuments
);
mobileRouter.post(
  "/applications/:applicationId/submit",
  appAuth({ syncUser: true }),
  applicationController.submitApplication
);
mobileRouter.put(
  "/applications/:applicationId/status",
  appAuth({ syncUser: true }),
  applicationController.updateApplicationStatus
);

export { mobileRouter };
