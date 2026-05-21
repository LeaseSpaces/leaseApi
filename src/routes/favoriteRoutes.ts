/* eslint-disable */
import express from "express";
import * as favoriteController from "../controllers/favoriteController";
import { appAuth } from "../middleware/auth.middleware";

const favoriteRouter = express.Router();

favoriteRouter.use(appAuth({ syncUser: true }));

favoriteRouter.get("/check", favoriteController.checkFavorites);
favoriteRouter.get("/", favoriteController.listFavorites);
favoriteRouter.post("/toggle", favoriteController.toggleFavorite);
favoriteRouter.post("/", favoriteController.addFavorite);
favoriteRouter.get("/:propertyId/status", favoriteController.getFavoriteStatus);
favoriteRouter.delete("/:propertyId", favoriteController.removeFavorite);

export { favoriteRouter };
