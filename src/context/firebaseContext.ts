import { createContext, useContext } from "react";
import type { Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { db as defaultDb, auth as defaultAuth } from "../lib/firebase";

export interface FirebaseContextValue {
  db: Firestore;
  auth: Auth;
}

export const FirebaseContext = createContext<FirebaseContextValue>({
  db: defaultDb,
  auth: defaultAuth,
});

export const useFirestore = (): Firestore => useContext(FirebaseContext).db;
export const useFirebaseAuth = (): Auth => useContext(FirebaseContext).auth;
