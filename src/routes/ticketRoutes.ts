import express from "express";
import * as ctrl from "../controllers/ticketController";
import { appAuth } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";

const ticketRouter = express.Router();

// Public: dropdowns for support forms
ticketRouter.get("/statuses", ctrl.getTicketStatuses);
ticketRouter.get("/priorities", ctrl.getTicketPriorities);
ticketRouter.get("/categories", ctrl.getTicketCategories);

// Admin-only — register before /:id so paths like /stats are not captured as ids
ticketRouter.get("/email-templates", appAuth(), requireAdmin, ctrl.getSupportEmailTemplates);
ticketRouter.get("/email-templates/:id", appAuth(), requireAdmin, ctrl.getSupportEmailTemplate);
ticketRouter.post("/email-templates", appAuth(), requireAdmin, ctrl.createSupportEmailTemplate);
ticketRouter.put("/email-templates/:id", appAuth(), requireAdmin, ctrl.updateSupportEmailTemplate);
ticketRouter.delete("/email-templates/:id", appAuth(), requireAdmin, ctrl.deleteSupportEmailTemplate);
ticketRouter.post("/email-templates/:id/send", appAuth(), requireAdmin, ctrl.sendSupportEmail);

ticketRouter.get("/stats", appAuth(), requireAdmin, ctrl.getTicketStatistics);

ticketRouter.get("/agents", appAuth(), requireAdmin, ctrl.getSupportAgents);
ticketRouter.put("/agents/:id/workload", appAuth(), requireAdmin, ctrl.updateAgentWorkload);

// Authenticated: list + create (non-admins only see their own tickets)
ticketRouter.get("/", appAuth(), ctrl.getTickets);
ticketRouter.post("/", appAuth(), ctrl.createTicket);

// Admin ticket lifecycle (still before bare /:id for consistency)
ticketRouter.post("/:id/escalate", appAuth(), requireAdmin, ctrl.escalateTicket);
ticketRouter.post("/:id/close", appAuth(), requireAdmin, ctrl.closeTicket);
ticketRouter.post("/:id/reopen", appAuth(), requireAdmin, ctrl.reopenTicket);

ticketRouter.get("/:id/messages", appAuth(), ctrl.getTicketMessages);
ticketRouter.post("/:id/messages", appAuth(), ctrl.addMessage);

ticketRouter.get("/:id", appAuth(), ctrl.getTicket);
ticketRouter.put("/:id", appAuth(), requireAdmin, ctrl.updateTicket);
ticketRouter.delete("/:id", appAuth(), requireAdmin, ctrl.deleteTicket);

export { ticketRouter };
