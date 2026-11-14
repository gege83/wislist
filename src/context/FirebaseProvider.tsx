import { type ReactNode } from "react";
import type { Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { db as defaultDb, auth as defaultAuth } from "../lib/firebase";
import { FirebaseContext } from "./firebaseContext";

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
