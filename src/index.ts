/* eslint-disable */

import { onRequest } from "firebase-functions/v2/https";
import { app } from "./app";

/** Firebase Functions: HTTP API handler. Deploy with: firebase deploy --only functions */
export const api = onRequest(
  { region: "africa-south1", memory: "512MiB" },
  app as any
);

/** Local dev: run `npm run dev` or `npm start` to listen on a port.
 * Uses `process.env.PORT` if provided; otherwise defaults to 8080.
 */
if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 8080;
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}
