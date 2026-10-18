import { useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  signInWithGoogle as authSignInWithGoogle,
  signInWithEmail as authSignInWithEmail,
  signUpWithEmail as authSignUpWithEmail,
  signOutUser,
  syncUserProfile,
  updateUserProfile,
} from "../lib/auth";
import { UserProfile } from "../types";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userProf = await syncUserProfile(currentUser);
          setProfile(userProf);
        } catch (err) {
          console.error("Failed to sync profile:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const userProf = await syncUserProfile(user);
      setProfile(userProf);
    }
  };

  const handleSignInWithGoogle = async () => {
    const prof = await authSignInWithGoogle();
    setProfile(prof);
  };

  const handleSignInWithEmail = async (email: string, pass: string) => {
    const prof = await authSignInWithEmail(email, pass);
    setProfile(prof);
  };

  const handleSignUpWithEmail = async (
    email: string,
    pass: string,
    displayName?: string
  ) => {
    const prof = await authSignUpWithEmail(email, pass, displayName);
    setProfile(prof);
  };

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    setProfile(null);
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    await updateUserProfile(user.uid, updates);
    setProfile((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle: handleSignInWithGoogle,
        signInWithEmail: handleSignInWithEmail,
        signUpWithEmail: handleSignUpWithEmail,
        signOut: handleSignOut,
        updateProfile: handleUpdateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
