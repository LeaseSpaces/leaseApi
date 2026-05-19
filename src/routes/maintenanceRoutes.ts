/* eslint-disable */
import express from "express";
import { appAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import * as maintenanceController from "../controllers/maintenanceController";

const maintenanceRouter = express.Router();

maintenanceRouter.post("/", appAuth({ syncUser: true }), requireRole("tenant"), maintenanceController.createMaintenance);
maintenanceRouter.get("/", appAuth({ syncUser: true }), requireRole("tenant"), maintenanceController.listMyMaintenance);
maintenanceRouter.get("/:requestId", appAuth({ syncUser: true }), requireRole("tenant"), maintenanceController.getMaintenance);

export { maintenanceRouter };
