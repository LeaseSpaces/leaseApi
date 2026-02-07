/* eslint-disable */
import express from "express";
import * as propertyController from "../controllers/propertyController";
import { firebaseAuth } from "../middleware/auth.middleware";

const propertyRouter = express.Router();

// Public
propertyRouter.get("/", propertyController.getProperties);
propertyRouter.get("/:propertyId", propertyController.getPropertyById);
propertyRouter.post("/search", propertyController.searchProperties);

// Protected (Bearer Firebase JWT)
propertyRouter.post("/", firebaseAuth({ syncUser: true }), propertyController.createProperty);
propertyRouter.put("/:propertyId", firebaseAuth({ syncUser: true }), propertyController.updateProperty);
propertyRouter.delete("/:propertyId", firebaseAuth({ syncUser: true }), propertyController.deleteProperty);

export { propertyRouter };
