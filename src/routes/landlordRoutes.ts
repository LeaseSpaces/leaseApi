/* eslint-disable */
import express from "express";
import { appAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import * as landlordPropertyController from "../controllers/landlordPropertyController";
import * as landlordApplicationController from "../controllers/landlordApplicationController";
import * as maintenanceController from "../controllers/maintenanceController";
import * as leaseController from "../controllers/leaseController";

const landlordRouter = express.Router();

landlordRouter.use(appAuth({ syncUser: true }), requireRole("landlord", "admin"));

// Listings
landlordRouter.get("/properties", landlordPropertyController.listMyProperties);
landlordRouter.post("/properties", landlordPropertyController.createListing);
landlordRouter.put("/properties/:propertyId", landlordPropertyController.updateListing);
landlordRouter.delete("/properties/:propertyId", landlordPropertyController.deleteListing);

// Applications (same handlers as /applications/incoming)
landlordRouter.get("/applications", landlordApplicationController.listIncomingApplications);
landlordRouter.get("/applications/:applicationId", landlordApplicationController.getIncomingApplication);
landlordRouter.patch(
  "/applications/:applicationId/decision",
  landlordApplicationController.decideIncomingApplication
);

// Leases for landlord portfolio
landlordRouter.get("/leases", leaseController.listMyLeases);

// Maintenance queue
landlordRouter.get("/maintenance", maintenanceController.listLandlordMaintenance);
landlordRouter.patch("/maintenance/:requestId", maintenanceController.updateLandlordMaintenance);

export { landlordRouter };
