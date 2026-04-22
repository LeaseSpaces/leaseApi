import express from "express";
import { adminRouter } from "./adminroutes";
import { mobileRouter } from "./mobileroutes";
import { exampleRouter } from "./exampleroute";
import { settingsRouter } from "./settingsRoutes";
import { authRouter } from "./socialAuth";
import { propertyRouter } from "./propertyRoutes";
import { applicationRouter } from "./applicationRoutes";
import { ticketRouter } from "./ticketRoutes";

const Router = express.Router();

Router.use("/admin", adminRouter);
Router.use("/examples", exampleRouter);
Router.use("/mobile", mobileRouter);
Router.use("/settings", settingsRouter);
Router.use("/auth", authRouter);

// LeaseSpaces: property browsing and applications (docs: GET /properties, GET /applications, etc.)
Router.use("/properties", propertyRouter);
Router.use("/applications", applicationRouter);
Router.use("/tickets", ticketRouter);

export default Router;