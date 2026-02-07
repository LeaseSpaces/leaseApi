/* eslint-disable */

import dotenv from "dotenv";
import { Config } from "./interfaces/common";

dotenv.config();

const {
  DATABASE_URL,
  JWT_SECRETE,
  API_KEY,
  AUTH_DOMAIN,
  PROJECT_ID,
  STORAGE_BUCKET,
  MESSAGING_SENDER_ID,
  APP_ID,
} = process.env as {
  [key: string]: string | undefined;
};

const config: Config = {
  databaseuRL: DATABASE_URL as string,
  jwtSecret: JWT_SECRETE as string,
  firebase: {
    apiKey: API_KEY as string,
    authDomain: AUTH_DOMAIN as string,
    projectId: PROJECT_ID as string,
    storageBucket: STORAGE_BUCKET as string,
    messagingSenderId: MESSAGING_SENDER_ID as string,
    appId: APP_ID as string,
  },
};

export default config;
