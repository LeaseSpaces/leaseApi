/* eslint-disable */
import express from "express";
import * as propertyController from "../controllers/propertyController";
import { appAuth } from "../middleware/auth.middleware";

const propertyRouter = express.Router();

// Public
propertyRouter.get("/", propertyController.getProperties);
propertyRouter.get("/:propertyId", propertyController.getPropertyById);
propertyRouter.post("/search", propertyController.searchProperties);

// Protected (backend JWT or Firebase ID token — mobile-friendly)
propertyRouter.post("/", appAuth({ syncUser: true }), propertyController.createProperty);
propertyRouter.put("/:propertyId", appAuth({ syncUser: true }), propertyController.updateProperty);
propertyRouter.delete("/:propertyId", appAuth({ syncUser: true }), propertyController.deleteProperty);

export { propertyRouter };
