import express from "express";
import { adminRouter } from "./adminroutes";
import { mobileRouter } from "./mobileroutes";
import { exampleRouter } from "./exampleroute";
import { settingsPublicRouter } from "./settingsRoutes";
import { authRouter } from "./socialAuth";
import { propertyRouter } from "./propertyRoutes";
import { applicationRouter } from "./applicationRoutes";
import { ticketRouter } from "./ticketRoutes";
import { chatRouter } from "./chatRoutes";
import { supportRouter } from "./supportRoutes";
import { landlordRouter } from "./landlordRoutes";
import { leaseRouter } from "./leaseRoutes";
import { maintenanceRouter } from "./maintenanceRoutes";
import { favoriteRouter } from "./favoriteRoutes";
import { profileRouter } from "./profileRoutes";

const Router = express.Router();

Router.use("/admin", adminRouter);
Router.use("/examples", exampleRouter);
Router.use("/mobile", mobileRouter);
Router.use("/settings", settingsPublicRouter);
Router.use("/auth", authRouter);

// LeaseSpaces: property browsing and applications (docs: GET /properties, GET /applications, etc.)
Router.use("/properties", propertyRouter);
Router.use("/applications", applicationRouter);
Router.use("/tickets", ticketRouter);
Router.use("/chats", chatRouter);
Router.use("/support", supportRouter);
Router.use("/mobile/support", supportRouter);
Router.use("/landlord", landlordRouter);
Router.use("/leases", leaseRouter);
Router.use("/maintenance", maintenanceRouter);
Router.use("/favorites", favoriteRouter);
Router.use("/mobile/favorites", favoriteRouter);
Router.use("/profile", profileRouter);
Router.use("/mobile/profile", profileRouter);

export default Router;
