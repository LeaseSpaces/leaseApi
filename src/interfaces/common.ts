/* eslint-disable */

export interface Config {
  databaseuRL: string;
  jwtSecret: string;
  firebase: FirebaseConfig;
}

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};
