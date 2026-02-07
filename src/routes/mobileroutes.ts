import express from "express";
import {
  registerUser,
  registerServiceProviderAsIndividual,
  registerServiceProviderAsBusiness,
  loginUser,
} from "../controllers/authcontroller";
import * as propertyController from "../controllers/propertyController";
import * as applicationController from "../controllers/applicationController";
import { firebaseAuth } from "../middleware/auth.middleware";

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

// User applications (LeaseSpaces docs: GET /applications, POST /applications, PUT /applications/:id/status)
mobileRouter.get("/applications", firebaseAuth({ syncUser: true }), applicationController.getApplications);
mobileRouter.post("/applications", firebaseAuth({ syncUser: true }), applicationController.createApplication);
mobileRouter.put(
  "/applications/:applicationId/status",
  firebaseAuth({ syncUser: true }),
  applicationController.updateApplicationStatus
);

export { mobileRouter };
