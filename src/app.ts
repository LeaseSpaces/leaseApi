import express, { Application } from "express";
import cors from "cors";
import Routes from "./routes";

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// Test route
app.get("/", (_req, res) => {
  res.status(200).send("Hello from South Africa");
});

app.get("/hello", (_req, res) => {
  res.status(200).send("new route");
});

app.get("/test", (_req, res) => {
  res.status(200).send("testing route");
});

// system routes routes
app.use("/api/", Routes);


export { app };
