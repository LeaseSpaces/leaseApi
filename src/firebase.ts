/* eslint-disable */

import { initializeApp } from "firebase/app";
import config from "./config";

const firebase = initializeApp(config.firebase);
export default firebase;
