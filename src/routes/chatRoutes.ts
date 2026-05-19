/* eslint-disable */
import express from "express";
import * as chatController from "../controllers/chatController";
import { appAuth } from "../middleware/auth.middleware";

const chatRouter = express.Router();

chatRouter.get("/", appAuth({ syncUser: true }), chatController.listConversations);
chatRouter.post("/", appAuth({ syncUser: true }), chatController.createConversation);

chatRouter.get("/:conversationId", appAuth({ syncUser: true }), chatController.getConversation);
chatRouter.get("/:conversationId/history", appAuth({ syncUser: true }), chatController.getChatHistory);
chatRouter.get("/:conversationId/messages", appAuth({ syncUser: true }), chatController.listMessages);
chatRouter.post("/:conversationId/messages", appAuth({ syncUser: true }), chatController.sendMessage);
chatRouter.post("/:conversationId/read", appAuth({ syncUser: true }), chatController.markRead);
chatRouter.get("/:conversationId/stream", appAuth({ syncUser: true }), chatController.streamConversation);

export { chatRouter };
