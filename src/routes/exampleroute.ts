import express from "express";
import { usageExamples } from "../controllers/examplescontroller";
const exampleRouter = express.Router();

exampleRouter.get("/all", usageExamples);

export { exampleRouter }