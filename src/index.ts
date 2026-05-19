/* eslint-disable */

import { onRequest } from "firebase-functions/v2/https";
import { app } from "./app";

const functionOptions = {
  region: "africa-south1" as const,
  memory: "512MiB" as const,
};

/** Legacy v2 function URL (keep for existing clients). */
export const api = onRequest(functionOptions, app as any);

/** API v3 — same Express app; use this base URL for new frontends after deploy. */
export const api3 = onRequest(functionOptions, app as any);

/** Local dev: run `npm run dev` or `npm start` to listen on a port.
 * Uses `process.env.PORT` if provided; otherwise defaults to 8080.
 */
if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 8080;
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}
