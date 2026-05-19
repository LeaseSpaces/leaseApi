/* eslint-disable */
import express from "express";
import { appAuth } from "../middleware/auth.middleware";
import * as leaseController from "../controllers/leaseController";

const leaseRouter = express.Router();

leaseRouter.get("/me", appAuth({ syncUser: true }), leaseController.listMyLeases);
leaseRouter.get("/:leaseId", appAuth({ syncUser: true }), leaseController.getLease);

export { leaseRouter };
