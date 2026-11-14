import { createContext, useContext, type ReactNode } from "react";
import type { Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { db as defaultDb, auth as defaultAuth } from "../lib/firebase";

export interface FirebaseContextValue {
  db: Firestore;
  auth: Auth;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  db: defaultDb,
  auth: defaultAuth,
});

export function FirebaseProvider({
  children,
  db = defaultDb,
  auth = defaultAuth,
}: {
  children: ReactNode;
  db?: Firestore;
  auth?: Auth;
}) {
  return (
    <FirebaseContext.Provider value={{ db, auth }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirestore = (): Firestore => useContext(FirebaseContext).db;
export const useFirebaseAuth = (): Auth => useContext(FirebaseContext).auth;

