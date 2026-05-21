/* eslint-disable */
import express from "express";
import * as profileController from "../controllers/profileController";
import { appAuth } from "../middleware/auth.middleware";
import { profileAvatarUploadMiddleware } from "../middleware/profileAvatarUpload";

const profileRouter = express.Router();

profileRouter.use(appAuth({ syncUser: true }));

profileRouter.get("/", profileController.getProfile);
profileRouter.patch("/", profileController.updateProfile);
profileRouter.post("/avatar", profileAvatarUploadMiddleware, profileController.uploadAvatar);
profileRouter.post("/2fa/init", profileController.init2fa);
profileRouter.post("/2fa/enable", profileController.enable2fa);
profileRouter.post("/2fa/disable", profileController.disable2fa);
profileRouter.delete("/", profileController.deleteAccount);

export { profileRouter };
