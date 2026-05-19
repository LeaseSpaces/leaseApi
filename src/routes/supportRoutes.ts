/* eslint-disable */
import express from "express";
import * as supportController from "../controllers/supportController";

const supportRouter = express.Router();

supportRouter.get("/form", supportController.getSupportForm);
supportRouter.get("/categories", supportController.getSupportCategories);
supportRouter.post("/tickets", supportController.submitSupportTicket);

export { supportRouter };
