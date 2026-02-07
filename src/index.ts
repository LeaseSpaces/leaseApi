// import {onRequest} from "firebase-functions/v2/https";
import {app} from "./app";

app.listen(8080, () => {
  console.log(`🚀 Server running at http://localhost:${8080}`);
});

// export const api = onRequest({region:"africa-south1"},app);
