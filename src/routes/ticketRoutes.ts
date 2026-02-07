import express from "express"
import * as ctrl from "../controllers/ticketController";

const ticketRouter = express.Router();

// Support Email Templates Routes
ticketRouter.get('/email-templates', ctrl.getSupportEmailTemplates);
ticketRouter.get('/email-templates/:id', ctrl.getSupportEmailTemplate);
ticketRouter.post('/email-templates', ctrl.createSupportEmailTemplate);
ticketRouter.put('/email-templates/:id', ctrl.updateSupportEmailTemplate);
ticketRouter.delete('/email-templates/:id', ctrl.deleteSupportEmailTemplate);
ticketRouter.post('/email-templates/:id/send', ctrl.sendSupportEmail);

// Ticket Statistics Routes
ticketRouter.get('/stats', ctrl.getTicketStatistics);

// Support Agents Routes
ticketRouter.get('/agents', ctrl.getSupportAgents);
ticketRouter.put('/agents/:id/workload', ctrl.updateAgentWorkload);

// Ticket Configuration Routes
ticketRouter.get('/statuses', ctrl.getTicketStatuses);
ticketRouter.get('/priorities', ctrl.getTicketPriorities);
ticketRouter.get('/categories', ctrl.getTicketCategories);

// Ticket Operations Routes
ticketRouter.post('/:id/escalate', ctrl.escalateTicket);
ticketRouter.post('/:id/close', ctrl.closeTicket);
ticketRouter.post('/:id/reopen', ctrl.reopenTicket);

// Ticket Messages Routes
ticketRouter.get('/:id/messages', ctrl.getTicketMessages);
ticketRouter.post('/:id/messages', ctrl.addMessage);

// Ticket Management Routes
ticketRouter.get('/', ctrl.getTickets);
ticketRouter.get('/:id', ctrl.getTicket);
ticketRouter.post('/', ctrl.createTicket);
ticketRouter.put('/:id', ctrl.updateTicket);
ticketRouter.delete('/:id', ctrl.deleteTicket);

export { ticketRouter }