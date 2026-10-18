import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { normalizeEmail } from "../../src/lib/auth";
import { UserProfile } from "../../src/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const rules = readFileSync(
    resolve(process.cwd(), "firestore.rules"),
    "utf8"
  );
  testEnv = await initializeTestEnvironment({
    projectId: "christmas-wishlist-auth-test",
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

describe("Auth and User Profiles", () => {
  it("normalizes email addresses correctly", () => {
    expect(normalizeEmail("  Alice@Example.COM  ")).toBe("alice@example.com");
    expect(normalizeEmail("bob.smith+xmas@gmail.com")).toBe(
      "bob.smith+xmas@gmail.com"
    );
  });

  it("creates and retrieves a user profile document upon sign in", async () => {
    const userId = "user_test_123";
    const userEmail = "Sarah.Connor@Example.com";
    const userDb = testEnv
      .authenticatedContext(userId, { email: userEmail })
      .firestore();

    const userRef = doc(userDb, "users", userId);

    // Initial state: profile does not exist
    const snapBefore = await getDoc(userRef);
    expect(snapBefore.exists()).toBe(false);

    // Create profile
    const newProfile: UserProfile = {
      displayName: "Sarah Connor",
      email: userEmail,
      normalizedEmail: normalizeEmail(userEmail),
      createdAt: new Date().toISOString(),
      lastSelectedFamilyId: null,
    };

    await setDoc(userRef, newProfile);

    // Verify profile is stored correctly
    const snapAfter = await getDoc(userRef);
    expect(snapAfter.exists()).toBe(true);
    const profile = snapAfter.data() as UserProfile;
    expect(profile.displayName).toBe("Sarah Connor");
    expect(profile.email).toBe(userEmail);
    expect(profile.normalizedEmail).toBe("sarah.connor@example.com");
    expect(profile.lastSelectedFamilyId).toBeNull();
  });

  it("allows users to update their profile (displayName, lastSelectedFamilyId)", async () => {
    const userId = "user_test_456";
    const userEmail = "john@example.com";
    const userDb = testEnv
      .authenticatedContext(userId, { email: userEmail })
      .firestore();

    const userRef = doc(userDb, "users", userId);

    await setDoc(userRef, {
      displayName: "John",
      email: userEmail,
      normalizedEmail: normalizeEmail(userEmail),
      createdAt: new Date().toISOString(),
      lastSelectedFamilyId: null,
    });

    // Update profile
    await updateDoc(userRef, {
      displayName: "John Doe",
      lastSelectedFamilyId: "family_999",
    });

    const updatedSnap = await getDoc(userRef);
    const updatedProfile = updatedSnap.data() as UserProfile;
    expect(updatedProfile.displayName).toBe("John Doe");
    expect(updatedProfile.lastSelectedFamilyId).toBe("family_999");
  });

  it("prevents other users from writing to a user's profile", async () => {
    const user1Db = testEnv.authenticatedContext("user_1").firestore();
    const user2Db = testEnv.authenticatedContext("user_2").firestore();

    const user1Ref = doc(user1Db, "users", "user_1");
    await setDoc(user1Ref, {
      displayName: "User One",
      email: "user1@example.com",
      normalizedEmail: "user1@example.com",
      createdAt: new Date().toISOString(),
      lastSelectedFamilyId: null,
    });

    // User 2 tries to modify User 1's profile
    const unauthorizedRef = doc(user2Db, "users", "user_1");
    await expect(
      updateDoc(unauthorizedRef, { displayName: "Hacked" })
    ).rejects.toThrow();
  });
});
