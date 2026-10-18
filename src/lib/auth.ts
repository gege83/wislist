import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { UserProfile } from "../types";

export const googleProvider = new GoogleAuthProvider();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function syncUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const initialProfile: UserProfile = {
    displayName:
      user.displayName || user.email?.split("@")[0] || "Family Member",
    email: user.email || "",
    normalizedEmail: normalizeEmail(user.email || ""),
    createdAt: new Date().toISOString(),
    lastSelectedFamilyId: null,
  };

  await setDoc(userRef, initialProfile);
  return initialProfile;
}

export async function signInWithGoogle(): Promise<UserProfile> {
  const credential = await signInWithPopup(auth, googleProvider);
  return await syncUserProfile(credential.user);
}

export async function signInWithEmail(
  email: string,
  pass: string
): Promise<UserProfile> {
  const credential = await signInWithEmailAndPassword(auth, email, pass);
  return await syncUserProfile(credential.user);
}

export async function signUpWithEmail(
  email: string,
  pass: string,
  displayName?: string
): Promise<UserProfile> {
  const credential = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName) {
    await updateFirebaseProfile(credential.user, { displayName });
  }
  return await syncUserProfile(credential.user);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, updates);
}
